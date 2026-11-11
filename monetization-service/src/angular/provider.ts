/**
 * Monetization Service Provider
 * Provides configuration for monetization service in Angular applications
 */

import { Provider, InjectionToken, makeEnvironmentProviders, EnvironmentProviders } from '@angular/core';
import { MonetizationConfig } from '../types';

/**
 * Injection token for monetization configuration
 */
export const MONETIZATION_CONFIG = new InjectionToken<MonetizationConfig>('MONETIZATION_CONFIG');

/**
 * Default monetization configuration
 */
export const DEFAULT_MONETIZATION_CONFIG: MonetizationConfig = {
  apiEndpoint: '/api/monetization',
  momoConfig: {
    partnerCode: '',
    accessKey: '',
    secretKey: '',
    redirectUrl: '',
    ipnUrl: '',
    requestType: 'captureWallet',
    environment: 'sandbox'
  },
  adsenseConfig: {
    clientId: '',
    enabled: false,
    testMode: true
  }
};

/**
 * Provide monetization service with configuration
 * 
 * @example
 * // In app.config.ts
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideMonetization({
 *       apiEndpoint: environment.monetizationApi,
 *       momoConfig: {
 *         partnerCode: environment.momoPartnerCode,
 *         // ... other MoMo config
 *       },
 *       adsenseConfig: {
 *         clientId: environment.adsenseClientId,
 *         enabled: true,
 *         testMode: !environment.production
 *       }
 *     })
 *   ]
 * };
 */
export function provideMonetization(config?: Partial<MonetizationConfig>): EnvironmentProviders {
  const mergedConfig: MonetizationConfig = {
    ...DEFAULT_MONETIZATION_CONFIG,
    ...config,
    momoConfig: {
      ...DEFAULT_MONETIZATION_CONFIG.momoConfig,
      ...config?.momoConfig
    },
    adsenseConfig: {
      ...DEFAULT_MONETIZATION_CONFIG.adsenseConfig,
      ...config?.adsenseConfig
    }
  };

  return makeEnvironmentProviders([
    {
      provide: MONETIZATION_CONFIG,
      useValue: mergedConfig
    }
  ]);
}

/**
 * Feature providers for specific monetization features
 */
export function provideAdsense(clientId: string, testMode = false): Provider[] {
  return [
    {
      provide: 'ADSENSE_CLIENT_ID',
      useValue: clientId
    },
    {
      provide: 'ADSENSE_TEST_MODE',
      useValue: testMode
    }
  ];
}

export function provideMoMoPayment(config: {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  redirectUrl: string;
  ipnUrl: string;
  environment?: 'sandbox' | 'production';
}): Provider[] {
  return [
    {
      provide: 'MOMO_CONFIG',
      useValue: {
        ...config,
        environment: config.environment || 'sandbox',
        requestType: 'captureWallet'
      }
    }
  ];
}
