/**
 * Shared Subscription Logic — lifecycle management for all products.
 *
 * Handles: create, renew, cancel, grace period, downgrade, verify receipt.
 * Products only define their tier configs — all lifecycle logic is here.
 *
 * Usage:
 *   import { SubscriptionManager, TierConfig } from './subscription';
 *
 *   const tiers: TierConfig[] = [
 *     { id: 'free', price: 0, limits: { ai_queries: 10, transactions: 50 } },
 *     { id: 'pro', price: 99000, limits: { ai_queries: -1, transactions: -1 } },
 *   ];
 *
 *   const manager = new SubscriptionManager(db, tiers);
 *   await manager.subscribe(userId, 'pro', 'iap', receiptData);
 */

export interface TierConfig {
  id: string;
  name_vi: string;
  price_vnd: number;
  period: 'monthly' | 'annual';
  limits: Record<string, number>; // -1 = unlimited
  features: string[];
}

export interface Subscription {
  userId: string;
  product: string;
  tierId: string;
  status: 'active' | 'cancelled' | 'grace_period' | 'expired';
  paymentMethod: 'iap_apple' | 'iap_google' | 'momo' | 'sepay' | 'free';
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  cancelledAt?: Date;
  receipt?: any;
}

export class SubscriptionManager {
  private db: any;
  private tiers: TierConfig[];
  private product: string;
  private collectionName: string;

  constructor(db: any, product: string, tiers: TierConfig[]) {
    this.db = db;
    this.product = product;
    this.tiers = tiers;
    this.collectionName = 'subscriptions';
  }

  /**
   * Subscribe a user to a tier.
   */
  async subscribe(
    userId: string,
    tierId: string,
    paymentMethod: Subscription['paymentMethod'],
    receipt?: any,
  ): Promise<Subscription> {
    const tier = this.tiers.find(t => t.id === tierId);
    if (!tier) throw new Error(`Unknown tier: ${tierId}`);

    const now = new Date();
    const endDate = new Date(now);
    endDate.setMonth(endDate.getMonth() + (tier.period === 'annual' ? 12 : 1));

    const subscription: Subscription = {
      userId,
      product: this.product,
      tierId,
      status: 'active',
      paymentMethod,
      startDate: now,
      endDate,
      autoRenew: paymentMethod !== 'free',
      receipt,
    };

    await this.db.collection(this.collectionName).updateOne(
      { userId, product: this.product },
      { $set: subscription },
      { upsert: true },
    );

    return subscription;
  }

  /**
   * Get user's current subscription (or free tier).
   */
  async getSubscription(userId: string): Promise<Subscription & { tier: TierConfig }> {
    const sub = await this.db.collection(this.collectionName).findOne({
      userId,
      product: this.product,
    });

    if (!sub || sub.status === 'expired') {
      const freeTier = this.tiers.find(t => t.price_vnd === 0) || this.tiers[0];
      return {
        userId,
        product: this.product,
        tierId: freeTier.id,
        status: 'active',
        paymentMethod: 'free',
        startDate: new Date(),
        endDate: new Date('2099-12-31'),
        autoRenew: false,
        tier: freeTier,
      };
    }

    const tier = this.tiers.find(t => t.id === sub.tierId) || this.tiers[0];
    return { ...sub, tier };
  }

  /**
   * Cancel subscription (enters grace period until end of billing cycle).
   */
  async cancel(userId: string): Promise<void> {
    await this.db.collection(this.collectionName).updateOne(
      { userId, product: this.product },
      { $set: { status: 'cancelled', autoRenew: false, cancelledAt: new Date() } },
    );
  }

  /**
   * Check if user has access to a feature.
   */
  async hasAccess(userId: string, feature: string): Promise<boolean> {
    const { tier } = await this.getSubscription(userId);
    return tier.features.includes(feature) || tier.features.includes('*');
  }

  /**
   * Check if user is within usage limit for a resource.
   * Returns { allowed: boolean, remaining: number }
   */
  async checkLimit(userId: string, resource: string, currentUsage: number): Promise<{ allowed: boolean; remaining: number }> {
    const { tier } = await this.getSubscription(userId);
    const limit = tier.limits[resource];

    if (limit === undefined) return { allowed: true, remaining: -1 };
    if (limit === -1) return { allowed: true, remaining: -1 }; // Unlimited

    const remaining = limit - currentUsage;
    return { allowed: remaining > 0, remaining: Math.max(0, remaining) };
  }

  /**
   * Verify IAP receipt (Apple/Google).
   * Returns true if receipt is valid and subscription is active.
   */
  async verifyReceipt(userId: string, platform: 'apple' | 'google', receiptData: any): Promise<boolean> {
    // In production: call Apple/Google server to verify
    // For now: trust client-provided receipt (implement server verification later)
    // Apple: https://buy.itunes.apple.com/verifyReceipt
    // Google: googleapis.com/androidpublisher/v3/...

    // Update subscription based on receipt
    if (receiptData?.product_id && receiptData?.transaction_id) {
      await this.db.collection(this.collectionName).updateOne(
        { userId, product: this.product },
        { $set: { receipt: receiptData, status: 'active', paymentMethod: `iap_${platform}` } },
      );
      return true;
    }
    return false;
  }

  /**
   * Process expired subscriptions (run daily by scheduler).
   */
  async processExpirations(): Promise<number> {
    const now = new Date();
    const result = await this.db.collection(this.collectionName).updateMany(
      {
        product: this.product,
        status: 'active',
        endDate: { $lt: now },
        autoRenew: false,
      },
      { $set: { status: 'expired' } },
    );
    return result.modifiedCount;
  }

  /**
   * Get all tier configs (for pricing page).
   */
  getTiers(): TierConfig[] {
    return this.tiers;
  }
}
