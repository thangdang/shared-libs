/**
 * @winlux/payment
 *
 * Shared payment library for all WinLux products.
 * Provides reusable payment providers, webhook handlers, and route factories.
 *
 * Usage in apps:
 *
 *   import {
 *     createPaymentRoutes,
 *     createWebhookRoutes,
 *     SepayProvider,
 *     MoMoProvider,
 *     StripeProvider,
 *     processRefund,
 *   } from '@winlux/payment';
 *
 *   // Mount payment routes (optional)
 *   app.use('/api/payment', createPaymentRoutes({ paymentModel, config }));
 *   app.use('/api/payment/webhook', createWebhookRoutes({ paymentModel, config }));
 *
 *   // Or use providers directly
 *   const { checkoutUrl, qrCode } = await SepayProvider.createPayment({...});
 */

// ─── Providers ───
export {
  SepayProvider,
  createSepayPayment,
  verifySepayWebhook,
  verifySepaySignature,
} from './providers/sepay.js';

export {
  MoMoProvider,
  createMoMoPayment,
  verifyMoMoWebhook,
} from './providers/momo.js';

export {
  ZaloPayProvider,
  createZaloPayPayment,
  verifyZaloPayCallback,
} from './providers/zalopay.js';

export {
  PayOSProvider,
  createPayOSPayment,
  verifyPayOSWebhook,
} from './providers/payos.js';

export {
  StripeProvider,
  createStripeCheckout,
  verifyStripeWebhook,
} from './providers/stripe.js';

// ─── Refund ───
export {
  processProviderRefund,
  RefundService,
} from './providers/refund.js';

// ─── Route Factories ───
export { createPaymentRoutes } from './routes/payment.routes.js';
export { createWebhookRoutes } from './routes/webhook.routes.js';
export { createAdminRoutes } from './routes/admin.routes.js';

// ─── Reconciliation ───
export {
  reconcile,
  startReconciliation,
  stopReconciliation,
  ReconciliationService,
} from './jobs/reconciliation.js';

// ─── Webhook Tracker ───
export { WebhookTracker, createWebhookTracker } from './webhook-tracker.js';

// ─── Types ───
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
} from './types.js';

// ─── Schema (optional — apps can use their own Payment model) ───
export { createPaymentSchema, PaymentSchemaFields } from './models/payment.schema.js';

// ─── Plans ───
export { PRODUCT_PLANS, getPlansByProduct } from './plans.js';
