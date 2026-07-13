# Shared-Libs VN Market Improvements — Tasks

> Priority order:  Quick wins first, then progressively larger pieces
> Target:  2 weeks implementation
> Updated:  July 7, 2026

---

## Phase 1: VN NLP Quick Wins (Day 1–2)

*New modules in `shared-libs/shared-vn-nlp/shared_vn_nlp/`.  Pure Python, no external deps beyond existing.*

- [x] 1. Create `phone.py` — VN phone normalization, validation, carrier detection
  - _File: `shared-libs/shared-vn-nlp/shared_vn_nlp/phone.py`_
  - _Exports: `normalize_phone()`, `validate_phone()`, `detect_carrier()`_
  - _Returns: `PhoneResult` dataclass with `e164`, `local`, `display`, `sms_api`, `carrier`_
  - _Requirements: Req 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Create `currency.py` — VND formatting, compact display, parsing
  - _File: `shared-libs/shared-vn-nlp/shared_vn_nlp/currency.py`_
  - _Exports: `format_vnd()`, `format_compact()`, `parse_vnd()`, `format_range()`_
  - _Handles: dot separator, đ suffix, K/triệu/tỷ compact forms_
  - _Requirements: Req 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 3. Create `address.py` — VN address parser with abbreviation expansion
  - _File: `shared-libs/shared-vn-nlp/shared_vn_nlp/address.py`_
  - _Exports: `parse_address()`, `normalize_address()`_
  - _Returns: `ParsedAddress` dataclass with `street`, `ward`, `district`, `province`, `confidence`_
  - _Requirements: Req 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 4. Add VN district/ward data files for address parser
  - _File: `shared-libs/shared-vn-nlp/shared_vn_nlp/data/vn_districts.json`_
  - _File: `shared-libs/shared-vn-nlp/shared_vn_nlp/data/vn_wards.json`_
  - _Source: danhmuchanhchinh.gso.gov.vn (official government data)_
  - _Requirements: Req 2.3_

- [x] 5. Update `shared_vn_nlp/__init__.py` to export new modules
  - _Add: `normalize_phone`, `validate_phone`, `detect_carrier`, `format_vnd`, `format_compact`, `parse_vnd`, `parse_address`_
  - _Requirements: All Req 1-3_

- [x] 6. Write tests for phone, currency, and address modules
  - _File: `shared-libs/shared-vn-nlp/tests/test_phone.py`_
  - _File: `shared-libs/shared-vn-nlp/tests/test_currency.py`_
  - _File: `shared-libs/shared-vn-nlp/tests/test_address.py`_
  - _Cover: edge cases, invalid input, all format variations_
  - _Requirements: Req 1.5, 2.5, 3.5_

---

## Phase 2: Auth Service — Zalo SSO (Day 2–3)

*Add Zalo login to shared auth-service.  Depends on existing `@winlux/zalo-sdk`.*

- [x] 7. Add `zalo_id` field to User model in auth-service
  - _File: `shared-libs/auth-service/src/models/User.ts`_
  - _Field: `zalo_id: { type: String, sparse: true, unique: true }`_
  - _Requirements: Req 4.4_

- [x] 8. Create `services/zalo.service.ts` — Zalo OAuth code exchange + user merge
  - _File: `shared-libs/auth-service/src/services/zalo.service.ts`_
  - _Logic: Exchange code → get profile → find/create/merge user → return JWT_
  - _Imports: `@winlux/zalo-sdk` SSO module_
  - _Requirements: Req 4.1, 4.2, 4.3, 4.5_

- [x] 9. Add `POST /api/auth/zalo` route
  - _File: `shared-libs/auth-service/src/routes/auth.routes.ts`_
  - _Body: `{ code: string, product: string, mini_app?: boolean }`_
  - _Response: `{ token, user }`_
  - _Requirements: Req 4.1, 4.2_

- [x] 10. Update `service-clients/auth-client.ts` with `zaloAuth()` helper
  - _File: `shared-libs/service-clients/auth-client.ts`_
  - _Add: `export async function zaloAuth(code: string, product: string, miniApp?: boolean)`_
  - _Requirements: Req 4.5_

---

## Phase 3: Notification Service — New Channels (Day 3–5)

*Add email + SMS providers, channel fallback, and scheduling.*

- [x] 11. Create `providers/sms.ts` — eSMS.vn wrapper (extracted from auth OTP)
  - _File: `shared-libs/notification-service/src/providers/sms.ts`_
  - _Exports: `SMSProvider` class with `send(phone, message)` method_
  - _Deduplicates: logic currently in `auth-service/otp.service.ts`_
  - _Requirements: Req 5.2_

- [x] 12. Create `providers/email.ts` — Resend API provider
  - _File: `shared-libs/notification-service/src/providers/email.ts`_
  - _Exports: `EmailProvider` class with `send(to, subject, html)` method_
  - _Requirements: Req 5.1_

