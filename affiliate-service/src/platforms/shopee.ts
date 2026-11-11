/**
 * Shopee Affiliate API Integration
 * Documentation: https://affiliate.shopee.vn/
 */

import {
  AffiliatePlatform,
  ShopeeAffiliateConfig,
  ShopeeProductInfo,
  AffiliateLink
} from '../types';
import crypto from 'crypto';

/**
 * Shopee Affiliate API client
 */
export class ShopeeAffiliateClient {
  private config: ShopeeAffiliateConfig;
  private baseUrl = 'https://affiliate.shopee.vn/api/v3';

  constructor(config: ShopeeAffiliateConfig) {
    this.config = config;
  }

  /**
   * Generate Shopee affiliate tracking link
   */
  generateAffiliateLink(originalUrl: string, subId?: string): AffiliateLink {
    const url = new URL(originalUrl);
    const trackingParams = new URLSearchParams({
      'af_id': this.config.affiliateId,
      'pid': this.config.appId,
      ...(subId && { 'af_sub_id': subId }),
      ...(this.config.subAffiliateId && { 'af_sub_siteid': this.config.subAffiliateId })
    });

    // Append tracking params to URL
    trackingParams.forEach((value, key) => {
      url.searchParams.set(key, value);
    });

    return {
      id: this.generateLinkId(),
      originalUrl,
      affiliateUrl: url.toString(),
      platform: AffiliatePlatform.SHOPEE,
      productId: this.extractProductId(originalUrl),
      createdAt: new Date()
    };
  }

  /**
   * Generate deep link for Shopee app
   */
  generateDeepLink(productId: string, shopId?: string): string {
    const params = new URLSearchParams({
      'af_id': this.config.affiliateId,
      'pid': this.config.appId
    });

    if (shopId) {
      return `shopee://product/${shopId}/${productId}?${params.toString()}`;
    }
    return `shopee://product/${productId}?${params.toString()}`;
  }

  /**
   * Get product information by ID
   * Note: Requires API access - returns mock for now
   */
  async getProductInfo(productId: string): Promise<ShopeeProductInfo | null> {
    try {
      const signature = this.generateSignature({
        item_id: productId,
        timestamp: Date.now()
      });

      // API call would go here
      // const response = await fetch(`${this.baseUrl}/product/get`, { ... });

      // Mock response for development
      return {
        itemId: parseInt(productId),
        shopId: 0,
        name: 'Product from Shopee',
        price: 0,
        priceMin: 0,
        priceMax: 0,
        imageUrl: '',
        shopName: '',
        commission: 0,
        commissionRate: 0.08, // 8% average commission
        salesVolume: 0,
        rating: 0
      };
    } catch (error) {
      console.error('Failed to get Shopee product info:', error);
      return null;
    }
  }

  /**
   * Generate API signature for Shopee
   */
  private generateSignature(params: Record<string, unknown>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');

    return crypto
      .createHmac('sha256', this.config.apiSecret || '')
      .update(sortedParams)
      .digest('hex');
  }

  /**
   * Extract product ID from Shopee URL
   */
  private extractProductId(url: string): string | undefined {
    // Shopee URL patterns:
    // https://shopee.vn/product/shopid/itemid
    // https://shopee.vn/product-name-i.shopid.itemid
    const patterns = [
      /shopee\.vn\/product\/\d+\/(\d+)/,
      /shopee\.vn\/.*-i\.\d+\.(\d+)/,
      /i\.(\d+)\.(\d+)/ // shopid.itemid
    ];

    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[match.length - 1]; // Return last capture group (itemId)
      }
    }

    return undefined;
  }

  /**
   * Generate unique link ID
   */
  private generateLinkId(): string {
    return `shp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Parse Shopee URL to extract shop and item IDs
 */
export function parseShopeeUrl(url: string): { shopId?: string; itemId?: string } {
  const patterns = [
    /shopee\.vn\/product\/(\d+)\/(\d+)/,
    /shopee\.vn\/.*-i\.(\d+)\.(\d+)/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) {
      return {
        shopId: match[1],
        itemId: match[2]
      };
    }
  }

  return {};
}

/**
 * Check if URL is a Shopee URL
 */
export function isShopeeUrl(url: string): boolean {
  return url.includes('shopee.vn') || url.includes('shopee.com');
}
