/**
 * Environment Configuration Loader - Nov 2026 Release
 * 
 * Loads configuration from environment variables with validation.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { AppConfig, AppName, Environment, FrontendConfig } from './types';
import {
  SEO_DEFAULTS,
  APP_DOMAINS,
  API_ENDPOINTS,
  MONETIZATION_DEFAULTS,
  ANALYTICS_DEFAULTS,
  CACHE_DEFAULTS,
  RATE_LIMIT_DEFAULTS,
  GA4_MEASUREMENT_IDS,
  createFrontendConfig,
} from './defaults';

// ═══════════════════════════════════════════════════════════════
//  ENVIRONMENT VARIABLE HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get environment variable with fallback
 */
export function getEnv(key: string, fallback = ''): string {
  if (typeof process !== 'undefined' && process.env) {
    return process.env[key] ?? fallback;
  }
  return fallback;
}

/**
 * Get required environment variable (throws if not set)
 */
export function getRequiredEnv(key: string): string {
  const value = getEnv(key);
  if (!value) {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  return value;
}

/**
 * Get boolean environment variable
 */
export function getBoolEnv(key: string, fallback = false): boolean {
  const value = getEnv(key, '').toLowerCase();
  if (value === 'true' || value === '1' || value === 'yes') return true;
  if (value === 'false' || value === '0' || value === 'no') return false;
  return fallback;
}

/**
 * Get number environment variable
 */
export function getNumberEnv(key: string, fallback: number): number {
  const value = getEnv(key);
  if (!value) return fallback;
  const num = parseInt(value, 10);
  return isNaN(num) ? fallback : num;
}

/**
 * Detect current environment
 */
export function detectEnvironment(): Environment {
  const nodeEnv = getEnv('NODE_ENV', 'development').toLowerCase();
  
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return 'production';
  }
  if (nodeEnv === 'staging' || nodeEnv === 'stage') {
    return 'staging';
  }
  return 'development';
}

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION LOADER
// ═══════════════════════════════════════════════════════════════

/**
 * Load full application configuration from environment
 */
