/**
 * Affiliate Link Generator Service
 * 
 * Tasks: MON-018, MON-022
 */

import { AffiliateClick, AffiliateCampaign, AffiliatePlatform } from './affiliate.model';
import crypto from 'crypto';

export interface AffiliateConfig {
  platform: AffiliatePlatform;
  affiliateId: string;
  apiKey?: string;
  secretKey?: string;
}

export interface GenerateLinkOptions {
  productUrl: string;
  productId: string;
  productName: string;
  userId?: string;
  sessionId: string;
  appId: string;
  source?: string;
  campaignId?: string;
}

export interface AffiliateStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  totalCommission: number;
  conversionRate: number;
  byPlatform: Record<string, {
    clicks: number;
    conversions: number;
    revenue: number;
    commission: number;
  }>;
  byDate: Array<{
    date: string;
    clicks: number;
    conversions: number;
    revenue: number;
  }>;
}

// Platform-specific URL templates
const AFFILIATE_URL_TEMPLATES: Record<AffiliatePlatform, (url: string, affiliateId: string) => string> = {
  shopee: (url, affiliateId) => {
    // Shopee affiliate link format
    const encodedUrl = encodeURIComponent(url);
    return `https://shope.ee/redirect?url=${encodedUrl}&af_id=${affiliateId}`;
  },
  lazada: (url, affiliateId) => {
    // Lazada affiliate link format
    const encodedUrl = encodeURIComponent(url);
    return `https://c.lazada.vn/t/c.${affiliateId}?url=${encodedUrl}`;
  },
  tiki: (url, affiliateId) => {
    // Tiki affiliate link format
    const encodedUrl = encodeURIComponent(url);
    return `https://tiki.vn/api/v2/tracking?url=${encodedUrl}&aff_id=${affiliateId}`;
  },
  sendo: (url, affiliateId) => {
    // Sendo affiliate link format
    const encodedUrl = encodeURIComponent(url);
    return `https://www.sendo.vn/tracking?r=${encodedUrl}&pid=${affiliateId}`;
  },
  tiktok_shop: (url, affiliateId) => {
    // TikTok Shop affiliate link format
    const encodedUrl = encodeURIComponent(url);
    return `https://vt.tiktok.com/redirect?url=${encodedUrl}&aff=${affiliateId}`;
  },
  amazon: (url, affiliateId) => {
    // Amazon Associates link format
    const urlObj = new URL(url);
    urlObj.searchParams.set('tag', affiliateId);
    return urlObj.toString();
  },
  other: (url, affiliateId) => {
    // Generic affiliate link with tracking param
    const urlObj = new URL(url);
    urlObj.searchParams.set('ref', affiliateId);
    return urlObj.toString();
  }
};

export class AffiliateService {
  private configs: Map<AffiliatePlatform, AffiliateConfig> = new Map();

  /**
   * Register affiliate configuration for a platform
   */
  registerConfig(config: AffiliateConfig): void {
    this.configs.set(config.platform, config);
  }

  /**
   * Load configs from database
   */
  async loadConfigsFromDB(): Promise<void> {
    const campaigns = await AffiliateCampaign.find({ isActive: true });
    
    for (const campaign of campaigns) {
      this.configs.set(campaign.platform, {
        platform: campaign.platform,
        affiliateId: campaign.affiliateId,
        apiKey: campaign.apiKey,
        secretKey: campaign.secretKey
      });
    }
  }

  /**
   * Detect platform from URL
   */
  detectPlatform(url: string): AffiliatePlatform {
    const urlLower = url.toLowerCase();
    
    if (urlLower.includes('shopee.vn') || urlLower.includes('shope.ee')) {
      return 'shopee';
    }
    if (urlLower.includes('lazada.vn') || urlLower.includes('c.lazada')) {
      return 'lazada';
    }
    if (urlLower.includes('tiki.vn')) {
      return 'tiki';
    }
    if (urlLower.includes('sendo.vn')) {
      return 'sendo';
    }
    if (urlLower.includes('tiktok.com') || urlLower.includes('vt.tiktok')) {
      return 'tiktok_shop';
    }
    if (urlLower.includes('amazon.')) {
      return 'amazon';
    }
    
    return 'other';
  }

  /**
   * Generate affiliate link
   */
  generateAffiliateUrl(url: string, platform: AffiliatePlatform): string {
    const config = this.configs.get(platform);
    
    if (!config) {
      console.warn(`No affiliate config for platform: ${platform}`);
      return url; // Return original URL if no config
    }

    const generator = AFFILIATE_URL_TEMPLATES[platform];
    return generator(url, config.affiliateId);
  }

