/**
 * Monetization Service - Angular Module Exports
 */

// Service
export { MonetizationService, MonetizationState } from './monetization.service';

// Components
export { AdsenseComponent } from './adsense.component';
export { PricingCardComponent } from './pricing-card.component';
export { PaywallComponent } from './paywall.component';

// Guards
export { premiumGuard, freeOrPremiumGuard, hasSubscriptionGuard } from './premium-guard';

// Providers
export {
  MONETIZATION_CONFIG,
  DEFAULT_MONETIZATION_CONFIG,
  provideMonetization,
  provideAdsense,
  provideMoMoPayment
} from './provider';
