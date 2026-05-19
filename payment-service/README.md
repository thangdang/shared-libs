# Payment Service

Shared payment microservice for all WinLux products. Handles payment creation, webhook verification, and subscription activation notifications.

**Port:** 3006  
**Internal only** — called by product services via localhost  
**Webhooks exposed via Nginx:** `api.winlux.com/payment/*`

## Supported Providers

| Provider | Default | Cá nhân | Banks | Phí | Ghi chú |
|----------|---------|---------|-------|-----|---------|
| **SePay** | ✅ | ✅ CCCD | 30+ (VCB, VIB, SHB, BIDV, MB, ACB, Techcombank...) | Miễn phí | QR VietQR, NAPAS, Visa/Master/JCB |
| PayOS | | ✅ CCCD | 5 (MB, OCB, BIDV, KienlongBank, ACB) | Miễn phí | Giới hạn ngân hàng |
| MoMo | | Cần DN | Ví MoMo | ~1% | Phổ biến mobile |
| ZaloPay | | Cần DN | Ví ZaloPay | ~1% | |
| Stripe | | Cần DN | Visa/Master/JCB quốc tế | 2.9% + 30¢ | Thanh toán quốc tế |

## Architecture

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   UI Apps   │────▶│  Product Service  │────▶│   Payment   │
│ (Angular)   │     │  (proxy routes)   │     │   Service   │
└─────────────┘     └──────────────────┘     │  :3006      │
                                              └──────┬──────┘
                                                     │
                              ┌───────────────────────┼───────────────┐
                              ▼                       ▼               ▼
                         ┌─────────┐           ┌──────────┐    ┌──────────┐
                         │  SePay  │           │   MoMo   │    │  Stripe  │
                         │(default)│           │          │    │          │
                         └────┬────┘           └────┬─────┘    └────┬─────┘
                              │                     │                │
                              ▼                     ▼                ▼
                    ┌──────────────────────────────────────────────────────┐
                    │          POST /api/payment/webhook/{provider}         │
                    └──────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │ Notify Product   │  POST /internal/payment-completed
                    │ Service          │
                    └──────────────────┘
```

## Payment Flow

1. **UI** sends `POST /api/payment/create` with `{ plan, method: 'sepay' }`
2. **Product service** proxies to payment-service via `payment-client.ts`
3. **Payment service** calls SePay API → returns `checkoutUrl`
4. **User** is redirected to SePay payment page → scans QR / selects bank
5. **SePay** sends webhook to `POST /api/payment/webhook/sepay`
6. **Payment service** marks payment as completed → notifies product service
7. **Product service** activates subscription

## Quick Start

### 1. Install dependencies

```bash
cd shared-libs/payment-service
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in SePay credentials (minimum required):

```env
SEPAY_MERCHANT_ID=your_merchant_id
SEPAY_SECRET_KEY=your_secret_key
SEPAY_ENV=sandbox
SEPAY_SUCCESS_URL=http://localhost:4200/payment/success
SEPAY_ERROR_URL=http://localhost:4200/payment/error
SEPAY_CANCEL_URL=http://localhost:4200/payment/cancel
```

### 3. Run

```bash
npm run dev
```

## SePay Setup Guide (Tài khoản SHB)

### Đăng ký & liên kết ngân hàng

1. Đăng ký tại [my.sepay.vn/register](https://my.sepay.vn/register) (chỉ cần CCCD)
2. Vào **Tài khoản ngân hàng** → **Thêm tài khoản** → Chọn **SHB**
3. Nhập số tài khoản SHB → Xác thực bằng chuyển khoản hoặc BankHub ID
4. Tên chủ TK phải khớp với CCCD đã đăng ký

### Kích hoạt Payment Gateway

1. Vào **Payment Gateway** → **Đăng ký**
2. Chọn **"Bank transfer QR code scanning"** → **Start now**
3. Chọn tài khoản SHB làm tài khoản nhận tiền
4. Copy **Merchant ID** + **Secret Key** → cập nhật `.env`

### Cấu hình Webhook

Trong SePay dashboard → **Webhook** → thêm URL:
```
https://api.yourdomain.com/payment/webhook/sepay
```

### Go Live

1. Test sandbox xong → vào Payment Gateway → **Switch to Production**
2. Cập nhật `SEPAY_ENV=production`
3. Thay Merchant ID / Secret Key mới (production)

## API Endpoints

### Create Payment

```
POST /api/payment/create
```

```json
{
  "product": "smartbuy",
  "userId": "user_123",
  "plan": "pro_monthly",
  "method": "sepay",
  "amount": 79000,
  "description": "SmartBuy AI - Pro Monthly"
}
```

**Response:**
```json
{
  "success": true,
  "orderId": "SB-1234567890-abcd1234",
  "payUrl": "https://pay.sepay.vn/checkout/...",
  "qrCode": "..."
}
```

### Check Status

```
GET /api/payment/status/:orderId
```

### Payment History

```
GET /api/payment/user/:userId
```

### Plans

```
GET /api/payment/plans/:product
```

## Webhook Endpoints

| Provider | URL | Format |
|----------|-----|--------|
| SePay | `POST /api/payment/webhook/sepay` | JSON `{ id, gateway, transferAmount, code, content, ... }` |
| MoMo | `POST /api/payment/webhook/momo` | MoMo IPN format |
| ZaloPay | `POST /api/payment/webhook/zalopay` | ZaloPay callback format |
| PayOS | `POST /api/payment/webhook/payos` | PayOS webhook format |
| Stripe | `POST /api/payment/webhook/stripe` | Stripe event (raw body) |

## Supported Payment Methods

| Method Key | Provider | Mô tả |
|-----------|----------|--------|
| `sepay` | SePay | QR VietQR chuyển khoản (default) |
| `momo` | MoMo | Ví MoMo |
| `zalopay` | ZaloPay | Ví ZaloPay |
| `payos` | PayOS | QR chuyển khoản (limited banks) |
| `stripe` | Stripe | Visa/Master/JCB quốc tế |

## File Structure

```
shared-libs/payment-service/
├── src/
│   ├── index.ts                 # Express app entry
│   ├── models/
│   │   └── Payment.ts           # Mongoose payment schema
│   ├── providers/
│   │   ├── sepay.ts             # SePay (default)
│   │   ├── payos.ts             # PayOS
│   │   ├── momo.ts              # MoMo
│   │   ├── zalopay.ts           # ZaloPay
│   │   └── stripe.ts            # Stripe
│   └── routes/
│       ├── payment.routes.ts    # Create/status/plans
│       ├── webhook.routes.ts    # Provider callbacks
│       └── admin.routes.ts      # Admin operations
├── .env.example
├── package.json
├── tsconfig.json
└── README.md
```

## Product Service Integration

Each product service uses `payment-client.ts` to call this service:

```typescript
import { createPayment } from '../services/payment-client';

const result = await createPayment({
  product: 'smartbuy',
  userId: user.id,
  plan: 'pro_monthly',
  method: 'sepay',        // default
  amount: 79000,
  description: 'SmartBuy AI - Pro Monthly',
});

if (result.success) {
  // Redirect user to result.payUrl
}
```

## Notes

- SePay webhook must return `{ "success": true }` with HTTP 200 within 30 seconds
- Use transaction `id` as dedup key to prevent double-processing
- SePay retries failed webhooks automatically
- For production: verify HMAC-SHA256 signature via `x-sepay-signature` header
- SePay IPs to whitelist: check [developer.sepay.vn/en/dia-chi-ip](https://developer.sepay.vn/en/dia-chi-ip)
