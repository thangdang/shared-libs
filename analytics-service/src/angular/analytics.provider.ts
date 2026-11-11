/**
 * Angular Analytics Provider - Nov 2026 Release
 * 
 * Provider configuration for Angular Analytics service.
 * 
 * Usage in app.config.ts:
 * ```typescript
 * import { provideAnalytics } from '@shared/analytics-service/angular';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAnalytics({ app: 'trendbrief' }),
 *   ],
 * };
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { InjectionToken, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { AnalyticsConfig } from '../types';
import { ANALYTICS_CONFIGS } from '../defaults';

type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface AnalyticsProviderConfig {
  /** Which app is using this service */
  app: AppName;
  
  /** Custom measurement ID (overrides default) */
  measurementId?: string;
  
  /** Custom config overrides */
  overrides?: Partial<AnalyticsConfig>;
}

export const ANALYTICS_CONFIG = new InjectionToken<AnalyticsConfig>('ANALYTICS_CONFIG');

// ═══════════════════════════════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Provide analytics configuration for Angular app
 */
export function provideAnalytics(config: AnalyticsProviderConfig): EnvironmentProviders {
  const appConfig = ANALYTICS_CONFIGS[config.app];
  const finalConfig: AnalyticsConfig = {
    ...appConfig,
    ...(config.measurementId && { measurementId: config.measurementId }),
    ...config.overrides,
  };

  return makeEnvironmentProviders([
    {
      provide: ANALYTICS_CONFIG,
      useValue: finalConfig,
    },
  ]);
}

// ═══════════════════════════════════════════════════════════════
//  APP-SPECIFIC PROVIDERS
// ═══════════════════════════════════════════════════════════════

export function provideTrendBriefAnalytics(overrides?: Partial<AnalyticsConfig>): EnvironmentProviders {
  return provideAnalytics({ app: 'trendbrief', overrides });
}

export function provideSmartBuyAnalytics(overrides?: Partial<AnalyticsConfig>): EnvironmentProviders {
  return provideAnalytics({ app: 'smartbuy', overrides });
}

export function provideFinTaxAnalytics(overrides?: Partial<AnalyticsConfig>): EnvironmentProviders {
  return provideAnalytics({ app: 'fintax', overrides });
}

export function provideDoctorCarAnalytics(overrides?: Partial<AnalyticsConfig>): EnvironmentProviders {
  return provideAnalytics({ app: 'doctorcar', overrides });
}

export function provideCareMateAnalytics(overrides?: Partial<AnalyticsConfig>): EnvironmentProviders {
  return provideAnalytics({ app: 'caremate', overrides });
}
