/**
 * Monetization Service Library - Nov 2026 Release
 * 
 * Shared monetization service for all 5 AI apps:
 * - MoMo Payment Integration
 * - Google AdSense Integration
 * - Premium Subscription Management
 * 
 * @author Solo Dev
 * @release Nov 2026
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type {
  MonetizationConfig,
  AppName,
  PremiumSubscription,
  SubscriptionStatus,
  PaymentMethod,
  MoMoPaymentRequest,
  MoMoPaymentResponse,
  MoMoIPNCallback,
  AdSlot,
  AdConfig,
  PricingPlan,
  PlanFeature,
  PremiumBenefits,
} from './types';

export { PREMIUM_BENEFITS } from './types';

// ═══════════════════════════════════════════════════════════════
//  MOMO PAYMENT SERVICE (Backend)
// ═══════════════════════════════════════════════════════════════

export { MoMoPaymentService } from './momo/momo.service';
export { createMoMoMiddleware, momoIPNHandler } from './momo/momo.middleware';

// ═══════════════════════════════════════════════════════════════
//  PRICING
// ═══════════════════════════════════════════════════════════════

export {
  FREE_PLAN,
  PREMIUM_PLAN,
  PRICING_PLANS,
  formatPriceVND,
  getPremiumPrice,
} from './pricing';

// ═══════════════════════════════════════════════════════════════
//  ADSENSE
// ═══════════════════════════════════════════════════════════════

export {
  AD_SLOTS,
  getAdConfig,
} from './adsense/adsense.config';

// ═══════════════════════════════════════════════════════════════
//  VNPAY PAYMENT SERVICE (Backend)
// ═══════════════════════════════════════════════════════════════

export {
  VNPayService,
  createVNPayService
} from './vnpay/vnpay.service';

export {
  vnpayReturnHandler,
  vnpayIpnHandler,
  vnpayCreatePaymentHandler,
  createVNPayRouterConfig
} from './vnpay/vnpay.middleware';

export type {
  VNPayConfig,
  VNPayPaymentRequest,
  VNPayReturnParams,
  VNPayQueryRequest,
  VNPayQueryResponse,
  VNPayRefundRequest
} from './vnpay/vnpay.types';

export {
  VNPayResponseCode,
  VNPayTransactionStatus,
  VNPayBankCode,
  VNPAY_RESPONSE_MESSAGES
} from './vnpay/vnpay.types';
