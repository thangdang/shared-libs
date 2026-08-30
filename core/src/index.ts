/**
 * @winlux/core
 *
 * Unified shared library for all WinLux products.
 * Consolidates: auth, payment, notification, analytics, zalo-sdk
 *
 * Usage (single import):
 *   import {
 *     // Auth
 *     TokenService, verifyGoogleToken, requireAuth,
 *     // Payment
 *     SepayProvider, MoMoProvider, createPaymentRoutes,
 *     // Notification
 *     NotificationClient, FCMProvider,
 *     // Analytics
 *     Analytics, RevenueTracker,
 *     // Zalo
 *     ZaloSSO, ZaloOA,
 *   } from '@winlux/core';
 *
 * Usage (module imports for tree-shaking):
 *   import { TokenService, requireAuth } from '@winlux/core/auth';
 *   import { SepayProvider } from '@winlux/core/payment';
 *   import { NotificationClient } from '@winlux/core/notification';
 *   import { Analytics } from '@winlux/core/analytics';
 *   import { ZaloSSO } from '@winlux/core/zalo';
 */

// ═══════════════════════════════════════════════════════════════════════════════
// AUTH MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Services
  GoogleService,
  verifyGoogleToken,
  ZaloService,
  authenticateWithZalo,
  OTPService,
  sendOTP,
  verifyOTP,
  TokenService,
  generateToken,
  verifyToken,
  refreshToken,
  // Middleware
  requireAuth,
  optionalAuth,
  // Route Factories
  createAuthRoutes,
  createUserRoutes,
  createTokenRoutes,
  // Schema
  createUserSchema,
  UserSchemaFields,
} from './auth/index.js';

export type {
  AuthConfig,
  GoogleUser,
  ZaloAuthInput,
  ZaloAuthResult,
  TokenPayload,
  AuthenticatedRequest,
  IUser,
} from './auth/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// PAYMENT MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Providers
  SepayProvider,
  createSepayPayment,
  verifySepayWebhook,
  verifySepaySignature,
  MoMoProvider,
  createMoMoPayment,
  verifyMoMoWebhook,
  ZaloPayProvider,
  createZaloPayPayment,
  verifyZaloPayCallback,
  PayOSProvider,
  createPayOSPayment,
  verifyPayOSWebhook,
  StripeProvider,
  createStripeCheckout,
  verifyStripeWebhook,
  // Refund
  processProviderRefund,
  RefundService,
  // Route Factories
  createPaymentRoutes,
  createWebhookRoutes,
  createAdminRoutes,
  // Reconciliation
  reconcile,
  startReconciliation,
  stopReconciliation,
  ReconciliationService,
  // Webhook Tracker
  WebhookTracker,
  createWebhookTracker,
  // Schema
  createPaymentSchema,
  PaymentSchemaFields,
  // Plans
  PRODUCT_PLANS,
  getPlansByProduct,
} from './payment/index.js';

export type {
  PaymentConfig,
  PaymentMethod,
  PaymentStatus,
  IPayment,
  CreatePaymentInput,
  CreatePaymentResult,
  RefundRequest,
  RefundResult,
  ProviderStatusResult,
  ReconciliationResult,
  WebhookVerifyResult,
} from './payment/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  // Client
  NotificationClient,
  // Providers
  FCMProvider,
  ZaloOAProvider,
  SMSProvider,
  EmailProvider,
  TelegramProvider,
  // Scheduler
  NotificationScheduler,
  parseDuration,
  getCurrentVNTime,
  getVNHour,
  // Digest
  NotificationDigest,
  createDigest,
  buildDigestKey,
  // Services
  DedupService,
  RateLimiter,
  DeepLinkBuilder,
} from './notification/index.js';

export type {
  NotificationPayload,
  NotificationResult,
  NotificationConfig,
  NotificationType,
  NotificationPriority,
  NotificationSeverity,
  NotificationProvider,
  SendResult,
  ESMSType,
  SMSSendOptions,
  EmailPayload,
  ScheduleOptions,
  ScheduledJob,
  DigestConfig,
  DigestCallback,
} from './notification/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  Analytics,
  RevenueTracker,
  HealthChecker,
  TrendScanner,
} from './analytics/index.js';

export type {
  AnalyticsEvent,
  RevenueEvent,
  AnalyticsConfig,
  HealthStatus,
  Trend,
  TrendSuggestion,
  TrendScannerConfig,
} from './analytics/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// ZALO MODULE
// ═══════════════════════════════════════════════════════════════════════════════

export {
  ZaloSSO,
  ZaloOA,
  ZaloShareCard,
  ZaloWebhook,
} from './zalo/index.js';

export type {
  ZaloUser,
  ZaloConfig,
  ZaloShareData,
} from './zalo/index.js';

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS MODULE — Cross-product HTTP clients
// ═══════════════════════════════════════════════════════════════════════════════

export * from './clients/auth-client.js';
export * from './clients/payment-client.js';
export * from './clients/notification-client.js';
export * from './clients/analytics-client.js';
export * from './clients/cross-product-links.js';

// ═══════════════════════════════════════════════════════════════════════════════
// RESILIENCE MODULE — Offline resilience patterns
// ═══════════════════════════════════════════════════════════════════════════════

export * from './resilience/services/offlineResilience.js';
export * from './resilience/services/emergencyDetector.js';
