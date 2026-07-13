# Shared-Libs VN Market Improvements — Design

> Technical design decisions for shared library enhancements
> Updated:  July 7, 2026

---

## 1. Vietnamese Phone Number Module (`shared_vn_nlp/phone.py`)

### Design Decision:  Regex-Based with Carrier Lookup Table

VN phone numbers have a well-defined structure:  all are 10 digits (since 2018 migration).  Carrier detection uses prefix-to-carrier mapping.

```python
# VN Phone Format: 0[3-9]x xxx xxxx (10 digits total)
# E.164 format:    +849xxxxxxxx (11 chars with +84)

CARRIER_PREFIXES = {
    "viettel": ["086", "096", "097", "098", "032", "033", "034", "035", "036", "037", "038", "039"],
    "mobifone": ["089", "090", "093", "070", "076", "077", "078", "079"],
    "vinaphone": ["088", "091", "094", "081", "082", "083", "084", "085"],
    "vietnamobile": ["092", "056", "058"],
    "gmobile": ["099", "059"],
}
```

### Normalization Strategy

```
Input:  "0912.345.678" | "+84912345678" | "84912345678" | "0912-345-678"
Step 1: Strip all non-digits → "0912345678" or "84912345678"
Step 2: If starts with "+84" or "84" → replace with "0" → "0912345678"
Step 3: Validate length == 10 and prefix in CARRIER_PREFIXES
Step 4: Output formats:
  - e164:    "+84912345678"
  - local:   "0912345678"
  - display: "0912 345 678"
  - sms_api: "84912345678"
```

### API Design

```python
@dataclass
class PhoneResult:
    valid: bool
    e164: str           # "+84912345678"
    local: str          # "0912345678"
    display: str        # "0912 345 678"
    sms_api: str        # "84912345678"
    carrier: str        # "viettel"
    error_vi: str | None  # Vietnamese error message if invalid

def normalize_phone(raw: str) -> PhoneResult:
    """Normalize any VN phone format → structured result."""

def validate_phone(raw: str) -> bool:
    """Quick validation check."""

def detect_carrier(raw: str) -> str | None:
    """Detect carrier from phone number prefix."""
```

---

## 2. Vietnamese Address Parser (`shared_vn_nlp/address.py`)

### Design Decision:  Pattern-Based Parsing (Not ML)

VN addresses follow predictable patterns.  ML is overkill — regex + lookup table is faster, cheaper, and more deterministic.

### Parsing Strategy

```
Input:  "123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM"

Step 1: Split by delimiters (comma, dash)
Step 2: Match each segment against patterns:
  - Province: last segment, match against vn_provinces.json (existing data)
  - District: segment with Q/Quận/H/Huyện prefix
  - Ward: segment with P/Phường/X/Xã/TT/Thị trấn prefix
  - Street: remaining segment(s) = street address
Step 3: Normalize abbreviations → full form
Step 4: Cross-validate district belongs to province, ward belongs to district
```

### Data Sources

| Component | Source | Count |
|-----------|--------|-------|
| Provinces | Existing `vn_provinces.json` | 63 |
| Districts | New `vn_districts.json` (from danhmuchanhchinh.gso.gov.vn) | ~700 |
| Wards | New `vn_wards.json` | ~10,600 |

### API Design

```python
@dataclass
class ParsedAddress:
    street: str | None
    ward: str | None
    district: str | None
    province: str | None
    confidence: float       # 0.0-1.0 overall
    components_confidence: dict[str, float]  # per-component confidence

def parse_address(raw: str) -> ParsedAddress:
    """Parse unstructured VN address string."""

def normalize_address(raw: str) -> str:
    """Return normalized full-form address string."""
```

### Abbreviation Map

```python
ABBREVIATIONS = {
    "tp": "Thành phố", "tp.": "Thành phố",
    "q": "Quận", "q.": "Quận",
    "p": "Phường", "p.": "Phường",
    "h": "Huyện", "h.": "Huyện",
    "tx": "Thị xã", "tx.": "Thị xã",
    "tt": "Thị trấn", "tt.": "Thị trấn",
    "x": "Xã", "x.": "Xã",
    "tphcm": "Hồ Chí Minh", "hcm": "Hồ Chí Minh",
    "hn": "Hà Nội", "sg": "Hồ Chí Minh",
    "đn": "Đà Nẵng",
}
```

---

## 3. Vietnamese Currency Formatting (`shared_vn_nlp/currency.py`)

### Design Decision:  Pure Python with VN Locale Rules

No external dependency needed.  VN uses dot (`.`) as thousands separator, comma (`,`) as decimal, and `đ` as currency symbol.