- [x] 13. Add email templates directory with base Vietnamese templates
  - _Dir: `shared-libs/notification-service/src/templates/`_
  - _Files: `receipt.html`, `report.html`, `alert.html`, `base-layout.html`_
  - _Pattern: Product branding via CSS variables (logo, primary color)_
  - _Requirements: Req 5.5_

- [x] 14. Update `NotificationClient` to support email + SMS channels + fallback
  - _File: `shared-libs/notification-service/src/client.ts`_
  - _Add: channel fallback logic (fcm → zalo → sms/email based on type)_
  - _Add: `channels` field support in `NotificationPayload`_
  - _Requirements: Req 5.3_

- [x] 15. Update `types.ts` — add 'email' | 'sms' to channel types
  - _File: `shared-libs/notification-service/src/types.ts`_
  - _Add: `email` and `sms` to channel union type_
  - _Add: `EmailConfig` and `SMSConfig` to `NotificationConfig`_
  - _Requirements: Req 5.1, 5.2_

- [x] 16. Create `scheduler.ts` — BullMQ-based send scheduling
  - _File: `shared-libs/notification-service/src/scheduler.ts`_
  - _Exports: `NotificationScheduler` class_
  - _Supports: `sendAt` (absolute), `sendAfter` (relative "30m", "2h")_
  - _Requirements: Req 6.1, 6.2_

- [x] 17. Add quiet hours enforcement to scheduler
  - _In: `shared-libs/notification-service/src/scheduler.ts`_
  - _Logic: 22:00–07:00 VN time → delay to 07:00 next day (except "critical")_
  - _Requirements: Req 6.3_

- [x] 18. Add batch digest capability
  - _File: `shared-libs/notification-service/src/digest.ts`_
  - _Logic: Buffer same-type notifications, emit summary after configurable window_
  - _Requirements: Req 6.4_

---

## Phase 4: Payment Service — Refund & Stats (Day 5–7)

*Add refund flow, reconciliation job, and admin analytics.*

- [x] 19. Add refund route `POST /api/payment/refund/:orderId`
  - _File: `shared-libs/payment-service/src/routes/payment.routes.ts`_
  - _Body: `{ amount?: number, reason: string }`_
  - _Logic: full or partial refund, call provider API, update status_
  - _Requirements: Req 7.1_

- [x] 20. Add refund methods to each provider (sepay, momo, stripe, payos, zalopay)
  - _Files: `shared-libs/payment-service/src/providers/*.ts`_
  - _Each provider implements: `refund(orderId, amount, reason) → RefundResult`_
  - _Requirements: Req 7.2_

- [x] 21. Add `refunded` and `partially_refunded` to Payment model status enum
  - _File: `shared-libs/payment-service/src/models/Payment.ts`_
  - _Add: refund fields (`refunded_at`, `refund_amount`, `refund_reason`)_
  - _Requirements: Req 7.1_

- [x] 22. Create reconciliation job — poll providers for stuck payments
  - _File: `shared-libs/payment-service/src/jobs/reconciliation.ts`_
  - _Schedule: every 30 min_
  - _Logic: find pending >30min, query provider, update status_
  - _Requirements: Req 7.3_

- [x] 23. Add admin stats endpoint `GET /api/payment/admin/stats`
  - _File: `shared-libs/payment-service/src/routes/admin.routes.ts`_
  - _Response: revenue per product, conversion rate, method distribution, daily trend_
  - _Requirements: Req 7.4_

- [x] 24. Add webhook retry tracking and alerting
  - _File: `shared-libs/payment-service/src/routes/webhook.routes.ts`_
  - _Track: consecutive webhook failures per provider_
  - _Alert: if > 3 failures → log warning, update status dashboard_
  - _Requirements: Req 7.5_

---

## Phase 5: Service Clients & Consistency (Day 7–9)

*Complete the client matrix.  Standardize error format.*

- [x] 25. Create `service-clients/notification-client.ts`
  - _File: `shared-libs/service-clients/notification-client.ts`_
  - _Exports: `sendNotification()`, `scheduleNotification()`, `cancelScheduled()`_
  - _Pattern: auto-config from env vars, product name as param_
  - _Requirements: Req 8.1_

- [x] 26. Create `service-clients/analytics-client.ts`
  - _File: `shared-libs/service-clients/analytics-client.ts`_
  - _Exports: `trackEvent()`, `recordRevenue()`, `getHealthStatus()`_
  - _Pattern: wraps `@winlux/analytics` with env-based config_
  - _Requirements: Req 8.2_

