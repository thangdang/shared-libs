/**
 * Affiliate Service - Main Exports
 * Supports Shopee, Lazada, Tiki, and Vietnam e-commerce platforms
 */

// Types
export {
  AffiliatePlatform,
  AffiliateConfig,
  AffiliateLink,
  AffiliateClick,
  AffiliateConversion,
  AffiliateStats,
  ProductStats,
  ConversionStatus,
  AffiliateServiceConfig,
  GenerateLinkRequest,
  // Platform-specific types
  ShopeeAffiliateConfig,
  ShopeeProductInfo,
  LazadaAffiliateConfig,
  LazadaProductInfo,
  TikiAffiliateConfig,
  TikiProductInfo,
  PharmacyProductInfo
} from './types';

// Main service
export { AffiliateService, createDefaultConfig } from './affiliate.service';

// Platform clients
export {
  ShopeeAffiliateClient,
  parseShopeeUrl,
  isShopeeUrl,
  LazadaAffiliateClient,
  parseLazadaUrl,
  isLazadaUrl,
  TikiAffiliateClient,
  parseTikiUrl,
  isTikiUrl
} from './platforms';

// Middleware
export {
  AffiliateRequest,
  affiliateClickTracker,
  affiliateRedirect,
  conversionWebhookHandler,
  createAffiliateRouter
} from './tracking.middleware';
