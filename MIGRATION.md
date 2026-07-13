# Migration Guide: Shared Libraries

---

## v2.0.0 — VN Market Improvements (July 2026)

This release adds VN phone normalization, unified error format, email + SMS notification channels, Zalo SSO, payment refund, and DoctorCar cross-product links.

---

### 1. Phone Normalization (`shared-vn-nlp`)

Normalize VN phone numbers to E.164 before storing in your database.

**Import:**

```python
from shared_vn_nlp import normalize_phone, validate_phone, detect_carrier
```

**Usage:**

```python
result = normalize_phone("0912.345.678")
# result.e164     → "+84912345678"
# result.local    → "0912345678"
# result.display  → "0912 345 678"
# result.sms_api  → "84912345678"
# result.carrier  → "viettel"
# result.valid    → True
```

**Before/After:**

| Raw input | E.164 output |
|-----------|-------------|
| `0912345678` | `+84912345678` |
| `+84 912 345 678` | `+84912345678` |
| `84912345678` | `+84912345678` |
| `0912-345-678` | `+84912345678` |
| `0912.345.678` | `+84912345678` |

**Recommendation:**  Always call `normalize_phone()` before persisting phone numbers.  This ensures consistent lookup and deduplication across services.

---

### 2. Unified Error Format (`ApiResponse<T>`)

All shared services now return a consistent response envelope.

**Import:**

```typescript
import { ApiResponse, ApiError } from '../service-clients/types/api-response';
import { sharedErrorHandler } from '../service-clients/middleware/error-handler';
```

**Setup (Express):**

```typescript
import express from 'express';
import { sharedErrorHandler } from '../service-clients/middleware/error-handler';

const app = express();

// ... register all routes ...

// Add error handler AFTER all routes
app.use(sharedErrorHandler);
```

**Throwing errors:**

```typescript
import { ApiError } from '../service-clients/types/api-response';

// Instead of:
throw new Error('User not found');

// Use:
throw new ApiError({
  statusCode: 404,
  code: 'AUTH_001',
  message: 'User not found',
  message_vi: 'Không tìm thấy người dùng',
});
```

**Response shape:**

```json
{
  "success": false,
  "error": "User not found",
  "code": "AUTH_001",
  "message_vi": "Không tìm thấy người dùng"
}
```

All user-facing errors now include `message_vi` for Vietnamese users.

---

### 3. Notification Channels — Email & SMS

New providers added alongside existing FCM and Zalo OA.

**Import:**

```typescript
import { NotificationServiceClient } from '../service-clients/notification-client';
```

**Setup:**

```typescript
const notifier = new NotificationServiceClient('your-product-name');

// Send notification (channel selection is automatic based on type)
await notifier.send({
  userId: 'user-123',
  type: 'payment_receipt',
  title: 'Thanh toán thành công',
  body: 'Đơn hàng #456 đã được thanh toán.',
});
```

**New environment variables required:**

