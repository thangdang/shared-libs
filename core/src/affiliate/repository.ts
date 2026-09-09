/**
 * MongoDB Repository Implementation for Affiliate Module
 * 
 * Each app creates its own instance connected to its own database.
 */

import { Collection, Db, ObjectId } from 'mongodb';
import {
  AffiliateAccount,
  AffiliateLink,
  AffiliateClick,
  Platform
} from './types';
import { IAffiliateRepository } from './service';

export class MongoAffiliateRepository implements IAffiliateRepository {
  private accounts: Collection<AffiliateAccount>;
  private links: Collection<AffiliateLink>;
  private clicks: Collection<AffiliateClick>;

  constructor(db: Db) {
    this.accounts = db.collection('affiliate_accounts');
    this.links = db.collection('affiliate_links');
    this.clicks = db.collection('affiliate_clicks');
  }

  /**
   * Initialize indexes (call once on app startup)
   */
  async initializeIndexes(): Promise<void> {
    // Accounts indexes
    await this.accounts.createIndex({ platform: 1, status: 1 });
    
    // Links indexes
    await this.links.createIndex({ platform: 1, category: 1 });
    await this.links.createIndex({ sourceApp: 1, createdAt: -1 });
    await this.links.createIndex({ createdAt: -1 });
    
    // Clicks indexes
    await this.clicks.createIndex({ linkId: 1, clickedAt: -1 });
    await this.clicks.createIndex({ trackingId: 1 }, { unique: true, sparse: true });
    await this.clicks.createIndex({ userHash: 1, linkId: 1, clickedAt: -1 });
    await this.clicks.createIndex({ clickedAt: -1 });
    await this.clicks.createIndex({ sourceApp: 1, clickedAt: -1 });
  }

  // ============ Accounts ============

  async getActiveAccounts(): Promise<AffiliateAccount[]> {
    return this.accounts.find({ status: 'active' }).toArray();
  }

  async getAccountByPlatform(platform: Platform): Promise<AffiliateAccount | null> {
    return this.accounts.findOne({ platform, status: 'active' });
  }

  async upsertAccount(account: AffiliateAccount): Promise<void> {
    await this.accounts.updateOne(
      { platform: account.platform },
      { $set: { ...account, updatedAt: new Date() } },
      { upsert: true }
    );
  }

  // ============ Links ============

  async createLink(link: Omit<AffiliateLink, '_id'>): Promise<AffiliateLink> {
    const result = await this.links.insertOne(link as AffiliateLink);
    return { ...link, _id: result.insertedId.toString() };
  }

  async getLinkById(id: string): Promise<AffiliateLink | null> {
    try {
      return this.links.findOne({ _id: new ObjectId(id) as any });
    } catch {
      return null;
    }
  }

  async getLinkByTrackingId(trackingId: string): Promise<AffiliateLink | null> {
    // TrackingId is embedded in the click, not the link
    // This finds the link via the click
    const click = await this.clicks.findOne({ trackingId });
    if (!click) return null;
    return this.getLinkById(click.linkId);
  }

  async updateLinkStats(id: string, updates: Partial<AffiliateLink>): Promise<void> {
    try {
      await this.links.updateOne(
        { _id: new ObjectId(id) as any },
        { $set: updates }
      );
    } catch {
      // Ignore invalid ObjectId
    }
  }

  async getLinksByPlatform(platform: Platform, limit: number = 100): Promise<AffiliateLink[]> {
    return this.links
      .find({ platform })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }

  // ============ Clicks ============

  async createClick(click: Omit<AffiliateClick, '_id'>): Promise<AffiliateClick> {
    const result = await this.clicks.insertOne(click as AffiliateClick);
    return { ...click, _id: result.insertedId.toString() };
  }

  async getClickByTrackingId(trackingId: string): Promise<AffiliateClick | null> {
    return this.clicks.findOne({ trackingId });
  }

  async updateClick(id: string, updates: Partial<AffiliateClick>): Promise<void> {
    try {
      await this.clicks.updateOne(
        { _id: new ObjectId(id) as any },
        { $set: updates }
      );
    } catch {
      // Ignore invalid ObjectId
    }
  }

  async getClicksInRange(startDate: Date, endDate: Date): Promise<AffiliateClick[]> {
    return this.clicks
      .find({
        clickedAt: { $gte: startDate, $lte: endDate }
      })
      .toArray();
  }

  async getRecentClicksByUser(
    userHash: string,
    linkId: string,
    minutes: number
  ): Promise<AffiliateClick[]> {
    const cutoff = new Date(Date.now() - minutes * 60 * 1000);
    return this.clicks
      .find({
        userHash,
        linkId,
        clickedAt: { $gte: cutoff }
      })
      .toArray();
  }

  // ============ Aggregations ============

  async getStatsByPlatform(startDate: Date, endDate: Date): Promise<any[]> {
    return this.clicks.aggregate([
      {
        $match: {
          clickedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $lookup: {
          from: 'affiliate_links',
          localField: 'linkId',
          foreignField: '_id',
          as: 'link'
        }
      },
      { $unwind: '$link' },
      {
        $group: {
          _id: '$link.platform',
          totalClicks: { $sum: 1 },
          totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
          totalRevenue: { $sum: '$commissionEarned' }
        }
      },
      {
        $project: {
          platform: '$_id',
          totalClicks: 1,
          totalConversions: 1,
          totalRevenue: 1,
          conversionRate: {
            $cond: [
              { $eq: ['$totalClicks', 0] },
              0,
              { $multiply: [{ $divide: ['$totalConversions', '$totalClicks'] }, 100] }
            ]
          }
        }
      }
    ]).toArray();
  }

  async getDailyStats(startDate: Date, endDate: Date): Promise<any[]> {
    return this.clicks.aggregate([
      {
        $match: {
          clickedAt: { $gte: startDate, $lte: endDate }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$clickedAt' }
          },
          totalClicks: { $sum: 1 },
          totalConversions: { $sum: { $cond: ['$converted', 1, 0] } },
          totalRevenue: { $sum: '$commissionEarned' }
        }
      },
      { $sort: { _id: 1 } }
    ]).toArray();
  }
}
