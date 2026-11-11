/**
 * SEO Service Types - Nov 2026 Release
 * 
 * Types for SEO meta tags, Open Graph, and structured data.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  META TAG TYPES
// ═══════════════════════════════════════════════════════════════

export interface MetaTags {
  /** Page title */
  title?: string;
  
  /** Meta description */
  description?: string;
  
  /** Meta keywords */
  keywords?: string | string[];
  
  /** Canonical URL */
  canonical?: string;
  
  /** Robots directive (index, follow, etc.) */
  robots?: string;
  
  /** Author */
  author?: string;
  
  /** Published time (ISO 8601) */
  publishedTime?: string;
  
  /** Modified time (ISO 8601) */
  modifiedTime?: string;
}

// ═══════════════════════════════════════════════════════════════
//  OPEN GRAPH TYPES
// ═══════════════════════════════════════════════════════════════

export interface OpenGraphTags {
  /** og:title */
  title?: string;
  
  /** og:description */
  description?: string;
  
  /** og:image */
  image?: string;
  
  /** og:url */
  url?: string;
  
  /** og:type (website, article, product, etc.) */
  type?: 'website' | 'article' | 'product' | 'profile';
  
  /** og:site_name */
  siteName?: string;
  
  /** og:locale */
  locale?: string;
  
  /** Article-specific */
  article?: {
    publishedTime?: string;
    modifiedTime?: string;
    author?: string;
    section?: string;
    tag?: string[];
  };
  
  /** Product-specific */
  product?: {
    price?: string;
    currency?: string;
    availability?: 'in stock' | 'out of stock' | 'preorder';
  };
}

// ═══════════════════════════════════════════════════════════════
//  TWITTER CARD TYPES
// ═══════════════════════════════════════════════════════════════

export interface TwitterCardTags {
  /** twitter:card */
  card?: 'summary' | 'summary_large_image' | 'app' | 'player';
  
  /** twitter:title */
  title?: string;
  
  /** twitter:description */
  description?: string;
  
  /** twitter:image */
  image?: string;
  
  /** twitter:site */
  site?: string;
  
  /** twitter:creator */
  creator?: string;
}

// ═══════════════════════════════════════════════════════════════
//  STRUCTURED DATA TYPES (JSON-LD)
// ═══════════════════════════════════════════════════════════════

export interface StructuredDataConfig {
  /** Schema.org type */
  type: StructuredDataType;
  
  /** Data properties */
  data: Record<string, unknown>;
}

export type StructuredDataType =
  | 'Organization'
  | 'WebSite'
  | 'WebPage'
  | 'Article'
  | 'NewsArticle'
  | 'Product'
  | 'FAQPage'
  | 'HowTo'
  | 'BreadcrumbList'
  | 'LocalBusiness'
  | 'MedicalWebPage'
  | 'DrugClass'
  | 'AutoRepair';

// ═══════════════════════════════════════════════════════════════
//  PAGE SEO CONFIG (all combined)
// ═══════════════════════════════════════════════════════════════

export interface PageSEOConfig {
  /** Basic meta tags */
  meta?: MetaTags;
  
  /** Open Graph tags */
  og?: OpenGraphTags;
  
  /** Twitter card tags */
  twitter?: TwitterCardTags;
  
  /** Structured data (JSON-LD) */
  structuredData?: StructuredDataConfig[];
  
  /** Additional head elements */
  additionalMeta?: Array<{
    name?: string;
    property?: string;
    content: string;
  }>;
}

// ═══════════════════════════════════════════════════════════════
//  BREADCRUMB
// ═══════════════════════════════════════════════════════════════

export interface BreadcrumbItem {
  /** Display name */
  name: string;
  
  /** URL path */
  url: string;
  
  /** Position (1-indexed) */
  position?: number;
}

// ═══════════════════════════════════════════════════════════════
//  SEO SERVICE CONFIG
// ═══════════════════════════════════════════════════════════════

export interface SEOServiceConfig {
  /** Default title */
  defaultTitle: string;
  
  /** Title suffix (e.g., " | TrendBrief AI") */
  titleSuffix: string;
  
  /** Default description */
  defaultDescription: string;
  
  /** Default keywords */
  defaultKeywords: string[];
  
  /** Default OG image */
  defaultOgImage: string;
  
  /** Canonical base URL */
  canonicalBase: string;
  
  /** Site name */
  siteName: string;
  
  /** Default locale */
  defaultLocale: string;
  
  /** Twitter site handle */
  twitterSite?: string;
  
  /** Enable structured data */
  enableStructuredData: boolean;
}