  /**
   * Create tracked affiliate link and log click
   */
  async createTrackedLink(options: GenerateLinkOptions): Promise<{
    affiliateUrl: string;
    trackingId: string;
  }> {
    const platform = this.detectPlatform(options.productUrl);
    const affiliateUrl = this.generateAffiliateUrl(options.productUrl, platform);
    const trackingId = this.generateTrackingId();

    // Log the click
    await AffiliateClick.create({
      userId: options.userId,
      sessionId: options.sessionId,
      productId: options.productId,
      productName: options.productName,
      productUrl: options.productUrl,
      originalUrl: options.productUrl,
      affiliateUrl,
      platform,
      campaignId: options.campaignId,
      appId: options.appId,
      source: options.source || 'web',
      device: 'other' // Will be updated by tracking middleware
    });

    // Update campaign stats
    await AffiliateCampaign.updateOne(
      { platform, isActive: true },
      { 
        $inc: { 'stats.totalClicks': 1 },
        $set: { 'stats.lastUpdated': new Date() }
      }
    );

    return { affiliateUrl, trackingId };
  }

  /**
   * Track conversion
   */
  async trackConversion(options: {
    sessionId: string;
    orderId: string;
    orderValue: number;
    platform: AffiliatePlatform;
  }): Promise<boolean> {
    // Find the click record
    const click = await AffiliateClick.findOne({
      sessionId: options.sessionId,
      platform: options.platform,
      converted: false
    }).sort({ clickedAt: -1 });

    if (!click) {
      return false;
    }

    // Get commission rate
    const campaign = await AffiliateCampaign.findOne({
      platform: options.platform,
      isActive: true
    });

    let commission = 0;
    if (campaign) {
      if (campaign.commissionType === 'percentage') {
        commission = options.orderValue * (campaign.commissionRate / 100);
        if (campaign.minCommission) commission = Math.max(commission, campaign.minCommission);
        if (campaign.maxCommission) commission = Math.min(commission, campaign.maxCommission);
      } else {
        commission = campaign.commissionRate;
      }
    }

    // Update click record
    await AffiliateClick.updateOne(
      { _id: click._id },
      {
        $set: {
          converted: true,
          conversionValue: options.orderValue,
          conversionDate: new Date(),
          orderId: options.orderId,
          commission,
          expiresAt: null // Don't delete converted clicks
        }
      }
    );

    // Update campaign stats
    if (campaign) {
      const totalClicks = campaign.stats.totalClicks || 1;
      const totalConversions = (campaign.stats.totalConversions || 0) + 1;
      
      await AffiliateCampaign.updateOne(
        { _id: campaign._id },
        {
          $inc: {
            'stats.totalConversions': 1,
            'stats.totalRevenue': options.orderValue,
            'stats.totalCommission': commission
          },
          $set: {
            'stats.conversionRate': (totalConversions / totalClicks) * 100,
            'stats.lastUpdated': new Date()
          }
        }
      );
    }

    return true;
  }

  /**
   * Get affiliate statistics
   */
  async getStats(options: {
    appId: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<AffiliateStats> {
    const { appId, startDate, endDate } = options;
    
    const matchQuery: any = { appId };
    if (startDate || endDate) {
      matchQuery.clickedAt = {};
      if (startDate) matchQuery.clickedAt.$gte = startDate;
      if (endDate) matchQuery.clickedAt.$lte = endDate;
    }

    // Aggregate stats
    const [overallStats, platformStats, dateStats] = await Promise.all([
      // Overall stats
      AffiliateClick.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: null,
            totalClicks: { $sum: 1 },
            totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
            totalRevenue: { $sum: { $ifNull: ['$conversionValue', 0] } },
            totalCommission: { $sum: { $ifNull: ['$commission', 0] } }
          }
        }
      ]),

      // Stats by platform
      AffiliateClick.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: '$platform',
            clicks: { $sum: 1 },
            conversions: { $sum: { $cond: ['$converted', 1, 0] } },
            revenue: { $sum: { $ifNull: ['$conversionValue', 0] } },
            commission: { $sum: { $ifNull: ['$commission', 0] } }
          }
        }
      ]),

      // Stats by date
      AffiliateClick.aggregate([
        { $match: matchQuery },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' } },
            clicks: { $sum: 1 },
            conversions: { $sum: { $cond: ['$converted', 1, 0] } },
            revenue: { $sum: { $ifNull: ['$conversionValue', 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ])
    ]);

    const overall = overallStats[0] || {
      totalClicks: 0,
      totalConversions: 0,
      totalRevenue: 0,
      totalCommission: 0
    };

    const byPlatform: Record<string, any> = {};
    for (const stat of platformStats) {
      byPlatform[stat._id] = {
        clicks: stat.clicks,
        conversions: stat.conversions,
        revenue: stat.revenue,
        commission: stat.commission
      };
    }

    const byDate = dateStats.map(stat => ({
      date: stat._id,
      clicks: stat.clicks,
      conversions: stat.conversions,
      revenue: stat.revenue
    }));

    return {
      totalClicks: overall.totalClicks,
      totalConversions: overall.totalConversions,
      totalRevenue: overall.totalRevenue,
      totalCommission: overall.totalCommission,
      conversionRate: overall.totalClicks > 0 
        ? (overall.totalConversions / overall.totalClicks) * 100 
        : 0,
      byPlatform,
      byDate
    };
  }

  /**
   * Generate unique tracking ID
   */
  private generateTrackingId(): string {
    return crypto.randomBytes(16).toString('hex');
  }
}

// Export singleton instance
export const affiliateService = new AffiliateService();

export default affiliateService;
