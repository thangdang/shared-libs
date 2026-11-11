/**
 * Angular Feature Flag Provider - Nov 2026 Release
 * 
 * Provider configuration for Angular applications.
 * 
 * Usage in app.config.ts:
 * ```typescript
 * import { provideFeatureFlags } from '@shared/feature-flags/angular';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideFeatureFlags({
 *       app: 'trendbrief',
 *     }),
 *   ],
 * };
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { InjectionToken, Provider, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { AllFeatureFlags, AppName } from '../types';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface FeatureFlagsConfig {
  /** Which app is using this library */
  app: AppName;
  
  /** Custom flag overrides (for development/testing) */
  customFlags?: Partial<AllFeatureFlags>;
  
  /** Enable debug logging */
  debug?: boolean;
}

export const FEATURE_FLAGS_CONFIG = new InjectionToken<FeatureFlagsConfig>(
  'FEATURE_FLAGS_CONFIG'
);

// ═══════════════════════════════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Provide feature flags configuration for Angular app
 * 
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideFeatureFlags } from '@shared/feature-flags/angular';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideFeatureFlags({ app: 'trendbrief' }),
 *   ],
 * };
 * ```
 */
export function provideFeatureFlags(config: FeatureFlagsConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: FEATURE_FLAGS_CONFIG,
      useValue: config,
    },
  ]);
}

/**
 * Provide feature flags as regular providers (for testing or modules)
 */
export function provideFeatureFlagsLegacy(config: FeatureFlagsConfig): Provider[] {
  return [
    {
      provide: FEATURE_FLAGS_CONFIG,
      useValue: config,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
//  APP-SPECIFIC PROVIDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Quick provider for TrendBrief app
 */
export function provideTrendBriefFlags(options?: Partial<FeatureFlagsConfig>): EnvironmentProviders {
  return provideFeatureFlags({
    app: 'trendbrief',
    ...options,
  });
}

/**
 * Quick provider for SmartBuy app
 */
export function provideSmartBuyFlags(options?: Partial<FeatureFlagsConfig>): EnvironmentProviders {
  return provideFeatureFlags({
    app: 'smartbuy',
    ...options,
  });
}

/**
 * Quick provider for FinTax app
 */
export function provideFinTaxFlags(options?: Partial<FeatureFlagsConfig>): EnvironmentProviders {
  return provideFeatureFlags({
    app: 'fintax',
    ...options,
  });
}

/**
 * Quick provider for DoctorCar app
 */
export function provideDoctorCarFlags(options?: Partial<FeatureFlagsConfig>): EnvironmentProviders {
  return provideFeatureFlags({
    app: 'doctorcar',
    ...options,
  });
}

/**
 * Quick provider for CareMate app
 */
export function provideCareMateFlags(options?: Partial<FeatureFlagsConfig>): EnvironmentProviders {
  return provideFeatureFlags({
    app: 'caremate',
    ...options,
  });
}