- [x] 27. Create shared `types/api-response.ts` — unified response format
  - _File: `shared-libs/service-clients/types/api-response.ts`_
  - _Exports: `ApiResponse<T>`, error code constants, `errorHandler` middleware_
  - _Requirements: Req 9.1, 9.3, 9.4_

- [x] 28. Create shared `middleware/error-handler.ts`
  - _File: `shared-libs/service-clients/middleware/error-handler.ts`_
  - _Exports: `sharedErrorHandler()` Express middleware_
  - _Logic: catch errors → format as `ApiResponse` with Vietnamese message_
  - _Requirements: Req 9.2, 9.5_

- [x] 29. Update auth-service to use shared error format
  - _File: `shared-libs/auth-service/src/index.ts`_
  - _Apply: `app.use(sharedErrorHandler)`, update routes to use `ApiResponse`_
  - _Requirements: Req 9.2_

- [x] 30. Update payment-service to use shared error format
  - _File: `shared-libs/payment-service/src/index.ts`_
  - _Apply: same pattern as auth-service_
  - _Requirements: Req 9.2_

---

## Phase 6: Cross-Product DoctorCar Links (Day 9–10)

*Add DoctorCar to existing cross-product link system.*

- [x] 31. Add DoctorCar to `cross-product-links.ts` BASE_URLS
  - _File: `shared-libs/service-clients/cross-product-links.ts`_
  - _Add: `doctorcar: 'https://doctorcar.winlux.com'`_
  - _Requirements: Req 10.5_

- [x] 32. Add SmartBuy → DoctorCar link (auto parts, vehicle keywords)
  - _File: `shared-libs/service-clients/cross-product-links.ts`_
  - _Trigger: keywords ['phụ tùng', 'ô tô', 'xe hơi', 'bảo dưỡng', 'dầu máy']_
  - _Label: "🚗 Kiểm tra xe miễn phí"_
  - _Requirements: Req 10.1_

- [x] 33. Add FIN Tax → DoctorCar link (vehicle expense category)
  - _Same file, add to `case 'fintax':` block_
  - _Trigger: keywords ['bảo dưỡng', 'sửa xe', 'xăng dầu', 'bảo hiểm xe']_
  - _Label: "🚗 Lịch bảo dưỡng thông minh"_
  - _Requirements: Req 10.2_

- [x] 34. Add DoctorCar → SmartBuy + FIN Tax links
  - _Same file, add `case 'doctorcar':` block_
  - _→ SmartBuy: "🛒 Mua phụ tùng giá tốt" (when context has part names)_
  - _→ FIN Tax: "💰 Ghi nhận chi phí bảo dưỡng" (after maintenance)_
  - _Requirements: Req 10.3, 10.4_

---

## Phase 7: Integration Testing & Documentation (Day 10–12)

*Verify everything works together.  Update docs.*

- [x] 35. Integration test:  phone normalization used in auth OTP flow
  - _Verify: OTP send/verify works with all phone formats (0xx, +84xx, 84xx)_
  - _Requirements: Req 1.1_

- [x] 36. Integration test:  Zalo SSO end-to-end (code → JWT)
  - _Verify: Login, merge with phone account, new account creation_
  - _Requirements: Req 4.1, 4.3_

- [x] 37. Integration test:  notification fallback chain
  - _Verify: FCM fail → Zalo OA → SMS works correctly_
  - _Requirements: Req 5.3_

- [x] 38. Integration test:  payment refund flow
  - _Verify: Create payment → mark completed → refund → status is refunded_
  - _Requirements: Req 7.1_

- [x] 39. Update `shared-libs/README.md` with new modules
  - _Add: phone, currency, address to shared-vn-nlp table_
  - _Add: email, SMS channels to notification-service description_
  - _Add: refund flow to payment-service description_
  - _Requirements: All_

- [x] 40. Update `shared-libs/MIGRATION.md` with upgrade notes for product services
  - _Doc: How to adopt new phone normalization, error format, notification channels_
  - _Requirements: All_

---

## Summary

| Phase | Tasks | When | Effort | Dependencies |
|-------|-------|------|--------|-------------|
| 1: VN NLP Quick Wins | 1–6 | Day 1–2 | 2 days | None |
| 2: Zalo SSO | 7–10 | Day 2–3 | 1.5 days | `@winlux/zalo-sdk` |
| 3: Notification Channels | 11–18 | Day 3–5 | 3 days | Resend API key, eSMS config |
| 4: Payment Refund | 19–24 | Day 5–7 | 2.5 days | Provider refund API docs |
| 5: Service Clients | 25–30 | Day 7–9 | 2 days | Phase 3 (notification) |
| 6: DoctorCar Links | 31–34 | Day 9–10 | 1 day | DoctorCar URL confirmed |
| 7: Integration & Docs | 35–40 | Day 10–12 | 2 days | All above phases |

**Total: 40 tasks — 14 days estimated**
