/**
 * Lazada Affiliate API Integration
 * Documentation: https://www.lazada.vn/affiliate
 */

import {
  AffiliatePlatform,
  LazadaAffiliateConfig,
  LazadaProductInfo,
  AffiliateLink
} from '../types';

/**
 * Lazada Affiliate API client
 */
export class LazadaAffiliateClient {
  private config: LazadaAffiliateConfig;
  private baseUrl = 'https://affiliate-api.lazada.vn';

  constructor(config: LazadaAffiliateConfig) {
    this.config = config;
  }

  /**
   * Generate Lazada affiliate tracking link
   * Uses Lazada's tracking URL format
   */
  generateAffiliateLink(originalUrl: string, subId?: string): AffiliateLink {
    // Lazada uses a redirect-based tracking system
    const trackingUrl = `https://s.lazada.vn/s.${this.config.trackingId}`;
    
    const params = new URLSearchParams({
      'url': originalUrl,
      'pid': this.config.publisherId,
      ...(subId && { 'sub_id': subId })
    });

    return {
      id: this.generateLinkId(),
      originalUrl,
      affiliateUrl: `${trackingUrl}?${params.toString()}`,
      platform: AffiliatePlatform.LAZADA,
      productId: this.extractProductId(originalUrl),
      createdAt: new Date()
    };
  }

  /**
   * Generate short affiliate link
   */
  generateShortLink(originalUrl: string): string {
    const productId = this.extractProductId(originalUrl);
    return `https://s.lazada.vn/s.${this.config.trackingId}?p=${productId}`;
  }

  /**
   * Generate deep link for Lazada app
   */
  generateDeepLink(productId: string): string {
    return `lazada://product/${productId}?aff_id=${this.config.affiliateId}`;
  }

  /**
   * Get product information by ID
   * Note: Requires API access - returns mock for now
   */
  async getProductInfo(productId: string): Promise<LazadaProductInfo | null> {
    try {
      // API call would go here
      // const response = await fetch(`${this.baseUrl}/v1/products/${productId}`, { ... });

      // Mock response for development
      return {
        itemId: productId,
        name: 'Product from Lazada',
        price: 0,
        originalPrice: 0,
        imageUrl: '',
        sellerName: '',
        commission: 0,
        commissionRate: 0.06, // 6% average commission
        rating: 0
      };
    } catch (error) {
      console.error('Failed to get Lazada product info:', error);
      return null;
    }
  }

  /**
   * Get trending products (for recommendations)
   */
  async getTrendingProducts(categoryId?: string, limit = 20): Promise<LazadaProductInfo[]> {
    try {
      // API call would go here
      return [];
    } catch (error) {
      console.error('Failed to get Lazada trending products:', error);
      return [];
    }
  }

  /**
   * Extract product ID from Lazada URL
   */
  private extractProductId(url: string): string | undefined {
    // Lazada URL patterns:
    // https://www.lazada.vn/products/product-name-i123456789.html
    // https://www.lazada.vn/products/i123456789.html
    const patterns = [
      /lazada\.vn\/products\/.*-i(\d+)\.html/,
      /lazada\.vn\/products\/i(\d+)\.html/,
      /itemId=(\d+)/
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }

    return undefined;
  }

  /**
   * Generate unique link ID
   */
  private generateLinkId(): string {
    return `lzd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Parse Lazada URL to extract product ID
 */
export function parseLazadaUrl(url: string): { itemId?: string } {
  const patterns = [
    /lazada\.vn\/products\/.*-i(\d+)\.html/,
    /lazada\.vn\/products\/i(\d+)\.html/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return { itemId: match[1] };
    }
  }

  return {};
}

/**
 * Check if URL is a Lazada URL
 */
export function isLazadaUrl(url: string): boolean {
  return url.includes('lazada.vn') || url.includes('lazada.com');
}
