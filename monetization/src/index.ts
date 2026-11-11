/**
 * Shared Monetization Library
 * Exports all payment, subscription, and affiliate services/components
 */

// Payment Services
export { VNPayService, VNPayConfig, CreatePaymentRequest as VNPayCreateRequest, PaymentResult as VNPayPaymentResult } from './services/vnpay.service';
export { MoMoService, MoMoConfig, CreatePaymentRequest as MoMoCreateRequest, PaymentResponse as MoMoPaymentResponse } from './services/momo.service';

// Subscription Services
export {
  SubscriptionService,
  SubscriptionTier,
  Subscription,
  SubscriptionPayment,
  SUBSCRIPTION_TIERS
} from './services/subscription.service';

// Affiliate Services
export { AffiliateApiService, AffiliateConfig, AffiliateLink, AffiliateClick } from './services/affiliate-api.service';

// Schemas
export { Payment, IPayment } from './schemas/payment.schema';
export { Subscription as SubscriptionModel, ISubscription, SubscriptionTier as SubscriptionTierType, SubscriptionStatus } from './schemas/subscription.schema';

// Components
export { PricingPageComponent } from './components/pricing-page/pricing-page.component';
export { AffiliateDashboardComponent } from './components/affiliate-dashboard/affiliate-dashboard.component';
export { CheckoutFlowComponent } from './components/checkout-flow/checkout-flow.component';
export { MySubscriptionComponent } from './components/my-subscription/my-subscription.component';
export { PremiumBadgeComponent } from './components/premium-badge/premium-badge.component';
export { FeatureGateComponent } from './components/feature-gate/feature-gate.component';
