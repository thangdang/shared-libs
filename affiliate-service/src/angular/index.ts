/**
 * Affiliate Service - Angular Module Exports
 */

// Service
export { AffiliateAngularService } from './affiliate.service';

// Components
export { AffiliateLinkComponent } from './affiliate-link.component';
export { AffiliateButtonComponent } from './affiliate-button.component';

// Directives
export { AffiliateTrackDirective } from './affiliate-track.directive';

// Providers
export {
  AFFILIATE_CONFIG,
  provideAffiliate,
  provideAffiliateConfig
} from './provider';
