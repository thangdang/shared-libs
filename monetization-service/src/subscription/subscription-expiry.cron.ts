/**
 * Subscription Expiry Checker Cron
 * MON-011:  Create subscription expiry checker (cron)
 * 
 * Runs daily to check and handle expiring/expired subscriptions
 */

import { EventEmitter } from 'events';

// Subscription status types
type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'paused' | 'grace_period';

interface Subscription {
  _id: string;
  userId: string;
  tier: 'free' | 'basic' | 'premium' | 'enterprise';
  status: SubscriptionStatus;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  autoRenew: boolean;
  paymentMethod?: string;
  email?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface ExpiryCheckResult {
  totalChecked: number;
  expiringSoon: number;
  expired: number;
  movedToGrace: number;
  downgraded: number;
  renewalReminders: number;
  errors: string[];
}

type ExpiryCallback = (subscription: Subscription) => Promise<void>;

export class SubscriptionExpiryCron extends EventEmitter {
  private isRunning = false;
  private intervalId?: NodeJS.Timeout;
  private db: any; // MongoDB collection reference
  
  // Configuration
  private config = {
    gracePeriodDays: 3,      // Days after expiry before downgrade
    reminderDays: [7, 3, 1], // Days before expiry to send reminders
    checkIntervalMs: 24 * 60 * 60 * 1000, // Default:  daily
  };

  // Callbacks
  private onExpiringSoon?: ExpiryCallback;
  private onExpired?: ExpiryCallback;
  private onGracePeriodEnded?: ExpiryCallback;

  constructor(dbCollection?: any) {
    super();
    this.db = dbCollection;
  }

  /**
   * Configure the cron job
   */
  configure(options: Partial<typeof this.config>): this {
    this.config = { ...this.config, ...options };
    return this;
  }

  /**
   * Set MongoDB collection
   */
  setCollection(collection: any): this {
    this.db = collection;
    return this;
  }

  /**
   * Register callback for subscriptions expiring soon
   */
  onExpiringSoonCallback(callback: ExpiryCallback): this {
    this.onExpiringSoon = callback;
    return this;
  }

  /**
   * Register callback for expired subscriptions
   */
  onExpiredCallback(callback: ExpiryCallback): this {
    this.onExpired = callback;
    return this;
  }

  /**
   * Register callback for grace period ended (downgrade)
   */
  onGracePeriodEndedCallback(callback: ExpiryCallback): this {
    this.onGracePeriodEnded = callback;
    return this;
  }

  /**
   * Start the cron job
   */
  start(): void {
    if (this.isRunning) {
      console.log('[SubscriptionExpiry] Cron already running');
      return;
    }

    console.log('[SubscriptionExpiry] Starting cron job...');
    this.isRunning = true;

    // Run immediately on start
    this.runCheck();

    // Schedule periodic checks
    this.intervalId = setInterval(() => {
      this.runCheck();
    }, this.config.checkIntervalMs);

    this.emit('started');
  }

  /**
   * Stop the cron job
   */
  stop(): void {
    if (!this.isRunning) return;

    console.log('[SubscriptionExpiry] Stopping cron job...');
    this.isRunning = false;

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    this.emit('stopped');
  }

  /**
   * Run a single check cycle
   */
  async runCheck(): Promise<ExpiryCheckResult> {
    const result: ExpiryCheckResult = {
      totalChecked: 0,
      expiringSoon: 0,
      expired: 0,
      movedToGrace: 0,
      downgraded: 0,
      renewalReminders: 0,
      errors: [],
    };

    const now = new Date();
    console.log(`[SubscriptionExpiry] Running check at ${now.toISOString()}`);

    try {
      // Get all active and grace period subscriptions
      const subscriptions = await this.getActiveSubscriptions();
      result.totalChecked = subscriptions.length;

      for (const subscription of subscriptions) {
        try {
          await this.processSubscription(subscription, now, result);
        } catch (error) {
          const errorMsg = `Error processing subscription ${subscription._id}: ${error}`;
          result.errors.push(errorMsg);
          console.error('[SubscriptionExpiry]', errorMsg);
        }
      }

      console.log('[SubscriptionExpiry] Check completed:', JSON.stringify(result, null, 2));
      this.emit('checkCompleted', result);

    } catch (error) {
      const errorMsg = `Fatal error during check: ${error}`;
      result.errors.push(errorMsg);
      console.error('[SubscriptionExpiry]', errorMsg);
      this.emit('error', error);
    }

    return result;
  }

  /**
   * Get all active and grace period subscriptions
   */
  private async getActiveSubscriptions(): Promise<Subscription[]> {
    if (!this.db) {
      // Demo mode:  return sample data
      return this.getSampleSubscriptions();
    }

    return this.db.find({
      status: { $in: ['active', 'grace_period'] },
      tier: { $ne: 'free' }, // Don't check free tier
    }).toArray();
  }

  /**
   * Process a single subscription
   */
  private async processSubscription(
    subscription: Subscription,
    now: Date,
    result: ExpiryCheckResult
  ): Promise<void> {
    const endDate = new Date(subscription.currentPeriodEnd);
    const daysUntilExpiry = this.daysBetween(now, endDate);

    // Check if subscription has expired
    if (daysUntilExpiry < 0) {
      await this.handleExpiredSubscription(subscription, Math.abs(daysUntilExpiry), result);
      return;
    }

    // Check if expiring soon (send reminders)
    if (this.config.reminderDays.includes(daysUntilExpiry)) {
      await this.handleExpiringSoon(subscription, daysUntilExpiry, result);
    }
  }

