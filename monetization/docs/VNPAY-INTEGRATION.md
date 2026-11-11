# VNPay Integration Research

**Task:  MON-001**
**Last Updated:  October 2026**

---

## Overview

VNPay is Vietnam's leading payment gateway, supporting:
- Domestic ATM cards (40+ banks)
- International cards (Visa, Mastercard, JCB, Amex)
- QR Code payments (VNPay QR)
- E-wallets

## API Documentation

**Official docs:**  https://sandbox.vnpayment.vn/apis/

### Integration Types

| Type | Use Case | Complexity |
|------|----------|------------|
| VNPay-QR | In-store, mobile | Low |
| VNPay Payment Gateway | Web payments | Medium |
| VNPay Tokenization | Recurring payments | High |

## Payment Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────▶│  Server  │────▶│  VNPay   │────▶│   Bank   │
│          │     │          │     │          │     │          │
│  1. Pay  │     │ 2. Create│     │ 3. Redir │     │ 4. Auth  │
│          │◀────│    URL   │◀────│          │◀────│          │
│          │     │          │     │          │     │          │
│  5. Show │     │ 6. Verify│     │          │     │          │
│  Result  │◀────│  + Store │     │          │     │          │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
```

## Configuration

### Sandbox Credentials
```env
VNPAY_TMN_CODE=DEMO1234
VNPAY_HASH_SECRET=SANDBOX_SECRET_KEY
VNPAY_URL=https://sandbox.vnpayment.vn/paymentv2/vpcpay.html
VNPAY_RETURN_URL=https://yourapp.com/payment/vnpay-return
VNPAY_API_URL=https://sandbox.vnpayment.vn/merchant_webapi/api/transaction
```

### Production Credentials
- Apply at:  https://vnpay.vn/dang-ky-dich-vu
- Required documents:  Business license, ID
- Approval time:  3-5 business days

## API Parameters

### Create Payment URL

| Parameter | Required | Description |
|-----------|----------|-------------|
| vnp_Version | Yes | API version (2.1.0) |
| vnp_Command | Yes | "pay" |
| vnp_TmnCode | Yes | Merchant code |
| vnp_Amount | Yes | Amount × 100 (VND) |
| vnp_CreateDate | Yes | yyyyMMddHHmmss |
| vnp_CurrCode | Yes | "VND" |
| vnp_IpAddr | Yes | Customer IP |
| vnp_Locale | Yes | "vn" or "en" |
| vnp_OrderInfo | Yes | Order description |
| vnp_OrderType | Yes | "other" |
| vnp_ReturnUrl | Yes | Return URL |
| vnp_TxnRef | Yes | Unique order ID |
| vnp_SecureHash | Yes | HMAC SHA512 |

### Response Codes

| Code | Description |
|------|-------------|
| 00 | Success |
| 07 | Deduct success, suspicious transaction |
| 09 | Card not registered for Internet Banking |
| 10 | Invalid authentication (3+ times) |
| 11 | Payment timeout |
| 12 | Card/Account locked |
| 13 | Wrong OTP |
| 24 | Customer cancelled |
| 51 | Insufficient balance |
| 65 | Transaction limit exceeded |
| 75 | Bank under maintenance |
| 79 | Wrong payment password |
| 99 | Other errors |

## Implementation

### 1. Create Payment URL

```typescript
import crypto from 'crypto';
import qs from 'qs';

function createPaymentUrl(orderId: string, amount: number, orderInfo: string, ipAddr: string): string {
  const vnp_Params: Record<string, string> = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE!,
    vnp_Locale: 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: orderInfo,
    vnp_OrderType: 'other',
    vnp_Amount: String(amount * 100),
    vnp_ReturnUrl: process.env.VNPAY_RETURN_URL!,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: formatDate(new Date())
  };

  // Sort and create query string
  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  
  // Create secure hash
  const hmac = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET!);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
  sortedParams['vnp_SecureHash'] = signed;

  return `${process.env.VNPAY_URL}?${qs.stringify(sortedParams, { encode: false })}`;
}
```

### 2. Verify Return

```typescript
function verifyReturn(query: Record<string, string>): boolean {
  const secureHash = query['vnp_SecureHash'];
  delete query['vnp_SecureHash'];
  delete query['vnp_SecureHashType'];

  const sortedParams = sortObject(query);
  const signData = qs.stringify(sortedParams, { encode: false });
  
  const hmac = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET!);
  const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

  return secureHash === signed;
}
```

### 3. Query Transaction

```typescript
async function queryTransaction(orderId: string, transDate: string): Promise<any> {
  const requestData = {
    vnp_RequestId: generateRequestId(),
    vnp_Version: '2.1.0',
    vnp_Command: 'querydr',
    vnp_TmnCode: process.env.VNPAY_TMN_CODE,
    vnp_TxnRef: orderId,
    vnp_OrderInfo: `Query order ${orderId}`,
    vnp_TransactionDate: transDate,
    vnp_CreateDate: formatDate(new Date()),
    vnp_IpAddr: '127.0.0.1'
  };

  // Add secure hash
  const signData = Object.values(requestData).join('|');
  const hmac = crypto.createHmac('sha512', process.env.VNPAY_HASH_SECRET!);
  requestData['vnp_SecureHash'] = hmac.update(signData).digest('hex');

  const response = await fetch(process.env.VNPAY_API_URL!, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestData)
  });

  return response.json();
}
```

## Testing

### Sandbox Test Cards

| Card Type | Number | Expiry | CVV |
|-----------|--------|--------|-----|
| Napas | 9704198526191432198 | 07/15 | OTP: 123456 |
| Visa | 4000000000000002 | Any future | Any |
| Master | 5200000000000007 | Any future | Any |

### Test Scenarios

1. **Success:**  Use test card, complete OTP
2. **Cancel:**  Click "Hủy" on payment page
3. **Timeout:**  Wait 15 minutes
4. **Wrong OTP:**  Enter wrong OTP 3 times

## Security Checklist

- [ ] Never log `vnp_SecureHash` or card details
- [ ] Always verify `vnp_SecureHash` on return
- [ ] Use HTTPS for all endpoints
- [ ] Implement idempotency for webhooks
- [ ] Store only necessary transaction data
- [ ] Implement request timeout (30s)
- [ ] Rate limit payment creation

## Fees

| Transaction Type | Fee |
|-----------------|-----|
| Domestic ATM | 1.1% (min 3,300 VND) |
| Visa/Master | 2.2% |
| QR Code | 0.8% |
| E-wallet | 1.0% |

*Fees subject to negotiation based on volume*

## Support

- **Technical:**  hotro@vnpay.vn
- **Business:**  sales@vnpay.vn
- **Hotline:**  1900 5555 77

---

*Document maintained by Monetization Team*
