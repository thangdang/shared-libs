/**
 * SEO Service Library - Nov 2026 Release
 * 
 * Shared SEO service for all 5 AI apps:
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
  MetaTags,
  OpenGraphTags,
  TwitterCardTags,
  StructuredDataConfig,
  StructuredDataType,
  PageSEOConfig,
  BreadcrumbItem,
  SEOServiceConfig,
} from './types';

// ═══════════════════════════════════════════════════════════════
//  STRUCTURED DATA BUILDERS
// ═══════════════════════════════════════════════════════════════

export {
  // Common
  buildOrganization,
  buildWebSite,
  buildBreadcrumbs,
  
  // TrendBrief (News)
  buildNewsArticle,
  
  // SmartBuy (Products)
  buildProduct,
  
  // FinTax (Finance)
  buildFAQPage,
  buildHowTo,
  
  // DoctorCar (Auto)
  buildAutoRepair,
  
  // CareMate (Health)
  buildMedicalWebPage,
  buildDrug,
  buildPharmacy,
  
  // Serializer
  serializeJsonLd,
} from './structured-data';

// ═══════════════════════════════════════════════════════════════
//  DEFAULT CONFIGS
// ═══════════════════════════════════════════════════════════════

export { APP_SEO_CONFIGS } from './defaults';

// ═══════════════════════════════════════════════════════════════
//  SITEMAP GENERATOR
// ═══════════════════════════════════════════════════════════════

export type {
  SitemapUrl,
  SitemapImage,
  SitemapNews,
  SitemapIndexEntry,
  SitemapConfig,
  AppPageConfig,
  RobotsTxtConfig,
} from './sitemap';

export {
  SitemapGenerator,
  SitemapIndexGenerator,
  APP_STATIC_PAGES,
  generateRobotsTxt,
  createSitemapGenerator,
  generateAppSitemap,
} from './sitemap';