  /**
   * Handle an expired subscription
   */
  private async handleExpiredSubscription(
    subscription: Subscription,
    daysExpired: number,
    result: ExpiryCheckResult
  ): Promise<void> {
    result.expired++;

    // Check if still in grace period
    if (daysExpired <= this.config.gracePeriodDays) {
      // Move to grace period if not already
      if (subscription.status !== 'grace_period') {
        await this.updateSubscriptionStatus(subscription._id, 'grace_period');
        result.movedToGrace++;

        console.log(`[SubscriptionExpiry] Subscription ${subscription._id} moved to grace period (${daysExpired} days expired)`);

        if (this.onExpired) {
          await this.onExpired(subscription);
        }
      }
    } else {
      // Grace period ended - downgrade to free
      await this.downgradeToFree(subscription);
      result.downgraded++;

      console.log(`[SubscriptionExpiry] Subscription ${subscription._id} downgraded to free (grace period ended)`);

      if (this.onGracePeriodEnded) {
        await this.onGracePeriodEnded(subscription);
      }
    }
  }

  /**
   * Handle subscription expiring soon
   */
  private async handleExpiringSoon(
    subscription: Subscription,
    daysUntilExpiry: number,
    result: ExpiryCheckResult
  ): Promise<void> {
    result.expiringSoon++;

    // Only send reminder if auto-renew is off
    if (!subscription.autoRenew) {
      result.renewalReminders++;
      console.log(`[SubscriptionExpiry] Sending reminder for subscription ${subscription._id} (${daysUntilExpiry} days until expiry)`);

      if (this.onExpiringSoon) {
        await this.onExpiringSoon(subscription);
      }
    }
  }

  /**
   * Update subscription status in database
   */
  private async updateSubscriptionStatus(subscriptionId: string, status: SubscriptionStatus): Promise<void> {
    if (!this.db) {
      console.log(`[SubscriptionExpiry] Demo mode:  Would update ${subscriptionId} to status ${status}`);
      return;
    }

    await this.db.updateOne(
      { _id: subscriptionId },
      { 
        $set: { 
          status, 
          updatedAt: new Date() 
        } 
      }
    );
  }

  /**
   * Downgrade subscription to free tier
   */
  private async downgradeToFree(subscription: Subscription): Promise<void> {
    if (!this.db) {
      console.log(`[SubscriptionExpiry] Demo mode:  Would downgrade ${subscription._id} to free`);
      return;
    }

    await this.db.updateOne(
      { _id: subscription._id },
      {
        $set: {
          tier: 'free',
          status: 'expired',
          previousTier: subscription.tier,
          downgradeDate: new Date(),
          updatedAt: new Date(),
        }
      }
    );
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(date1: Date, date2: Date): number {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date2.getTime() - date1.getTime()) / oneDay);
  }

  /**
   * Sample subscriptions for demo mode
   */
  private getSampleSubscriptions(): Subscription[] {
    const now = new Date();
    return [
      {
        _id: 'sub_demo_1',
        userId: 'user_1',
        tier: 'premium',
        status: 'active',
        currentPeriodStart: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000),
        autoRenew: false,
        email: 'user1@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        _id: 'sub_demo_2',
        userId: 'user_2',
        tier: 'basic',
        status: 'active',
        currentPeriodStart: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        currentPeriodEnd: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
        autoRenew: false,
        email: 'user2@example.com',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];
  }
}

/**
 * Create and configure expiry cron with email notifications
 */
export function createExpiryChecker(options?: {
  db?: any;
  sendEmail?: (to: string, subject: string, body: string) => Promise<void>;
}): SubscriptionExpiryCron {
  const cron = new SubscriptionExpiryCron(options?.db);

  if (options?.sendEmail) {
    cron.onExpiringSoonCallback(async (subscription) => {
      if (subscription.email) {
        await options.sendEmail!(
          subscription.email,
          'Gói đăng ký sắp hết hạn',
          `Gói ${subscription.tier} của bạn sẽ hết hạn trong vài ngày tới. Vui lòng gia hạn để tiếp tục sử dụng dịch vụ.`
        );
      }
    });

    cron.onExpiredCallback(async (subscription) => {
      if (subscription.email) {
        await options.sendEmail!(
          subscription.email,
          'Gói đăng ký đã hết hạn',
          `Gói ${subscription.tier} của bạn đã hết hạn. Bạn có ${3} ngày grace period để gia hạn trước khi tài khoản bị chuyển về gói miễn phí.`
        );
      }
    });

    cron.onGracePeriodEndedCallback(async (subscription) => {
      if (subscription.email) {
        await options.sendEmail!(
          subscription.email,
          'Tài khoản đã chuyển về gói miễn phí',
          `Gói ${subscription.tier} của bạn đã hết hạn và grace period đã kết thúc. Tài khoản của bạn đã được chuyển về gói miễn phí. Gia hạn ngay để khôi phục các tính năng premium.`
        );
      }
    });
  }

  return cron;
}

export default SubscriptionExpiryCron;
