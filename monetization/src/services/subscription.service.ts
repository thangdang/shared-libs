/**
 * MON-008, MON-009, MON-010, MON-011, MON-012
 * Subscription Management Service
 */

import { MongoClient, Collection, Db, ObjectId } from 'mongodb';

export interface SubscriptionTier {
  id: string;
  name: string;
  nameVi: string;
  price: number;
  currency: string;
  period: 'monthly' | 'yearly';
  features: string[];
  featuresVi: string[];
  limits: {
    dailyQueries?: number;
    monthlyReports?: number;
    storageGb?: number;
    aiCredits?: number;
  };
  adFree: boolean;
  priority: number;
}

export interface Subscription {
  _id?: ObjectId;
  userId: string;
  tierId: string;
  status: 'active' | 'cancelled' | 'expired' | 'pending' | 'trial';
  startDate: Date;
  endDate: Date;
  trialEndDate?: Date;
  autoRenew: boolean;
  paymentMethod?: string;
  lastPaymentId?: string;
  lastPaymentDate?: Date;
  cancelledAt?: Date;
  cancelReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionPayment {
  _id?: ObjectId;
  subscriptionId: string;
  userId: string;
  tierId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  paymentGateway: 'vnpay' | 'momo' | 'stripe';
  transactionId?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  createdAt: Date;
  completedAt?: Date;
  metadata?: Record<string, any>;
}

// MON-008:  Subscription Tiers Definition
export const SUBSCRIPTION_TIERS: SubscriptionTier[] = [
  {
    id: 'free',
    name: 'Free',
    nameVi: 'Miễn phí',
    price: 0,
    currency: 'VND',
    period: 'monthly',
    features: [
      'Basic features',
      'Limited daily queries',
      'Standard support',
      'Ads included'
    ],
    featuresVi: [
      'Tính năng cơ bản',
      'Giới hạn truy vấn hàng ngày',
      'Hỗ trợ tiêu chuẩn',
      'Có quảng cáo'
    ],
    limits: {
      dailyQueries: 10,
      monthlyReports: 1,
      storageGb: 0.5,
      aiCredits: 0
    },
    adFree: false,
    priority: 0
  },
  {
    id: 'basic',
    name: 'Basic',
    nameVi: 'Cơ bản',
    price: 49000,
    currency: 'VND',
    period: 'monthly',
    features: [
      'All free features',
      'Increased daily queries',
      'Basic reports',
      'Email support',
      'Reduced ads'
    ],
    featuresVi: [
      'Tất cả tính năng miễn phí',
      'Tăng giới hạn truy vấn',
      'Báo cáo cơ bản',
      'Hỗ trợ email',
      'Giảm quảng cáo'
    ],
    limits: {
      dailyQueries: 50,
      monthlyReports: 5,
      storageGb: 2,
      aiCredits: 0
    },
    adFree: false,
    priority: 1
  },
  {
    id: 'premium',
    name: 'Premium',
    nameVi: 'Cao cấp',
    price: 99000,
    currency: 'VND',
    period: 'monthly',
    features: [
      'All basic features',
      'Unlimited queries',
      'Advanced reports',
      'Priority support',
      'Ad-free experience',
      'AI features (when available)',
      'Early access to new features'
    ],
    featuresVi: [
      'Tất cả tính năng cơ bản',
      'Truy vấn không giới hạn',
      'Báo cáo nâng cao',
      'Hỗ trợ ưu tiên',
      'Không quảng cáo',
      'Tính năng AI (khi có)',
      'Trải nghiệm sớm tính năng mới'
    ],
    limits: {
      dailyQueries: -1, // Unlimited
      monthlyReports: -1,
      storageGb: 10,
      aiCredits: 100
    },
    adFree: true,
    priority: 2
  },
  {
    id: 'premium_yearly',
    name: 'Premium Yearly',
    nameVi: 'Cao cấp năm',
    price: 990000, // ~17% discount
    currency: 'VND',
    period: 'yearly',
    features: [
      'All premium features',
      '2 months free',
      'Dedicated support',
      'Extended AI credits'
    ],
    featuresVi: [
      'Tất cả tính năng cao cấp',
      'Miễn phí 2 tháng',
      'Hỗ trợ riêng',
      'Tăng credit AI'
    ],
    limits: {
      dailyQueries: -1,
      monthlyReports: -1,
      storageGb: 20,
      aiCredits: 200
    },
    adFree: true,
    priority: 3
  }
];

export class SubscriptionService {
  private db: Db | null = null;
  private client: MongoClient | null = null;
  private subscriptions: Collection<Subscription> | null = null;
  private payments: Collection<SubscriptionPayment> | null = null;

