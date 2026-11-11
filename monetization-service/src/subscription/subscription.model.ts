/**
 * Subscription Model for All Apps
 * 
 * Tasks: MON-005, MON-006, MON-008
 */

import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'basic' | 'premium' | 'enterprise';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'paused' | 'pending';
export type BillingCycle = 'monthly' | 'quarterly' | 'yearly';
export type PaymentMethod = 'vnpay' | 'momo' | 'zalopay' | 'bank_transfer' | 'card';

export interface ISubscription extends Document {
  // User info
  userId: mongoose.Types.ObjectId;
  email: string;
  
  // App info
  appId: string;
  appName: string;
  
  // Subscription details
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  billingCycle: BillingCycle;
  
  // Pricing
  price: number;
  currency: string;
  discountPercent?: number;
  finalPrice: number;
  
  // Dates
  startDate: Date;
  endDate: Date;
  nextBillingDate?: Date;
  cancelledAt?: Date;
  pausedAt?: Date;
  
  // Payment
  paymentMethod?: PaymentMethod;
  lastPaymentId?: string;
  lastPaymentDate?: Date;
  autoRenew: boolean;
  
  // Features
  features: {
    maxApiCalls?: number;
    maxStorage?: number;
    adsEnabled: boolean;
    premiumSupport: boolean;
    customFeatures: Record<string, any>;
  };
  
  // Usage tracking
  usage: {
    apiCalls: number;
    storageUsed: number;
    lastActiveAt?: Date;
  };
  
  // Trial info
  isTrialUsed: boolean;
  trialEndDate?: Date;
  
  // Referral
  referralCode?: string;
  referredBy?: mongoose.Types.ObjectId;
  
  // Metadata
  metadata?: Record<string, any>;
}

const SubscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true
    },
    email: {
      type: String,
      required: true,
      index: true
    },
    appId: {
      type: String,
      required: true,
      index: true
    },
    appName: {
      type: String,
      required: true
    },
    tier: {
      type: String,
      enum: ['free', 'basic', 'premium', 'enterprise'],
      default: 'free',
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'expired', 'cancelled', 'paused', 'pending'],
      default: 'pending',
      index: true
    },
    billingCycle: {
      type: String,
      enum: ['monthly', 'quarterly', 'yearly'],
      default: 'monthly'
    },
    price: {
      type: Number,
      required: true,
      min: 0
    },
    currency: {
      type: String,
      default: 'VND'
    },
    discountPercent: {
      type: Number,
      min: 0,
      max: 100
    },
    finalPrice: {
      type: Number,
      required: true,
      min: 0
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true,
      index: true
    },
    nextBillingDate: {
      type: Date
    },
    cancelledAt: {
      type: Date
    },
    pausedAt: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ['vnpay', 'momo', 'zalopay', 'bank_transfer', 'card']
    },
    lastPaymentId: {
      type: String
    },
    lastPaymentDate: {
      type: Date
    },
    autoRenew: {
      type: Boolean,
      default: true
    },
    features: {
      maxApiCalls: { type: Number },
      maxStorage: { type: Number },
      adsEnabled: { type: Boolean, default: true },
      premiumSupport: { type: Boolean, default: false },
      customFeatures: { type: Schema.Types.Mixed, default: {} }
    },
    usage: {
      apiCalls: { type: Number, default: 0 },
      storageUsed: { type: Number, default: 0 },
      lastActiveAt: { type: Date }
    },
    isTrialUsed: {
      type: Boolean,
      default: false
    },
    trialEndDate: {
      type: Date
    },
    referralCode: {
      type: String
    },
    referredBy: {
      type: Schema.Types.ObjectId
    },
    metadata: {
      type: Schema.Types.Mixed
    }
  },
  {
    timestamps: true,
    collection: 'subscriptions'
  }
);

// Compound indexes
SubscriptionSchema.index({ userId: 1, appId: 1 }, { unique: true });
SubscriptionSchema.index({ status: 1, endDate: 1 });
SubscriptionSchema.index({ tier: 1, status: 1 });

// Virtual for isActive
SubscriptionSchema.virtual('isActive').get(function () {
  return this.status === 'active' && this.endDate > new Date();
});

// Methods
SubscriptionSchema.methods.canAccessFeature = function (feature: string): boolean {
  const tierFeatures: Record<SubscriptionTier, string[]> = {
    free: ['basic_access'],
    basic: ['basic_access', 'no_ads', 'extended_history'],
    premium: ['basic_access', 'no_ads', 'extended_history', 'ai_features', 'priority_support'],
    enterprise: ['basic_access', 'no_ads', 'extended_history', 'ai_features', 'priority_support', 'api_access', 'custom_reports']
  };

  return tierFeatures[this.tier]?.includes(feature) || false;
};

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);

/**
 * Subscription Tier Configuration
 */
export const SUBSCRIPTION_TIERS = {
  free: {
    name: 'Miễn phí',
    price: 0,
    features: {
      maxApiCalls: 100,
      maxStorage: 50 * 1024 * 1024, // 50MB
      adsEnabled: true,
      premiumSupport: false
    },
    description: 'Trải nghiệm cơ bản'
  },
  basic: {
    name: 'Cơ bản',
    price: {
      monthly: 49000,
      quarterly: 129000,
      yearly: 490000
    },
    features: {
      maxApiCalls: 1000,
      maxStorage: 500 * 1024 * 1024, // 500MB
      adsEnabled: false,
      premiumSupport: false
    },
    description: 'Không quảng cáo, nhiều tính năng hơn'
  },
  premium: {
    name: 'Cao cấp',
    price: {
      monthly: 99000,
      quarterly: 269000,
      yearly: 990000
    },
    features: {
      maxApiCalls: 10000,
      maxStorage: 2 * 1024 * 1024 * 1024, // 2GB
      adsEnabled: false,
      premiumSupport: true
    },
    description: 'Đầy đủ tính năng AI và hỗ trợ ưu tiên'
  },
  enterprise: {
    name: 'Doanh nghiệp',
    price: {
      monthly: 499000,
      quarterly: 1299000,
      yearly: 4990000
    },
    features: {
      maxApiCalls: -1, // Unlimited
      maxStorage: -1, // Unlimited
      adsEnabled: false,
      premiumSupport: true
    },
    description: 'Không giới hạn, API access, báo cáo tùy chỉnh'
  }
};

export default Subscription;