### Format Rules

| Amount | Standard | Compact | Range |
|--------|----------|---------|-------|
| 5000 | 5.000đ | 5K | — |
| 79000 | 79.000đ | 79K | — |
| 150000 | 150.000đ | 150K | — |
| 1500000 | 1.500.000đ | 1,5tr | — |
| 25000000 | 25.000.000đ | 25tr | — |
| 2000000000 | 2.000.000.000đ | 2 tỷ | — |
| 50000–200000 | — | — | 50K – 200K |

### Compact Thresholds

```python
if amount >= 1_000_000_000:  # tỷ
    return f"{amount / 1_000_000_000:.1f} tỷ".replace(".0 ", " ")
elif amount >= 1_000_000:     # triệu
    return f"{amount / 1_000_000:.1f}tr".replace(".0tr", "tr")
elif amount >= 1_000:         # nghìn
    return f"{amount // 1_000}K"
else:
    return f"{amount}đ"
```

### Parse Strategy

```python
# Input patterns to handle:
# "79.000đ" → 79000
# "79,000 VND" → 79000
# "1.5 triệu" or "1,5tr" → 1500000
# "2 tỷ" → 2000000000
# "79K" → 79000
```

---

## 4. Zalo SSO in Auth Service

### Design Decision:  Reuse `@winlux/zalo-sdk` SSO Module

The `zalo-sdk/src/sso.ts` already handles Zalo OAuth token exchange.  Auth-service only needs to:
1. Accept auth code from client
2. Call `zalo-sdk.exchangeCode()` → get Zalo user profile
3. Create/merge local user
4. Return JWT

### Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐     ┌───────────┐
│  Client  │────▶│ Auth Service │────▶│  Zalo SDK    │────▶│ Zalo API  │
│ (App/Web)│     │ POST /zalo   │     │ exchangeCode │     │ graph.zalo│
└──────────┘     └──────────────┘     └──────────────┘     └───────────┘
     ▲                  │
     │                  │ JWT + user
     └──────────────────┘
```

### User Merge Logic

```typescript
// 1. Get Zalo profile (id, name, phone, avatar)
const zaloProfile = await zaloSSO.exchangeCode(code);

// 2. Find existing user by Zalo ID
let user = await User.findOne({ zalo_id: zaloProfile.id });

// 3. If not found, try matching by phone (merge accounts)
if (!user && zaloProfile.phone) {
  user = await User.findOne({ phone: normalizePhone(zaloProfile.phone) });
  if (user) {
    user.zalo_id = zaloProfile.id;  // Link Zalo to existing account
    await user.save();
  }
}

// 4. If still not found, create new user
if (!user) {
  user = await User.create({
    name: zaloProfile.name,
    zalo_id: zaloProfile.id,
    phone: zaloProfile.phone,
    avatar: zaloProfile.avatar,
    auth_method: 'zalo',
    product,
  });
}

// 5. Generate JWT
const token = signJWT(user);
return { token, user };
```

---

## 5. Notification Service — Email & SMS Providers

### Design Decision:  Plugin Architecture (Same Pattern as FCM/ZaloOA)

```
notification-service/src/providers/
├── fcm.ts         # (existing) Firebase Cloud Messaging
├── zalo-oa.ts     # (existing) Zalo Official Account
├── email.ts       # (new) Resend API for transactional email
└── sms.ts         # (new) eSMS.vn (extracted from auth-service)
```

### Email Provider — Resend

**Why Resend over SES:**  Simpler API, better deliverability for VN, no AWS account needed, free tier covers initial usage (3000 emails/month).

```typescript
interface EmailPayload {
  to: string;
  subject: string;
  html: string;           // Pre-rendered HTML template
  from?: string;          // Default: "WinLux <no-reply@winlux.com>"
  replyTo?: string;
}
```

### SMS Provider — eSMS Extraction

Currently `auth-service/otp.service.ts` has eSMS logic hardcoded.  Extract to shared provider:

```typescript
// notification-service/src/providers/sms.ts
class SMSProvider {
  async send(phone: string, message: string): Promise<NotificationResult> {
    // Uses eSMS.vn API (same as current OTP service)
    // Supports: Brandname SMS (SmsType=2) and standard SMS (SmsType=8)
  }
}
```

### Channel Fallback Strategy

```typescript
const FALLBACK_CHAINS: Record<NotificationType, ('fcm' | 'zalo' | 'sms' | 'email')[]> = {
  price_drop:          ['fcm', 'zalo'],
  medication_reminder: ['fcm', 'sms'],        // Health-critical: SMS fallback
  tax_deadline:        ['fcm', 'email'],       // Important: email fallback
  payment_receipt:     ['email', 'fcm'],       // Email primary for receipts
  emergency:           ['fcm', 'sms', 'zalo'], // All channels for emergency
};
```

---

## 6. Notification Scheduling

### Design Decision:  BullMQ Delayed Jobs

Leverage existing BullMQ infrastructure (already used in product services) for scheduled notifications.

```typescript
// sendAt: absolute time → calculate delay
const delay = sendAt.getTime() - Date.now();
await notificationQueue.add('send', payload, { delay });

