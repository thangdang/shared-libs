/**
 * Environment Configuration Library - Nov 2026 Release
 * 
 * Shared environment configuration for all 5 AI apps:
 * - TrendBrief AI (News Aggregation)
 * - SmartBuy AI (Shopping Comparison)
 * - FinTax AI (Personal Finance & Tax)
 * - DoctorCar AI (Vehicle Diagnostics)
 * - CareMate AI (Health & Pharmacy)
 * 
 * @author Solo Dev
 * @release Nov 2026
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type {
  Environment,
  AppName,
  BaseConfig,
  MonetizationConfig,
  AnalyticsConfig,
  SEOConfig,
  DatabaseConfig,
  CacheConfig,
  RateLimitConfig,
  ExternalServicesConfig,
  AppConfig,
  FrontendConfig,
} from './types';

// ═══════════════════════════════════════════════════════════════
//  DEFAULTS
// ═══════════════════════════════════════════════════════════════

export {
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
//  CONFIG LOADER
// ═══════════════════════════════════════════════════════════════

export {
  getEnv,
  getRequiredEnv,
  getBoolEnv,
  getNumberEnv,
  detectEnvironment,
  loadConfig,
  loadFrontendConfig,
  validateConfig,
} from './config-loader';

export type { ConfigValidationResult } from './config-loader';
