/**
 * Tiki Affiliate API Integration
 * Documentation: https://affiliate.tiki.vn/
 */

import {
  AffiliatePlatform,
  TikiAffiliateConfig,
  TikiProductInfo,
  AffiliateLink
} from '../types';

/**
 * Tiki Affiliate API client
 */
export class TikiAffiliateClient {
  private config: TikiAffiliateConfig;
  private baseUrl = 'https://affiliate-api.tiki.vn';

  constructor(config: TikiAffiliateConfig) {
    this.config = config;
  }

  /**
   * Generate Tiki affiliate tracking link
   */
  generateAffiliateLink(originalUrl: string, subId?: string): AffiliateLink {
    const url = new URL(originalUrl);
    
    // Tiki uses UTM-style tracking
    const trackingParams = new URLSearchParams({
      'src': 'affiliate',
      'publisher_id': this.config.publisherId,
      ...(this.config.campaignId && { 'campaign_id': this.config.campaignId }),
      ...(subId && { 'sub_id': subId })
    });

    trackingParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return {
      id: this.generateLinkId(),
      originalUrl,
      affiliateUrl: url.toString(),
      platform: AffiliatePlatform.TIKI,
      productId: this.extractProductId(originalUrl),
      createdAt: new Date()
    };
  }

  /**
   * Generate deep link for Tiki app
   */
  generateDeepLink(productId: string): string {
    return `tiki://product/${productId}?aff_id=${this.config.affiliateId}`;
  }

  /**
   * Get product information by ID
   * Note: Requires API access - returns mock for now
   */
  async getProductInfo(productId: string): Promise<TikiProductInfo | null> {
    try {
      // Tiki has a public API for basic product info
      // const response = await fetch(`https://tiki.vn/api/v2/products/${productId}`);
      
      // Mock response for development
      return {
        productId: parseInt(productId),
        sku: '',
        name: 'Product from Tiki',
        price: 0,
        listPrice: 0,
        thumbnailUrl: '',
        sellerName: '',
        commission: 0,
        commissionRate: 0.07, // 7% average commission
        rating: 0,
        reviewCount: 0
      };
    } catch (error) {
      console.error('Failed to get Tiki product info:', error);
      return null;
    }
  }

  /**
   * Get deal of the day products
   */
  async getDealOfTheDay(limit = 10): Promise<TikiProductInfo[]> {
    try {
      // API call would go here
      return [];
    } catch (error) {
      console.error('Failed to get Tiki deals:', error);
      return [];
    }
  }

  /**
   * Search products
   */
  async searchProducts(query: string, limit = 20): Promise<TikiProductInfo[]> {
    try {
      // API call would go here
      return [];
    } catch (error) {
      console.error('Failed to search Tiki products:', error);
      return [];
    }
  }

  /**
   * Extract product ID from Tiki URL
   */
  private extractProductId(url: string): string | undefined {
    // Tiki URL patterns:
    // https://tiki.vn/product-name-p12345678.html
    // https://tiki.vn/product-name-p12345678.html?spid=xxx
    const patterns = [
      /tiki\.vn\/.*-p(\d+)\.html/,
      /tiki\.vn\/.*-p(\d+)/,
      /product_id=(\d+)/,
      /spid=(\d+)/
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
    return `tiki_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Parse Tiki URL to extract product ID
 */
export function parseTikiUrl(url: string): { productId?: string; spid?: string } {
  const productMatch = url.match(/tiki\.vn\/.*-p(\d+)/);
  const spidMatch = url.match(/spid=(\d+)/);

  return {
    productId: productMatch?.[1],
    spid: spidMatch?.[1]
  };
}

/**
 * Check if URL is a Tiki URL
 */
export function isTikiUrl(url: string): boolean {
  return url.includes('tiki.vn');
}