// sendAfter: relative → parse "30m", "2h", "1d"
const delayMs = parseDuration(sendAfter);
await notificationQueue.add('send', payload, { delay: delayMs });
```

### Quiet Hours

```typescript
const QUIET_START = 22; // 10 PM VN time
const QUIET_END = 7;    // 7 AM VN time

function applyQuietHours(sendAt: Date, priority: NotificationPriority): Date {
  if (priority === 'critical') return sendAt; // Never delay critical

  const vnHour = getVNHour(sendAt);
  if (vnHour >= QUIET_START || vnHour < QUIET_END) {
    // Reschedule to 7:00 AM next morning
    return nextMorning(sendAt);
  }
  return sendAt;
}
```

---

## 7. Payment Refund & Reconciliation

### Refund Architecture

```
POST /api/payment/refund/:orderId
Body: { amount?: number, reason: string }

Flow:
1. Validate order exists, status == 'completed'
2. If amount not specified → full refund
3. Call provider refund API (sepay/momo/stripe)
4. Update payment status → 'refunded' or 'partially_refunded'
5. Notify product service → POST /internal/payment-refunded
```

### Reconciliation Job

```
Schedule: Every 30 minutes
Logic:
1. Find payments with status='pending' AND created_at < 30 min ago
2. For each: query provider API for actual status
3. If provider says completed → mark completed + trigger webhook
4. If provider says failed → mark failed
5. If provider says still pending AND > 2 hours → alert admin
```

---

## 8. Service Clients — Unified Pattern

### Design Decision:  Thin Wrappers with Auto-Config

Each client follows the same pattern:  accept `product` name, auto-configure from env vars.

```typescript
// Pattern for all service clients:
export class NotificationServiceClient {
  private client: NotificationClient;

  constructor(product: string) {
    this.client = new NotificationClient({
      product,
      redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
      fcmServiceAccount: process.env.FCM_SA ? JSON.parse(process.env.FCM_SA) : undefined,
      zaloOAToken: process.env.ZALO_OA_TOKEN,
    });
  }

  async send(payload: Omit<NotificationPayload, 'userId'> & { userId: string }) {
    return this.client.send(payload);
  }
}
```

---

## 9. Standardized Error Format

### Design Decision:  Single `ApiResponse<T>` Type Across All Services

```typescript
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;         // Technical error (for developers)
  code?: string;          // Error code (AUTH_001, PAY_002, etc.)
  message_vi?: string;    // Vietnamese user-facing message
}

// Error code format: {SERVICE}_{CATEGORY}_{NUMBER}
// AUTH_INVALID_001 = Invalid credentials
// PAY_PROVIDER_001 = Provider timeout
// NOTIF_RATE_001 = Rate limit exceeded
```

### Error Handler Middleware (Express)

```typescript
export function sharedErrorHandler(err: any, req: any, res: any, next: any) {
  const statusCode = err.statusCode || 500;
  const response: ApiResponse = {
    success: false,
    error: err.message,
    code: err.code || `UNKNOWN_${statusCode}`,
    message_vi: err.message_vi || 'Đã có lỗi xảy ra. Vui lòng thử lại.',
  };
  res.status(statusCode).json(response);
}
```

---

## 10. DoctorCar Cross-Product Links

### Link Matrix Addition

| From | To | Trigger Keywords | Label |
|------|----|-----------------|-------|
| SmartBuy | DoctorCar | phụ tùng, ô tô, xe hơi, bảo dưỡng, dầu máy | "Kiểm tra xe miễn phí" |
| FIN Tax | DoctorCar | bảo dưỡng, sửa xe, xăng dầu, bảo hiểm xe | "Lịch bảo dưỡng thông minh" |
| DoctorCar | SmartBuy | (after diagnosis shows part needed) | "Mua phụ tùng giá tốt" |
| DoctorCar | FIN Tax | (after maintenance complete) | "Ghi nhận chi phí" |

### Implementation

Add `case 'doctorcar':` to the switch in `cross-product-links.ts` and add DoctorCar entries in existing SmartBuy/FIN Tax cases.
