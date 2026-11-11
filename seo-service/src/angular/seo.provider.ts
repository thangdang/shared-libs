/**
 * Angular SEO Provider - Nov 2026 Release
 * 
 * Provider configuration for Angular SEO service.
 * 
 * Usage in app.config.ts:
 * ```typescript
 * import { provideSeo } from '@shared/seo-service/angular';
 * 
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideSeo({ app: 'trendbrief' }),
 *   ],
 * };
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { InjectionToken, EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import type { SEOServiceConfig } from '../types';
import { APP_SEO_CONFIGS } from '../defaults';

type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface SeoProviderConfig {
  /** Which app is using this service */
  app: AppName;
  
  /** Custom config overrides */
  overrides?: Partial<SEOServiceConfig>;
}

export const SEO_CONFIG = new InjectionToken<SEOServiceConfig>('SEO_CONFIG');

// ═══════════════════════════════════════════════════════════════
//  PROVIDERS
// ═══════════════════════════════════════════════════════════════

/**
 * Provide SEO configuration for Angular app
 */
export function provideSeo(config: SeoProviderConfig): EnvironmentProviders {
  const appConfig = APP_SEO_CONFIGS[config.app];
  const finalConfig: SEOServiceConfig = {
    ...appConfig,
    ...config.overrides,
  };

  return makeEnvironmentProviders([
    {
      provide: SEO_CONFIG,
      useValue: finalConfig,
    },
  ]);
}