export function loadConfig(app: AppName): AppConfig {
  const env = detectEnvironment();
  const envKey = env === 'development' ? 'dev' : env === 'staging' ? 'staging' : 'prod';
  
  return {
    // Base config
    appName: app,
    environment: env,
    version: getEnv('APP_VERSION', '1.0.0'),
    debug: getBoolEnv('DEBUG', env === 'development'),
    baseUrl: getEnv('BASE_URL', APP_DOMAINS[app][envKey]),
    apiUrl: getEnv('API_URL', API_ENDPOINTS[app][envKey]),
    
    // Monetization
    monetization: {
      adsenseEnabled: getBoolEnv('ADSENSE_ENABLED', MONETIZATION_DEFAULTS.adsenseEnabled),
      adsenseClientId: getEnv('ADSENSE_CLIENT_ID', MONETIZATION_DEFAULTS.adsenseClientId),
      premiumEnabled: getBoolEnv('PREMIUM_ENABLED', MONETIZATION_DEFAULTS.premiumEnabled),
      premiumPriceVND: getNumberEnv('PREMIUM_PRICE_VND', MONETIZATION_DEFAULTS.premiumPriceVND),
      payment: {
        momoPartnerCode: getEnv('MOMO_PARTNER_CODE', ''),
        momoAccessKey: getEnv('MOMO_ACCESS_KEY', ''),
        momoEndpoint: getEnv('MOMO_ENDPOINT', MONETIZATION_DEFAULTS.payment.momoEndpoint),
      },
    },
    
    // Analytics
    analytics: {
      ga4MeasurementId: getEnv('GA4_MEASUREMENT_ID', GA4_MEASUREMENT_IDS[app]),
      enabled: getBoolEnv('ANALYTICS_ENABLED', ANALYTICS_DEFAULTS.enabled),
      debug: getBoolEnv('ANALYTICS_DEBUG', env === 'development'),
      customDimensions: ANALYTICS_DEFAULTS.customDimensions,
    },
    
    // SEO
    seo: {
      ...SEO_DEFAULTS[app],
      canonicalBase: getEnv('CANONICAL_BASE', SEO_DEFAULTS[app].canonicalBase),
    },
    
    // Database
    database: {
      mongoUri: getEnv('MONGODB_URI', 'mongodb://localhost:27017'),
      dbName: getEnv('DB_NAME', `${app}_db`),
      redisUri: getEnv('REDIS_URI', ''),
    },
    
    // Cache
    cache: {
      enabled: getBoolEnv('CACHE_ENABLED', CACHE_DEFAULTS.enabled),
      defaultTtl: getNumberEnv('CACHE_TTL', CACHE_DEFAULTS.defaultTtl),
      driver: (getEnv('CACHE_DRIVER', CACHE_DEFAULTS.driver) as 'memory' | 'redis'),
      redis: getEnv('REDIS_URI') ? {
        host: getEnv('REDIS_HOST', 'localhost'),
        port: getNumberEnv('REDIS_PORT', 6379),
        password: getEnv('REDIS_PASSWORD', ''),
      } : undefined,
    },
    
    // Rate limiting
    rateLimit: {
      enabled: getBoolEnv('RATE_LIMIT_ENABLED', RATE_LIMIT_DEFAULTS.enabled),
      maxRequests: getNumberEnv('RATE_LIMIT_MAX', RATE_LIMIT_DEFAULTS.maxRequests),
      windowSeconds: getNumberEnv('RATE_LIMIT_WINDOW', RATE_LIMIT_DEFAULTS.windowSeconds),
      skipPremium: getBoolEnv('RATE_LIMIT_SKIP_PREMIUM', RATE_LIMIT_DEFAULTS.skipPremium),
    },
    
    // External services (ALL DISABLED for Nov 2026)
    externalServices: {
      openai: {
        apiKey: getEnv('OPENAI_API_KEY', ''),
        model: getEnv('OPENAI_MODEL', 'gpt-4'),
        enabled: false, // ALWAYS false for Nov 2026
      },
      googleCloud: {
        projectId: getEnv('GOOGLE_CLOUD_PROJECT', ''),
        apiKey: getEnv('GOOGLE_CLOUD_API_KEY', ''),
        enabled: false, // ALWAYS false for Nov 2026
      },
    },
  };
}

/**
 * Load frontend-safe configuration (no secrets)
 */
export function loadFrontendConfig(app: AppName): FrontendConfig {
  const env = detectEnvironment();
  return createFrontendConfig(app, env);
}

// ═══════════════════════════════════════════════════════════════
//  VALIDATION
// ═══════════════════════════════════════════════════════════════

export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Validate configuration for production readiness
 */
export function validateConfig(config: AppConfig): ConfigValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Required for production
  if (config.environment === 'production') {
    if (!config.database.mongoUri || config.database.mongoUri.includes('localhost')) {
      errors.push('Production requires a remote MongoDB URI');
    }
    
    if (config.monetization.adsenseEnabled && !config.monetization.adsenseClientId) {
      warnings.push('AdSense is enabled but client ID is not set');
    }
    
    if (config.monetization.premiumEnabled && !config.monetization.payment.momoPartnerCode) {
      errors.push('Premium is enabled but MoMo partner code is not set');
    }
    
    if (config.analytics.enabled && !config.analytics.ga4MeasurementId) {
      warnings.push('Analytics is enabled but GA4 measurement ID is not set');
    }
    
    if (config.debug) {
      warnings.push('Debug mode is enabled in production');
    }
  }
  
  // Check AI services are disabled (Nov 2026 requirement)
  if (config.externalServices.openai?.enabled) {
    errors.push('OpenAI must be disabled for Nov 2026 release');
  }
  
  if (config.externalServices.googleCloud?.enabled) {
    errors.push('Google Cloud AI services must be disabled for Nov 2026 release');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