| Variable | Description |
|----------|-------------|
| `RESEND_API_KEY` | API key from [resend.com](https://resend.com) for transactional email |
| `ESMS_API_KEY` | API key from eSMS.vn for SMS delivery |
| `ESMS_SECRET_KEY` | Secret key from eSMS.vn |

**Channel fallback** is automatic per notification type:

| Notification type | Fallback chain |
|-------------------|---------------|
| `price_drop` | FCM → Zalo OA |
| `medication_reminder` | FCM → SMS |
| `tax_deadline` | FCM → Email |
| `payment_receipt` | Email → FCM |
| `emergency` | FCM → SMS → Zalo OA |

**Scheduling support:**

```typescript
// Absolute time
await notifier.scheduleNotification({
  userId: 'user-123',
  type: 'tax_deadline',
  title: 'Nhắc nộp thuế',
  body: 'Hạn nộp thuế TNCN còn 3 ngày.',
  sendAt: '2026-07-08T07:00:00+07:00',
});

// Relative delay
await notifier.scheduleNotification({
  userId: 'user-123',
  type: 'medication_reminder',
  title: 'Uống thuốc',
  body: 'Đã đến giờ uống thuốc buổi tối.',
  sendAfter: '30m',
});
```

Quiet hours (22:00–07:00 VN time) are enforced automatically.  Non-critical notifications are delayed to 07:00 the next morning.

---

### 4. Zalo SSO

Add Zalo login to your product service.

**Import:**

```typescript
import { zaloAuth } from '../service-clients/auth-client';
```

**Usage:**

```typescript
// In your login route handler:
const { token, user } = await zaloAuth(code, 'your-product-name');
// code = OAuth authorization code from Zalo client SDK
```

For Zalo Mini App login:

```typescript
const { token, user } = await zaloAuth(code, 'your-product-name', true);
```

**New environment variables required:**

| Variable | Description |
|----------|-------------|
| `ZALO_APP_ID` | Your Zalo app ID from developers.zalo.me |
| `ZALO_APP_SECRET` | Your Zalo app secret |

**Behavior:**
- First-time login → creates new user automatically
- If phone from Zalo profile matches an existing user → merges accounts (links `zalo_id`)
- Returns standard JWT + user object

---

### 5. Payment Refund

New endpoint for full or partial refunds.

**Endpoint:**

```
POST /api/payment/refund/:orderId
```

**Request body:**

```json
{
  "amount": 50000,
  "reason": "Khách hàng yêu cầu hoàn tiền"
}
```

- `amount` — optional.  Omit for full refund, provide a value for partial refund.
- `reason` — required.  Reason for the refund (stored in payment record).

**Response:**

```json
{
  "success": true,
  "data": {
    "orderId": "order-789",
    "refundAmount": 50000,
    "status": "refunded",
    "refundedAt": "2026-07-08T10:00:00.000Z"
  }
}
```

The refund is routed to the original payment provider (SePay, MoMo, Stripe, PayOS, ZaloPay) automatically.

---

### 6. Cross-Product Links — DoctorCar

DoctorCar is now part of the cross-product link matrix.

**Import:**

```typescript
import { getCrossLinks } from '../service-clients/cross-product-links';
```

**Usage from DoctorCar:**

```typescript
const links = getCrossLinks('doctorcar', { context: 'maintenance_complete' });
// Returns:
// [
//   { product: 'smartbuy', label: '🛒 Mua phụ tùng giá tốt', url: '...' },
//   { product: 'fintax', label: '💰 Ghi nhận chi phí bảo dưỡng', url: '...' },
// ]
```

**Usage from SmartBuy (auto parts keywords):**

```typescript
const links = getCrossLinks('smartbuy', { keywords: ['phụ tùng', 'ô tô'] });
// Returns:
// [{ product: 'doctorcar', label: '🚗 Kiểm tra xe miễn phí', url: '...' }]
```

---

### 7. Breaking Changes

- **Error format:** All shared services (auth, payment, notification) now return `ApiResponse<T>` instead of ad-hoc JSON shapes.  If your product service parses responses from these services directly, update your response handling to check `response.success` and read `response.data`.
- **Phone field format:** If you store phone numbers, consider migrating existing records to E.164 format (`+84xxxxxxxxx`) for consistency with the new normalization.
- **Notification payload:** The `NotificationPayload` type now includes optional `sendAt` and `sendAfter` fields.  Existing payloads without these fields continue to work (sent immediately).

---

## Overview

This guide documents how to migrate each AI engine from per-repo implementations to shared libraries. Migration is incremental and reversible at any point.

## Installation

Install shared libraries in each AI engine's virtual environment:

```bash
# From the AI engine's directory
pip install -e ../../shared-libs/shared-vn-nlp
pip install -e ../../shared-libs/shared-crawler
pip install -e ../../shared-libs/shared-llm-client
```

## Import Replacement Patterns

### shared-vn-nlp

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.vn_nlp import segment` | `from shared_vn_nlp import segment` |
| `from services.vn_nlp import ner, pos_tag` | `from shared_vn_nlp import ner, pos_tag` |
| `from services.slang import normalize_slang` | `from shared_vn_nlp import normalize_slang` |
| `from services.provinces import detect_provinces` | `from shared_vn_nlp import detect_provinces` |
| `from services.vn_calendar import get_events` | `from shared_vn_nlp import get_events, get_events_in_range, lunar_to_solar` |
| `from services.sentiment import analyze_sentiment` | `from shared_vn_nlp import analyze_sentiment` |

### shared-crawler

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.crawler import CrawlEngine` | `from shared_crawler import CrawlEngine` |
| `from services.crawler import crawl_source` | `from shared_crawler import CrawlEngine; engine.crawl_source(...)` |

### shared-llm-client

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.llm_service import generate` | `from shared_llm_client import LLMClient` |
| `from services.ollama_client import OllamaClient` | `from shared_llm_client import LLMClient` |

**Note:** `shared-llm-client` connects to Ollama on `localhost:11434` by default — no config changes needed.

## Migration Order

1. **fin-tax-ai** — Simplest usage (NLP + LLM only)
2. **caremate-ai** — NLP + LLM
3. **smartbuy-ai** — NLP + LLM
4. **trend-brief-ai** — NLP + Crawler + LLM
5. **ai-video-engine** — NLP + Crawler + LLM (most complex)

## Per-Engine Migration Steps

### 1. fin-tax-ai

```bash
cd fin-tax-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

Replace imports in `fin-tax-ai/fintaxai-engine/services/`:
- `nlp_service.py` → use `from shared_vn_nlp import segment, normalize_slang`
- `llm_service.py` → use `from shared_llm_client import LLMClient`

### 2. caremate-ai

```bash
cd caremate-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

### 3. smartbuy-ai

```bash
cd smartbuy-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

### 4. trend-brief-ai

```bash
cd trend-brief-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-crawler
pip install -e ../shared-libs/shared-llm-client
```

### 5. ai-video-engine

```bash
cd ai-video-engine
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-crawler
pip install -e ../shared-libs/shared-llm-client
```

## Backward Compatibility

- Existing per-repo code continues working alongside shared libs
- Both old and new imports can coexist during migration
- No Ollama configuration changes required (same port 11434)
- No MongoDB schema changes required

## LLM Model per Product

| Product | Default Model | Purpose |
|---------|--------------|---------|
| ai-video-engine | qwen2.5:7b | Vietnamese script generation, good multilingual |
| caremate-ai | phogpt:4b-chat | Vietnamese medical explanations |
| fin-tax-ai | mistral:7b | Financial/tax reasoning |
| smartbuy-ai | vistral | Vietnamese product descriptions |
| trend-brief-ai | (via shared-llm-client) | Article summarization |

When using `shared-llm-client`, configure `OLLAMA_MODEL` per product in `.env`.

## Rollback

To rollback any engine, simply revert the import statements:

```python
# Revert from:
from shared_vn_nlp import segment
# Back to:
from services.vn_nlp import segment
```

No data migration or infrastructure changes needed.
