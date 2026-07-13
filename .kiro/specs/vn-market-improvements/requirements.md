# Shared-Libs VN Market Improvements — Requirements

> Enhance shared libraries for VN market suitability, cross-app reusability, and consistency
> Covers:  shared-vn-nlp, auth-service, notification-service, payment-service, service-clients
> Updated:  July 7, 2026

---

## Req 1: Vietnamese Phone Number Normalization (`shared-vn-nlp`)

- Req 1.1: Normalize all VN phone formats to E.164 (`+84xxxxxxxxx`) — supports `0xx`, `84xx`, `+84xx`, `0xx.xxx.xxxx`, `0xx-xxx-xxxx`
- Req 1.2: Validate VN carrier prefixes (Viettel: 086/096/097/098/032-039, Mobifone: 089/090/093/070-079, Vinaphone: 088/091/094/081-085)
- Req 1.3: Detect carrier name from phone number prefix
- Req 1.4: Format phone for display (`0912 345 678`) and for SMS API (`84912345678`)
- Req 1.5: Reject invalid numbers (wrong length, non-VN prefix) with clear error messages in Vietnamese

---

## Req 2: Vietnamese Address Parsing (`shared-vn-nlp`)

- Req 2.1: Parse unstructured VN address string → structured `{ street, ward, district, city/province }` object
- Req 2.2: Handle abbreviated forms:  TP/Tp → Thành phố, Q/q → Quận, P/p → Phường, H/h → Huyện, TX → Thị xã, TT → Thị trấn
- Req 2.3: Map parsed city/province to official 63-province list (link to existing `provinces.py`)
- Req 2.4: Handle common address patterns:  "123 Nguyễn Huệ, Q1, TPHCM" or "Số 5A, ngõ 12, Láng Hạ, Đống Đa, Hà Nội"
- Req 2.5: Return confidence score (0-1) for each parsed component

---

## Req 3: Vietnamese Currency Formatting (`shared-vn-nlp`)

- Req 3.1: Format number → VND display:  `79000` → `"79.000đ"`, `1500000` → `"1.500.000đ"`
- Req 3.2: Compact format for large amounts:  `79000` → `"79K"`, `1500000` → `"1,5tr"`, `2000000000` → `"2 tỷ"`
- Req 3.3: Parse VND string → number:  `"79.000đ"` → `79000`, `"1,5 triệu"` → `1500000`
- Req 3.4: Support range formatting:  `format_range(50000, 200000)` → `"50K – 200K"`
- Req 3.5: Locale-aware — thousand separator is `.` (dot), decimal is `,` (comma)

---

## Req 4: Zalo SSO Integration in Auth Service

- Req 4.1: Add `POST /api/auth/zalo` endpoint accepting Zalo OAuth code → return JWT + user
- Req 4.2: Support both Zalo OAuth (web/app) and Zalo Mini App login flows
- Req 4.3: Auto-create user on first Zalo login (merge if phone matches existing user)
- Req 4.4: Store Zalo user ID for cross-referencing with Zalo OA notifications
- Req 4.5: Use existing `@winlux/zalo-sdk` SSO module — no duplicated Zalo API logic

---

## Req 5: Notification Service — Email & SMS Channels

- Req 5.1: Add email provider (Resend or AWS SES) — send HTML templates (receipt, report, alert)
- Req 5.2: Add SMS provider — wrap eSMS.vn API (deduplicate with `auth-service/otp.service.ts`)
- Req 5.3: Support channel fallback:  if FCM fails → try Zalo OA → try SMS (configurable per notification type)
- Req 5.4: Add scheduled send:  `sendAt: '2026-07-08T07:00:00+07:00'` (VN timezone UTC+7)
- Req 5.5: Email templates in Vietnamese with product branding (logo, color per product)

---

## Req 6: Notification Service — Send Scheduling

- Req 6.1: Support `sendAt` (absolute time) and `sendAfter` (relative delay, e.g., "30m", "2h")
- Req 6.2: Time zone aware — all times interpreted as `Asia/Ho_Chi_Minh` (UTC+7)
- Req 6.3: Quiet hours enforcement:  no push/SMS between 22:00–07:00 unless priority is "critical"
- Req 6.4: Batch digest:  group multiple notifications of same type into one (e.g., 5 price drops → 1 summary)

---

## Req 7: Payment Service — Refund & Reconciliation

- Req 7.1: Add `POST /api/payment/refund/:orderId` — support full and partial refund
- Req 7.2: Refund calls respective provider API (SePay refund, MoMo refund, Stripe refund)
- Req 7.3: Add reconciliation job:  poll provider API for payments stuck in "pending" > 30 min
- Req 7.4: Add `GET /api/payment/admin/stats` — revenue per product, conversion rate, method distribution
- Req 7.5: Webhook retry tracking — count missed webhooks, alert if > 3 consecutive failures

---

## Req 8: Service Clients — Complete the Client Matrix

- Req 8.1: Add `notification-client.ts` — wraps NotificationClient with product auto-config
- Req 8.2: Add `analytics-client.ts` — wraps Analytics + RevenueTracker with product auto-config
- Req 8.3: Update `cross-product-links.ts` — add DoctorCar product to cross-link matrix
- Req 8.4: All service clients must have consistent error format:  `{ success: boolean, data?: T, error?: string, code?: string }`

---

## Req 9: Standardized Error Response Format

- Req 9.1: Define shared `ApiResponse<T>` type:  `{ success: boolean, data?: T, error?: string, code?: string, message_vi?: string }`
- Req 9.2: All shared services (auth, payment, notification) return this format
- Req 9.3: Error codes are product-agnostic (e.g., `AUTH_001`, `PAY_002`, `NOTIF_003`)
- Req 9.4: All user-facing error messages have Vietnamese translation (`message_vi`)
- Req 9.5: Create shared middleware `errorHandler.ts` that catches and formats errors consistently

---

## Req 10: Cross-Product DoctorCar Integration

- Req 10.1: SmartBuy → DoctorCar link when keywords match:  phụ tùng, ô tô, xe hơi, bảo dưỡng
- Req 10.2: FIN Tax → DoctorCar link when expense category is "transportation" or "vehicle maintenance"
- Req 10.3: DoctorCar → SmartBuy link for "Mua phụ tùng giá tốt" when viewing diagnosis/maintenance
- Req 10.4: DoctorCar → FIN Tax link for "Ghi nhận chi phí bảo dưỡng" after maintenance completion
- Req 10.5: Add DoctorCar base URL to BASE_URLS map:  `https://doctorcar.winlux.com`
