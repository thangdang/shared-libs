/**
 * Analytics Service Defaults - Nov 2026 Release
 * 
 * Default configurations for all 5 AI apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { AnalyticsConfig } from './types';

type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  GA4 MEASUREMENT IDS
// ═══════════════════════════════════════════════════════════════

export const GA4_MEASUREMENT_IDS: Record<AppName, string> = {
  trendbrief: 'G-TRENDBRIEF01', // Replace with actual production IDs
  smartbuy: 'G-SMARTBUY0001',
  fintax: 'G-FINTAX000001',
  doctorcar: 'G-DOCTORCAR001',
  caremate: 'G-CAREMATE0001',
};

// ═══════════════════════════════════════════════════════════════
//  DEFAULT CONFIGS PER APP
// ═══════════════════════════════════════════════════════════════

export const ANALYTICS_CONFIGS: Record<AppName, AnalyticsConfig> = {
  trendbrief: {
    measurementId: GA4_MEASUREMENT_IDS.trendbrief,
    enabled: true,
    debug: false,
    appName: 'TrendBrief AI',
    appVersion: '1.0.0',
    customDimensions: {
      user_type: 'user_type',
      app_version: 'app_version',
      content_type: 'content_type',
      topic_category: 'topic_category',
    },
    defaultUserProperties: {
      app_name: 'trendbrief',
      platform: 'web',
      language: 'vi',
    },
    consentMode: {
      analyticsStorage: 'granted',
      adStorage: 'denied',
    },
  },

  smartbuy: {
    measurementId: GA4_MEASUREMENT_IDS.smartbuy,
    enabled: true,
    debug: false,
    appName: 'SmartBuy AI',
    appVersion: '1.0.0',
    customDimensions: {
      user_type: 'user_type',
      app_version: 'app_version',
      product_category: 'product_category',
      marketplace: 'marketplace',
    },
    defaultUserProperties: {
      app_name: 'smartbuy',
      platform: 'web',
      language: 'vi',
    },
    consentMode: {
      analyticsStorage: 'granted',
      adStorage: 'denied',
    },
  },

  fintax: {
    measurementId: GA4_MEASUREMENT_IDS.fintax,
    enabled: true,
    debug: false,
    appName: 'FinTax AI',
    appVersion: '1.0.0',
    customDimensions: {
      user_type: 'user_type',
      app_version: 'app_version',
      tax_year: 'tax_year',
      transaction_type: 'transaction_type',
    },
    defaultUserProperties: {
      app_name: 'fintax',
      platform: 'web',
      language: 'vi',
    },
    consentMode: {
      analyticsStorage: 'granted',
      adStorage: 'denied',
    },
  },

  doctorcar: {
    measurementId: GA4_MEASUREMENT_IDS.doctorcar,
    enabled: true,
    debug: false,
    appName: 'DoctorCar AI',
    appVersion: '1.0.0',
    customDimensions: {
      user_type: 'user_type',
      app_version: 'app_version',
      vehicle_brand: 'vehicle_brand',
      dtc_code: 'dtc_code',
    },
    defaultUserProperties: {
      app_name: 'doctorcar',
      platform: 'web',
      language: 'vi',
    },
    consentMode: {
      analyticsStorage: 'granted',
      adStorage: 'denied',
    },
  },

  caremate: {
    measurementId: GA4_MEASUREMENT_IDS.caremate,
    enabled: true,
    debug: false,
    appName: 'CareMate AI',
    appVersion: '1.0.0',
    customDimensions: {
      user_type: 'user_type',
      app_version: 'app_version',
      drug_category: 'drug_category',
      health_topic: 'health_topic',
    },
    defaultUserProperties: {
      app_name: 'caremate',
      platform: 'web',
      language: 'vi',
    },
    consentMode: {
      analyticsStorage: 'granted',
      adStorage: 'denied',
    },
  },
};

// ═══════════════════════════════════════════════════════════════
//  FACTORY FUNCTION
// ═══════════════════════════════════════════════════════════════

/**
 * Create analytics config with custom measurement ID
 */
export function createAnalyticsConfig(
  app: AppName, 
  measurementId?: string,
  overrides?: Partial<AnalyticsConfig>
): AnalyticsConfig {
  const base = ANALYTICS_CONFIGS[app];
  return {
    ...base,
    measurementId: measurementId || base.measurementId,
    ...overrides,
  };
}
