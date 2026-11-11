/**
 * Environment Configuration Types - Nov 2026 Release
 * 
 * Shared types for environment configuration across all 5 AI apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  ENVIRONMENT NAMES
// ═══════════════════════════════════════════════════════════════

export type Environment = 'development' | 'staging' | 'production';

export type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  BASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface BaseConfig {
  /** Application name */
  appName: AppName;
  
  /** Current environment */
  environment: Environment;
  
  /** Application version */
  version: string;
  
  /** Is debug mode enabled */
  debug: boolean;
  
  /** Base URL for the application */
  baseUrl: string;
  
  /** API base URL */
  apiUrl: string;
}

// ═══════════════════════════════════════════════════════════════
//  MONETIZATION CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface MonetizationConfig {
  /** Enable Google AdSense */
  adsenseEnabled: boolean;
  
  /** AdSense client ID */
  adsenseClientId: string;
  
  /** Enable premium subscription */
  premiumEnabled: boolean;
  
  /** Premium price in VND */
  premiumPriceVND: number;
  
  /** Payment gateway (MoMo) */
  payment: {
    /** MoMo partner code */
    momoPartnerCode: string;
    /** MoMo access key */
    momoAccessKey: string;
    /** MoMo endpoint */
    momoEndpoint: string;
  };
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface AnalyticsConfig {
  /** Google Analytics 4 Measurement ID */
  ga4MeasurementId: string;
  
  /** Enable analytics */
  enabled: boolean;
  
  /** Enable debug mode for analytics */
  debug: boolean;
  
  /** Custom dimensions */
  customDimensions: {
    userType: string;
    appVersion: string;
    environment: string;
  };
}

// ═══════════════════════════════════════════════════════════════
//  SEO CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface SEOConfig {
  /** Default page title */
  defaultTitle: string;
  
  /** Title suffix */
  titleSuffix: string;
  
  /** Default description */
  defaultDescription: string;
  
  /** Default keywords */
  defaultKeywords: string[];
  
  /** Default OG image */
  defaultOgImage: string;
  
  /** Canonical base URL */
  canonicalBase: string;
  
  /** Enable structured data */
  enableStructuredData: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  DATABASE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface DatabaseConfig {
  /** MongoDB connection URI */
  mongoUri: string;
  
  /** Database name */
  dbName: string;
  
  /** Redis connection URI (for caching) */
  redisUri?: string;
}

// ═══════════════════════════════════════════════════════════════
//  CACHE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface CacheConfig {
  /** Enable caching */
  enabled: boolean;
  
  /** Default TTL in seconds */
  defaultTtl: number;
  
  /** Cache driver:  memory, redis */
  driver: 'memory' | 'redis';
  
  /** Redis configuration (if driver is redis) */
  redis?: {
    host: string;
    port: number;
    password?: string;
  };
}

// ═══════════════════════════════════════════════════════════════
//  RATE LIMIT CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface RateLimitConfig {
  /** Enable rate limiting */
  enabled: boolean;
  
  /** Requests per window */
  maxRequests: number;
  
  /** Window duration in seconds */
  windowSeconds: number;
  
  /** Skip rate limit for premium users */
  skipPremium: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  EXTERNAL SERVICES CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface ExternalServicesConfig {
  /** OpenAI (DISABLED for Nov 2026) */
  openai?: {
    apiKey: string;
    model: string;
    enabled: boolean;  // Always false for Nov 2026
  };
  
  /** Google Cloud (for TTS, etc. - DISABLED for Nov 2026) */
  googleCloud?: {
    projectId: string;
    apiKey: string;
    enabled: boolean;  // Always false for Nov 2026
  };
}

// ═══════════════════════════════════════════════════════════════
//  FULL APP CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface AppConfig extends BaseConfig {
  monetization: MonetizationConfig;
  analytics: AnalyticsConfig;
  seo: SEOConfig;
  database: DatabaseConfig;
  cache: CacheConfig;
  rateLimit: RateLimitConfig;
  externalServices: ExternalServicesConfig;
}

// ═══════════════════════════════════════════════════════════════
//  FRONTEND-SAFE CONFIG (no secrets)
// ═══════════════════════════════════════════════════════════════

export interface FrontendConfig {
  appName: AppName;
  environment: Environment;
  version: string;
  debug: boolean;
  baseUrl: string;
  apiUrl: string;
  
  monetization: {
    adsenseEnabled: boolean;
    adsenseClientId: string;
    premiumEnabled: boolean;
    premiumPriceVND: number;
  };
  
  analytics: {
    ga4MeasurementId: string;
    enabled: boolean;
    debug: boolean;
  };
  
  seo: SEOConfig;
}
