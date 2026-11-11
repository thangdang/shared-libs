/**
 * Angular Feature Flags Module - Nov 2026 Release
 * 
 * Angular components for feature flag integration.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

export { FeatureFlagService as AngularFeatureFlagService } from './feature-flag.service';
export { FeatureFlagDirective } from './feature-flag.directive';
export { FeatureFlagGuard, featureFlagGuard } from './feature-flag.guard';
export { provideFeatureFlags, FEATURE_FLAGS_CONFIG } from './feature-flag.provider';