  constructor(private mongoUri: string, private dbName: string) {}

  async connect(): Promise<void> {
    this.client = new MongoClient(this.mongoUri);
    await this.client.connect();
    this.db = this.client.db(this.dbName);
    this.subscriptions = this.db.collection('subscriptions');
    this.payments = this.db.collection('subscription_payments');
    
    // Create indexes
    await this.subscriptions.createIndexes([
      { key: { userId: 1 }, unique: true },
      { key: { status: 1 } },
      { key: { endDate: 1 } }
    ]);
    
    await this.payments.createIndexes([
      { key: { subscriptionId: 1 } },
      { key: { userId: 1 } },
      { key: { status: 1 } }
    ]);
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
    }
  }

  /**
   * Get available tiers
   */
  getTiers(): SubscriptionTier[] {
    return SUBSCRIPTION_TIERS;
  }

  /**
   * Get tier by ID
   */
  getTier(tierId: string): SubscriptionTier | undefined {
    return SUBSCRIPTION_TIERS.find(t => t.id === tierId);
  }

  /**
   * Get user's current subscription
   */
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    return this.subscriptions!.findOne({ userId });
  }

  /**
   * Check if user has active subscription
   */
  async hasActiveSubscription(userId: string): Promise<boolean> {
    const sub = await this.subscriptions!.findOne({
      userId,
      status: 'active',
      endDate: { $gt: new Date() }
    });
    return !!sub;
  }

  /**
   * Check user's tier
   */
  async getUserTier(userId: string): Promise<SubscriptionTier> {
    const sub = await this.getUserSubscription(userId);
    
    if (!sub || sub.status !== 'active' || sub.endDate < new Date()) {
      return this.getTier('free')!;
    }
    
    return this.getTier(sub.tierId) || this.getTier('free')!;
  }

  /**
   * MON-009:  Create subscription
   */
  async createSubscription(
    userId: string,
    tierId: string,
    paymentId?: string
  ): Promise<Subscription> {
    const tier = this.getTier(tierId);
    if (!tier) {
      throw new Error(`Invalid tier: ${tierId}`);
    }

    const now = new Date();
    const endDate = new Date(now);
    
    if (tier.period === 'yearly') {
      endDate.setFullYear(endDate.getFullYear() + 1);
    } else {
      endDate.setMonth(endDate.getMonth() + 1);
    }

    const subscription: Subscription = {
      userId,
      tierId,
      status: tier.price === 0 ? 'active' : 'pending',
      startDate: now,
      endDate,
      autoRenew: tier.price > 0,
      lastPaymentId: paymentId,
      lastPaymentDate: paymentId ? now : undefined,
      createdAt: now,
      updatedAt: now
    };

    // Upsert subscription
    await this.subscriptions!.updateOne(
      { userId },
      { $set: subscription },
      { upsert: true }
    );

    return subscription;
  }

  /**
   * MON-012:  Upgrade subscription
   */
  async upgradeSubscription(
    userId: string,
    newTierId: string,
    paymentId: string
  ): Promise<Subscription> {
    const currentSub = await this.getUserSubscription(userId);
    const newTier = this.getTier(newTierId);
    
    if (!newTier) {
      throw new Error(`Invalid tier: ${newTierId}`);
    }

    const now = new Date();
    
    // Calculate prorated remaining time from current subscription
    let newEndDate = new Date();
    if (newTier.period === 'yearly') {
      newEndDate.setFullYear(newEndDate.getFullYear() + 1);
    } else {
      newEndDate.setMonth(newEndDate.getMonth() + 1);
    }

    // If upgrading from an active subscription, extend based on remaining value
    if (currentSub && currentSub.status === 'active' && currentSub.endDate > now) {
      const remainingDays = Math.ceil(
        (currentSub.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      // Add remaining days (simplified - real implementation would calculate prorated value)
      newEndDate.setDate(newEndDate.getDate() + Math.floor(remainingDays * 0.5));
    }

    const subscription: Partial<Subscription> = {
      tierId: newTierId,
      status: 'active',
      startDate: now,
      endDate: newEndDate,
      autoRenew: true,
      lastPaymentId: paymentId,
      lastPaymentDate: now,
      updatedAt: now
    };

    await this.subscriptions!.updateOne(
      { userId },
      { $set: subscription }
    );

    return { ...currentSub, ...subscription } as Subscription;
  }

  /**
   * MON-012:  Downgrade subscription
   */
  async downgradeSubscription(userId: string, newTierId: string): Promise<Subscription> {
    const currentSub = await this.getUserSubscription(userId);
    
    if (!currentSub) {
      throw new Error('No subscription found');
    }

    const newTier = this.getTier(newTierId);
    if (!newTier) {
      throw new Error(`Invalid tier: ${newTierId}`);
    }

    // Downgrade takes effect at end of current period
    await this.subscriptions!.updateOne(
      { userId },
      {
        $set: {
          scheduledDowngrade: newTierId,
          autoRenew: false,
          updatedAt: new Date()
        }
      }
    );

    return { ...currentSub, scheduledDowngrade: newTierId } as any;
  }

  /**
   * Cancel subscription
   */
  async cancelSubscription(userId: string, reason?: string): Promise<void> {
    const now = new Date();
    
    await this.subscriptions!.updateOne(
      { userId },
      {
        $set: {
          status: 'cancelled',
          autoRenew: false,
          cancelledAt: now,
          cancelReason: reason,
          updatedAt: now
        }
      }
    );
  }

  /**
   * MON-011:  Check and expire subscriptions (cron job)
   */
  async processExpiredSubscriptions(): Promise<number> {
    const now = new Date();
    
    const result = await this.subscriptions!.updateMany(
      {
        status: 'active',
        endDate: { $lt: now }
      },
      {
        $set: {
          status: 'expired',
          updatedAt: now
        }
      }
    );

    console.log(`[Subscription] Expired ${result.modifiedCount} subscriptions`);
    return result.modifiedCount;
  }

  /**
   * Process auto-renewals (cron job)
   */
  async processAutoRenewals(): Promise<void> {
    const now = new Date();
    const renewalWindow = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours ahead
    
    const subscriptionsToRenew = await this.subscriptions!.find({
      status: 'active',
      autoRenew: true,
      endDate: { $lte: renewalWindow, $gt: now }
    }).toArray();

    for (const sub of subscriptionsToRenew) {
      // Here you would integrate with payment gateway to charge
      console.log(`[Subscription] Would auto-renew subscription for user ${sub.userId}`);
    }
  }

  /**
   * MON-010:  Middleware helper - check tier access
   */
  async checkTierAccess(userId: string, requiredTier: string): Promise<boolean> {
    const userTier = await this.getUserTier(userId);
    const required = this.getTier(requiredTier);
    
    if (!required) return false;
    
    return userTier.priority >= required.priority;
  }

  /**
   * Check feature limit
   */
  async checkLimit(
    userId: string,
    limitType: keyof SubscriptionTier['limits'],
    currentUsage: number
  ): Promise<{ allowed: boolean; limit: number; usage: number }> {
    const tier = await this.getUserTier(userId);
    const limit = tier.limits[limitType] ?? 0;
    
    // -1 means unlimited
    const allowed = limit === -1 || currentUsage < limit;
    
    return { allowed, limit, usage: currentUsage };
  }
}

export default SubscriptionService;
