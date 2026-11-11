/**
 * Affiliate Tracking Model for SmartBuy AI
 * 
 * Tasks: MON-018, MON-019, MON-020
 */

import mongoose, { Schema, Document } from 'mongoose';

export type AffiliatePlatform = 'shopee' | 'lazada' | 'tiki' | 'sendo' | 'tiktok_shop' | 'amazon' | 'other';

export interface IAffiliateClick extends Document {
  // Click info
  userId?: mongoose.Types.ObjectId;
  sessionId: string;
  
  // Product info
  productId: string;
  productName: string;
  productUrl: string;
  originalUrl: string;
  affiliateUrl: string;
  
  // Platform
  platform: AffiliatePlatform;
  campaignId?: string;
  
  // Tracking
  clickedAt: Date;
  referrer?: string;
  userAgent?: string;
  ipAddress?: string;
  
  // Device info
  device: string;
  browser?: string;
  os?: string;
  
  // Location
  country?: string;
  city?: string;
  
  // Conversion tracking
  converted: boolean;
  conversionValue?: number;
  conversionDate?: Date;
  orderId?: string;
  commission?: number;
  
  // App info
  appId: string;
  source: string;
  
  // TTL - auto delete after 90 days if not converted
  expiresAt?: Date;
}

const AffiliateClickSchema = new Schema<IAffiliateClick>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      index: true
    },
    sessionId: {
      type: String,
      required: true,
      index: true
    },
    productId: {
      type: String,
      required: true
    },
    productName: {
      type: String,
      required: true
    },
    productUrl: {
      type: String,
      required: true
    },
    originalUrl: {
      type: String,
      required: true
    },
    affiliateUrl: {
      type: String,
      required: true
    },
    platform: {
      type: String,
      enum: ['shopee', 'lazada', 'tiki', 'sendo', 'tiktok_shop', 'amazon', 'other'],
      required: true,
      index: true
    },
    campaignId: {
      type: String
    },
    clickedAt: {
      type: Date,
      default: Date.now,
      index: true
    },
    referrer: {
      type: String
    },
    userAgent: {
      type: String
    },
    ipAddress: {
      type: String
    },
    device: {
      type: String,
      enum: ['mobile', 'tablet', 'desktop', 'other'],
      default: 'other'
    },
    browser: {
      type: String
    },
    os: {
      type: String
    },
    country: {
      type: String
    },
    city: {
      type: String
    },
    converted: {
      type: Boolean,
      default: false,
      index: true
    },
    conversionValue: {
      type: Number
    },
    conversionDate: {
      type: Date
    },
    orderId: {
      type: String
    },
    commission: {
      type: Number
    },
    appId: {
      type: String,
      required: true,
      index: true
    },
    source: {
      type: String,
      default: 'web'
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 90 * 24 * 60 * 60 * 1000), // 90 days
      index: { expires: 0 }
    }
  },
  {
    timestamps: true,
    collection: 'affiliate_clicks'
  }
);

// Compound indexes
AffiliateClickSchema.index({ platform: 1, clickedAt: -1 });
AffiliateClickSchema.index({ appId: 1, converted: 1 });
AffiliateClickSchema.index({ productId: 1, platform: 1 });

export const AffiliateClick = mongoose.model<IAffiliateClick>('AffiliateClick', AffiliateClickSchema);

/**
 * Affiliate Campaign Model
 */
export interface IAffiliateCampaign extends Document {
  name: string;
  description?: string;
  platform: AffiliatePlatform;
  
  // Affiliate credentials
  affiliateId: string;
  apiKey?: string;
  secretKey?: string;
  
  // Commission
  commissionRate: number; // Percentage
  commissionType: 'percentage' | 'fixed';
  minCommission?: number;
  maxCommission?: number;
  
  // Status
  isActive: boolean;
  startDate: Date;
  endDate?: Date;
  
  // Stats (cached)
  stats: {
    totalClicks: number;
    totalConversions: number;
    totalRevenue: number;
    totalCommission: number;
    conversionRate: number;
    lastUpdated: Date;
  };
  
  // Metadata
  metadata?: Record<string, any>;
}

const AffiliateCampaignSchema = new Schema<IAffiliateCampaign>(
  {
    name: {
      type: String,
      required: true
    },
    description: {
      type: String
    },
    platform: {
      type: String,
      enum: ['shopee', 'lazada', 'tiki', 'sendo', 'tiktok_shop', 'amazon', 'other'],
      required: true,
      index: true
    },
    affiliateId: {
      type: String,
      required: true
    },
    apiKey: {
      type: String
    },
    secretKey: {
      type: String
    },
    commissionRate: {
      type: Number,
      required: true,
      min: 0,
      max: 100
    },
    commissionType: {
      type: String,
      enum: ['percentage', 'fixed'],
      default: 'percentage'
    },
    minCommission: {
      type: Number
    },
    maxCommission: {
      type: Number
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date
    },
    stats: {
      totalClicks: { type: Number, default: 0 },
      totalConversions: { type: Number, default: 0 },
      totalRevenue: { type: Number, default: 0 },
      totalCommission: { type: Number, default: 0 },
      conversionRate: { type: Number, default: 0 },
      lastUpdated: { type: Date, default: Date.now }
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    collection: 'affiliate_campaigns'
  }
);

AffiliateCampaignSchema.index({ platform: 1, isActive: 1 });

export const AffiliateCampaign = mongoose.model<IAffiliateCampaign>('AffiliateCampaign', AffiliateCampaignSchema);

export default { AffiliateClick, AffiliateCampaign };
