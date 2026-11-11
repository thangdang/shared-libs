/**
 * Shared Feature Flags Library
 * Exports all feature flag related services, directives, and middleware
 */

// Services
export {
  FeatureFlagService,
  FeatureFlags,
  DEFAULT_FEATURE_FLAGS,
  createNodeFeatureFlagService
} from './services/feature-flag.service';

// Directives
export {
  FeatureFlagDirective,
  FeatureFlagHideDirective,
  FeatureFlagAnyDirective,
  FeatureFlagAllDirective,
  FEATURE_FLAG_DIRECTIVES
} from './directives/feature-flag.directive';

// Middleware (for Express backend)
export {
  requireFeature,
  requireAnyFeature,
  createFeatureFlagService,
  disabledEndpointResponse,
  trendBriefDisabledEndpoints,
  smartBuyDisabledEndpoints,
  finTaxDisabledEndpoints,
  doctorCarDisabledEndpoints,
  careMateDisabledEndpoints,
  FeatureFlagService as FeatureFlagServiceInterface,
  RequireFeatureOptions
} from './middleware/require-feature.middleware';
