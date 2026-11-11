/**
 * Affiliate Service Types
 * Supports Shopee, Lazada, Tiki, and other Vietnam e-commerce platforms
 */

/**
 * Supported affiliate platforms in Vietnam
 */
export enum AffiliatePlatform {
  SHOPEE = 'shopee',
  LAZADA = 'lazada',
  TIKI = 'tiki',
  SENDO = 'sendo',
  // Pharmacy
  LONG_CHAU = 'long_chau',
  PHARMACITY = 'pharmacity',
  // Auto parts
  OTOPARTS = 'otoparts'
}

/**
 * Affiliate link configuration per platform
 */
export interface AffiliateConfig {
  platform: AffiliatePlatform;
  affiliateId: string;
  apiKey?: string;
  apiSecret?: string;
  trackingDomain?: string;
  enabled: boolean;
}

/**
 * Generated affiliate link
 */
export interface AffiliateLink {
  id: string;
  originalUrl: string;
  affiliateUrl: string;
  platform: AffiliatePlatform;
  productId?: string;
  productName?: string;
  productPrice?: number;
  commission?: number;
  commissionRate?: number;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Affiliate click tracking data
 */
export interface AffiliateClick {
  id: string;
  linkId: string;
  platform: AffiliatePlatform;
  userId?: string;
  sessionId: string;
  ipAddress?: string;
  userAgent?: string;
  referrer?: string;
  clickedAt: Date;
  metadata?: Record<string, unknown>;
}

/**
 * Affiliate conversion (successful purchase)
 */
export interface AffiliateConversion {
  id: string;
  clickId: string;
  linkId: string;
  platform: AffiliatePlatform;
  orderId: string;
  orderAmount: number;
  commission: number;
  status: ConversionStatus;
  userId?: string;
  convertedAt: Date;
  validatedAt?: Date;
  paidAt?: Date;
  metadata?: Record<string, unknown>;
}

export enum ConversionStatus {
  PENDING = 'pending',
  VALIDATED = 'validated',
  REJECTED = 'rejected',
  PAID = 'paid'
}

/**
 * Affiliate statistics
 */
export interface AffiliateStats {
  platform: AffiliatePlatform;
  period: 'day' | 'week' | 'month' | 'all';
  clicks: number;
  conversions: number;
  conversionRate: number;
  totalRevenue: number;
  totalCommission: number;
  avgOrderValue: number;
  topProducts: ProductStats[];
}

export interface ProductStats {
  productId: string;
  productName: string;
  clicks: number;
  conversions: number;
  revenue: number;
  commission: number;
}

/**
 * Shopee Affiliate API types
 */
export interface ShopeeAffiliateConfig extends AffiliateConfig {
  platform: AffiliatePlatform.SHOPEE;
  appId: string;
  appSecret: string;
  subAffiliateId?: string;
}

export interface ShopeeProductInfo {
  itemId: number;
  shopId: number;
  name: string;
  price: number;
  priceMin: number;
  priceMax: number;
  discount?: number;
  imageUrl: string;
  shopName: string;
  commission: number;
  commissionRate: number;
  salesVolume: number;
  rating: number;
}

/**
 * Lazada Affiliate API types
 */
export interface LazadaAffiliateConfig extends AffiliateConfig {
  platform: AffiliatePlatform.LAZADA;
  trackingId: string;
  publisherId: string;
}

export interface LazadaProductInfo {
  itemId: string;
  name: string;
  price: number;
  originalPrice?: number;
  discount?: number;
  imageUrl: string;
  sellerName: string;
  commission: number;
  commissionRate: number;
  rating: number;
}

/**
 * Tiki Affiliate API types
 */
export interface TikiAffiliateConfig extends AffiliateConfig {
  platform: AffiliatePlatform.TIKI;
  publisherId: string;
  campaignId?: string;
}

export interface TikiProductInfo {
  productId: number;
  sku: string;
  name: string;
  price: number;
  listPrice?: number;
  discount?: number;
  thumbnailUrl: string;
  sellerName: string;
  commission: number;
  commissionRate: number;
  rating: number;
  reviewCount: number;
}

/**
 * Pharmacy affiliate types (Long Châu, Pharmacity)
 */
export interface PharmacyProductInfo {
  productId: string;
  name: string;
  genericName?: string;
  dosage?: string;
  manufacturer?: string;
  price: number;
  originalPrice?: number;
  imageUrl: string;
  inStock: boolean;
  requiresPrescription: boolean;
  commission?: number;
}

/**
 * Request to generate affiliate link
 */
export interface GenerateLinkRequest {
  originalUrl: string;
  platform?: AffiliatePlatform;
  productId?: string;
  productName?: string;
  campaignId?: string;
  subId?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Affiliate service configuration
 */
export interface AffiliateServiceConfig {
  apiEndpoint: string;
  platforms: Partial<Record<AffiliatePlatform, AffiliateConfig>>;
  defaultPlatform?: AffiliatePlatform;
  trackingEnabled: boolean;
  clickTTL: number; // seconds before click expires for conversion attribution
}
