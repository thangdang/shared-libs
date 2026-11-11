/**
 * Unified Affiliate Service
 * Manages affiliate links across multiple platforms
 */

import {
  AffiliatePlatform,
  AffiliateConfig,
  AffiliateLink,
  AffiliateClick,
  AffiliateConversion,
  AffiliateStats,
  AffiliateServiceConfig,
  GenerateLinkRequest,
  ConversionStatus,
  ShopeeAffiliateConfig,
  LazadaAffiliateConfig,
  TikiAffiliateConfig
} from './types';
import {
  ShopeeAffiliateClient,
  isShopeeUrl,
  LazadaAffiliateClient,
  isLazadaUrl,
  TikiAffiliateClient,
  isTikiUrl
} from './platforms';

/**
 * Unified affiliate service for all platforms
 */
export class AffiliateService {
  private config: AffiliateServiceConfig;
  private clients: Map<AffiliatePlatform, ShopeeAffiliateClient | LazadaAffiliateClient | TikiAffiliateClient>;

  constructor(config: AffiliateServiceConfig) {
    this.config = config;
    this.clients = new Map();
    this.initializeClients();
  }

  /**
   * Initialize platform clients based on config
   */
  private initializeClients(): void {
    const { platforms } = this.config;

    if (platforms[AffiliatePlatform.SHOPEE]?.enabled) {
      this.clients.set(
        AffiliatePlatform.SHOPEE,
        new ShopeeAffiliateClient(platforms[AffiliatePlatform.SHOPEE] as ShopeeAffiliateConfig)
      );
    }

    if (platforms[AffiliatePlatform.LAZADA]?.enabled) {
      this.clients.set(
        AffiliatePlatform.LAZADA,
        new LazadaAffiliateClient(platforms[AffiliatePlatform.LAZADA] as LazadaAffiliateConfig)
      );
    }

    if (platforms[AffiliatePlatform.TIKI]?.enabled) {
      this.clients.set(
        AffiliatePlatform.TIKI,
        new TikiAffiliateClient(platforms[AffiliatePlatform.TIKI] as TikiAffiliateConfig)
      );
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): AffiliatePlatform | null {
    if (isShopeeUrl(url)) return AffiliatePlatform.SHOPEE;
    if (isLazadaUrl(url)) return AffiliatePlatform.LAZADA;
    if (isTikiUrl(url)) return AffiliatePlatform.TIKI;
    return null;
  }

  /**
   * Generate affiliate link for any supported platform
   */
  generateLink(request: GenerateLinkRequest): AffiliateLink | null {
    const platform = request.platform || this.detectPlatform(request.originalUrl);
    
    if (!platform) {
      console.warn('Unable to detect platform for URL:', request.originalUrl);
      return null;
    }

    const client = this.clients.get(platform);
    if (!client) {
      console.warn('Platform not configured:', platform);
      return null;
    }

    const link = client.generateAffiliateLink(
      request.originalUrl,
      request.subId
    );

    // Add additional metadata
    if (request.productName) link.productName = request.productName;
    if (request.metadata) link.metadata = request.metadata;

    return link;
  }

  /**
   * Generate affiliate links for multiple URLs (batch)
   */
  generateLinks(requests: GenerateLinkRequest[]): (AffiliateLink | null)[] {
    return requests.map(req => this.generateLink(req));
  }

  /**
   * Track a click on an affiliate link
   */
  trackClick(linkId: string, data: Partial<AffiliateClick>): AffiliateClick {
    const click: AffiliateClick = {
      id: this.generateClickId(),
      linkId,
      platform: data.platform || AffiliatePlatform.SHOPEE,
      sessionId: data.sessionId || this.generateSessionId(),
      userId: data.userId,
      ipAddress: data.ipAddress,
      userAgent: data.userAgent,
      referrer: data.referrer,
      clickedAt: new Date(),
      metadata: data.metadata
    };

    // In a real implementation, this would be saved to database
    // await this.saveClick(click);

    return click;
  }

  /**
   * Record a conversion (purchase via affiliate link)
   */
  recordConversion(data: {
    clickId: string;
    linkId: string;
    platform: AffiliatePlatform;
    orderId: string;
    orderAmount: number;
    commission: number;
    userId?: string;
  }): AffiliateConversion {
    const conversion: AffiliateConversion = {
      id: this.generateConversionId(),
      clickId: data.clickId,
      linkId: data.linkId,
      platform: data.platform,
      orderId: data.orderId,
      orderAmount: data.orderAmount,
      commission: data.commission,
      status: ConversionStatus.PENDING,
      userId: data.userId,
      convertedAt: new Date()
    };

    // In a real implementation, this would be saved to database
    // await this.saveConversion(conversion);

    return conversion;
  }

  /**
   * Get affiliate statistics
   */
  async getStats(
    platform?: AffiliatePlatform,
    period: 'day' | 'week' | 'month' | 'all' = 'month'
  ): Promise<AffiliateStats[]> {
    // In a real implementation, this would query the database
    // and aggregate click/conversion data

    const stats: AffiliateStats[] = [];

    // Mock stats for development
    const platforms = platform 
      ? [platform] 
      : [AffiliatePlatform.SHOPEE, AffiliatePlatform.LAZADA, AffiliatePlatform.TIKI];

    for (const p of platforms) {
      if (this.clients.has(p)) {
        stats.push({
          platform: p,
          period,
          clicks: 0,
          conversions: 0,
          conversionRate: 0,
          totalRevenue: 0,
          totalCommission: 0,
          avgOrderValue: 0,
          topProducts: []
        });
      }
    }

    return stats;
  }

  /**
   * Get configured platforms
   */
  getConfiguredPlatforms(): AffiliatePlatform[] {
    return Array.from(this.clients.keys());
  }

  /**
   * Check if platform is configured
   */
  isPlatformConfigured(platform: AffiliatePlatform): boolean {
    return this.clients.has(platform);
  }

  /**
   * Get platform client
   */
  getPlatformClient(platform: AffiliatePlatform) {
    return this.clients.get(platform);
  }

  private generateClickId(): string {
    return `clk_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateConversionId(): string {
    return `cnv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  private generateSessionId(): string {
    return `ses_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }
}

/**
 * Create default affiliate service configuration
 */
export function createDefaultConfig(): AffiliateServiceConfig {
  return {
    apiEndpoint: '/api/affiliate',
    platforms: {},
    trackingEnabled: true,
    clickTTL: 30 * 24 * 60 * 60 // 30 days
  };
}
