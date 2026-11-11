/**
 * Affiliate Service Provider
 * Angular dependency injection setup
 */

import { Provider, InjectionToken, makeEnvironmentProviders, EnvironmentProviders } from '@angular/core';
import { AffiliateServiceConfig, AffiliatePlatform } from '../types';

/**
 * Injection token for affiliate configuration
 */
export const AFFILIATE_CONFIG = new InjectionToken<AffiliateServiceConfig>('AFFILIATE_CONFIG');

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AffiliateServiceConfig = {
  apiEndpoint: '/api/affiliate',
  platforms: {},
  trackingEnabled: true,
  clickTTL: 30 * 24 * 60 * 60 // 30 days
};

/**
 * Provide affiliate service with configuration
 * 
 * @example
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideAffiliate({
 *       apiEndpoint: '/api/affiliate',
 *       platforms: {
 *         shopee: {
 *           platform: AffiliatePlatform.SHOPEE,
 *           affiliateId: 'YOUR_SHOPEE_ID',
 *           enabled: true
 *         }
 *       }
 *     })
 *   ]
 * };
 */
export function provideAffiliate(config?: Partial<AffiliateServiceConfig>): EnvironmentProviders {
  const mergedConfig: AffiliateServiceConfig = {
    ...DEFAULT_CONFIG,
    ...config,
    platforms: {
      ...DEFAULT_CONFIG.platforms,
      ...config?.platforms
    }
  };

  return makeEnvironmentProviders([
    {
      provide: AFFILIATE_CONFIG,
      useValue: mergedConfig
    }
  ]);
}

/**
 * Provide affiliate configuration only
 */
export function provideAffiliateConfig(config: AffiliateServiceConfig): Provider {
  return {
    provide: AFFILIATE_CONFIG,
    useValue: config
  };
}
