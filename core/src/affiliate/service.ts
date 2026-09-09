/**
 * Affiliate Service - Main service class for affiliate operations
 * 
 * Each app uses its own database connection but shares this service logic.
 */

import { 
  AffiliateAccount, 
  AffiliateLink, 
  AffiliateClick, 
  AffiliateMatch,
  MatchRequest,
  AppName,
  Platform,
  Category
} from './types';
import { detectCategory, getBestPlatform, getCommissionRate, calculateExpectedCommission } from './matcher';
import { generateAffiliateLink, generateTrackingId } from './link-generator';
import { createClickRecord, aggregateClickStats, AggregatedStats } from './tracker';

/**
 * Database interface - implement this for your specific database
 */
export interface IAffiliateRepository {
  // Accounts
  getActiveAccounts(): Promise<AffiliateAccount[]>;
  getAccountByPlatform(platform: Platform): Promise<AffiliateAccount | null>;
  
  // Links
  createLink(link: Omit<AffiliateLink, '_id'>): Promise<AffiliateLink>;
  getLinkById(id: string): Promise<AffiliateLink | null>;
  getLinkByTrackingId(trackingId: string): Promise<AffiliateLink | null>;
  updateLinkStats(id: string, updates: Partial<AffiliateLink>): Promise<void>;
  
  // Clicks
  createClick(click: Omit<AffiliateClick, '_id'>): Promise<AffiliateClick>;
  getClickByTrackingId(trackingId: string): Promise<AffiliateClick | null>;
  updateClick(id: string, updates: Partial<AffiliateClick>): Promise<void>;
  getClicksInRange(startDate: Date, endDate: Date): Promise<AffiliateClick[]>;
  getRecentClicksByUser(userHash: string, linkId: string, minutes: number): Promise<AffiliateClick[]>;
}

/**
 * Affiliate Service - Use this in each app
 */
export class AffiliateService {
  constructor(
    private repository: IAffiliateRepository,
    private appName: AppName
  ) {}

  /**
   * Match content to best affiliate and generate link
   */
  async matchAndGenerateLink(request: MatchRequest): Promise<AffiliateMatch | null> {
    const { content, productName, productUrl, price = 0 } = request;
    
    // Get all active accounts
    const accounts = await this.repository.getActiveAccounts();
    if (accounts.length === 0) {
      return null;
    }
    
    const availablePlatforms = accounts.map(a => a.platform);
    
    // Detect category from content
    const searchText = content || productName || '';
    const category = detectCategory(searchText);
    
    // Get best platform for this category and app
    const bestPlatform = getBestPlatform(category, this.appName, availablePlatforms);
    
    // Get account for best platform
    const account = accounts.find(a => a.platform === bestPlatform);
    if (!account || !productUrl) {
      return null;
    }
    
    // Generate affiliate link
    const trackingId = generateTrackingId(productUrl);
    const affiliateUrl = generateAffiliateLink(
      bestPlatform,
      productUrl,
      account.affiliateId,
      trackingId
    );
    
    // Calculate commission
    const commissionRate = getCommissionRate(bestPlatform, category);
    const expectedCommission = calculateExpectedCommission(price, bestPlatform, category);
    
    // Save link to database
    const linkDoc = await this.repository.createLink({
      originalUrl: productUrl,
      affiliateUrl,
      platform: bestPlatform,
      productName: productName || '',
      category,
      price,
      commissionRate,
      expectedCommission,
      clickCount: 0,
      conversionCount: 0,
      revenue: 0,
      sourceApp: this.appName,
      createdAt: new Date()
    });
    
    return {
      platform: bestPlatform,
      affiliateUrl,
      originalUrl: productUrl,
      productName: productName || '',
      price,
      category,
      commissionRate,
      expectedCommission
    };
  }

  /**
   * Track a click on affiliate link
   */
  async trackClick(
    linkId: string,
    sourcePage: string,
    ip: string,
    userAgent?: string,
    referer?: string
  ): Promise<{ success: boolean; redirectUrl: string }> {
    // Get link
    const link = await this.repository.getLinkById(linkId);
    if (!link) {
      return { success: false, redirectUrl: '' };
    }
    
    // Create tracking ID
    const trackingId = generateTrackingId(`${linkId}:${ip}:${Date.now()}`);
    
    // Check for duplicate clicks
    const userHash = createClickRecord(linkId, trackingId, this.appName, sourcePage, ip, userAgent).userHash;
    const recentClicks = await this.repository.getRecentClicksByUser(userHash, linkId, 30);
    
    if (recentClicks.length === 0) {
      // Create click record
      const clickRecord = createClickRecord(
        linkId,
        trackingId,
        this.appName,
        sourcePage,
        ip,
        userAgent,
        referer
      );
      await this.repository.createClick(clickRecord);
      
      // Update link click count
      await this.repository.updateLinkStats(linkId, {
        clickCount: link.clickCount + 1
      });
    }
    
    return {
      success: true,
      redirectUrl: link.affiliateUrl
    };
  }

  /**
   * Handle conversion postback from affiliate network
   */
  async handlePostback(
    trackingId: string,
    orderId: string,
    commission: number
  ): Promise<boolean> {
    // Find click by tracking ID
    const click = await this.repository.getClickByTrackingId(trackingId);
    if (!click) {
      return false;
    }
    
    // Update click as converted
    await this.repository.updateClick(click._id!, {
      converted: true,
      orderId,
      commissionEarned: commission
    });
    
    // Update link stats
    const link = await this.repository.getLinkById(click.linkId);
    if (link) {
      await this.repository.updateLinkStats(link._id!, {
        conversionCount: link.conversionCount + 1,
        revenue: link.revenue + commission
      });
    }
    
    return true;
  }

  /**
   * Get affiliate statistics
   */
  async getStats(startDate: Date, endDate: Date): Promise<AggregatedStats> {
    const clicks = await this.repository.getClicksInRange(startDate, endDate);
    return aggregateClickStats(clicks);
  }
}

/**
 * Factory function to create service for specific app
 */
export function createAffiliateService(
  repository: IAffiliateRepository,
  appName: AppName
): AffiliateService {
  return new AffiliateService(repository, appName);
}
