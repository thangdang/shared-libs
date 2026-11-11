/**
 * Subscription Service
 * Task: SHARED-008 (continued)
 * 
 * Manages Premium subscriptions across all 5 apps
 * 99K VND/month pricing
 */

export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';
export type AppId = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

export interface Subscription {
  id: string;
  userId: string;
  appId: AppId;
  status: SubscriptionStatus;
  startDate: Date;
  endDate: Date;
  autoRenew: boolean;
  paymentMethod: 'vnpay' | 'referral' | 'points';
  transactionId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface SubscriptionCreate {
  userId: string;
  appId: AppId;
  durationDays: number;
  paymentMethod: 'vnpay' | 'referral' | 'points';
  transactionId?: string;
}

export interface PremiumBenefits {
  appId: AppId;
  benefits: string[];
  price: number;
  currency: string;
}

// Premium benefits for each app
const PREMIUM_BENEFITS: Record<AppId, PremiumBenefits> = {
  trendbrief: {
    appId: 'trendbrief',
    benefits: [
      'Không quảng cáo',
      'Đọc tin không giới hạn',
      'Lưu tin yêu thích không giới hạn',
      'Thông báo tin nóng ưu tiên',
      'Export tin tức sang PDF'
    ],
    price: 99000,
    currency: 'VND'
  },
  smartbuy: {
    appId: 'smartbuy',
    benefits: [
      'Không quảng cáo',
      'Thông báo giảm giá không giới hạn',
      'Xem lịch sử giá 1 năm',
      'So sánh giá không giới hạn sản phẩm',
      'Xuất báo cáo giá sang Excel',
      'Ưu tiên thông báo Flash Sale'
    ],
    price: 99000,
    currency: 'VND'
  },
  fintax: {
    appId: 'fintax',
    benefits: [
      'Không quảng cáo',
      'Quản lý không giới hạn giao dịch',
      'Báo cáo chi tiêu nâng cao',
      'Xuất dữ liệu sang Excel',
      'Nhắc nhở deadline thuế',
      'Tính thuế nhiều nguồn thu nhập'
    ],
    price: 99000,
    currency: 'VND'
  },
  doctorcar: {
    appId: 'doctorcar',
    benefits: [
      'Không quảng cáo',
      'Tra cứu mã lỗi không giới hạn',
      'Lịch bảo dưỡng cá nhân hóa',
      'Nhắc nhở bảo dưỡng',
      'Lưu trữ lịch sử xe không giới hạn',
      'Xuất báo cáo bảo dưỡng'
    ],
    price: 99000,
    currency: 'VND'
  },
  caremate: {
    appId: 'caremate',
    benefits: [
      'Không quảng cáo',
      'Tra cứu thuốc không giới hạn',
      'Lưu trữ hồ sơ sức khỏe gia đình',
      'Nhắc nhở uống thuốc',
      'So sánh giá thuốc tất cả nhà thuốc',
      'Xuất hồ sơ sức khỏe'
    ],
    price: 99000,
    currency: 'VND'
  }
};

export class SubscriptionService {
  // In-memory store (replace with MongoDB in production)
  private subscriptions: Map<string, Subscription> = new Map();

  /**
   * Create or extend subscription
   */
  async createSubscription(data: SubscriptionCreate): Promise<Subscription> {
    const existingSub = await this.getActiveSubscription(data.userId, data.appId);
    
    const now = new Date();
    let startDate = now;
    let endDate: Date;

    if (existingSub && existingSub.status === 'active') {
      // Extend existing subscription
      startDate = existingSub.startDate;
      endDate = new Date(existingSub.endDate);
      endDate.setDate(endDate.getDate() + data.durationDays);
    } else {
      // New subscription
      endDate = new Date(now);
      endDate.setDate(endDate.getDate() + data.durationDays);
    }

    const subscription: Subscription = {
      id: this.generateId(),
      userId: data.userId,
      appId: data.appId,
      status: 'active',
      startDate,
      endDate,
      autoRenew: data.paymentMethod === 'vnpay',
      paymentMethod: data.paymentMethod,
      transactionId: data.transactionId,
      createdAt: now,
      updatedAt: now
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  /**
   * Get active subscription for user and app
   */
  async getActiveSubscription(userId: string, appId: AppId): Promise<Subscription | null> {
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId && sub.appId === appId && sub.status === 'active') {
        // Check if expired
        if (new Date() > sub.endDate) {
          sub.status = 'expired';
          sub.updatedAt = new Date();
          return null;
        }
        return sub;
      }
    }
    return null;
  }

  /**
   * Check if user has active Premium
   */
  async isPremium(userId: string, appId: AppId): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, appId);
    return sub !== null;
  }

  /**
   * Get remaining days
   */
  async getRemainingDays(userId: string, appId: AppId): Promise<number> {
    const sub = await this.getActiveSubscription(userId, appId);
    if (!sub) return 0;

    const now = new Date();
    const diff = sub.endDate.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  /**
   * Add days from referral or points redemption
   */
  async addDays(userId: string, appId: AppId, days: number, source: 'referral' | 'points'): Promise<Subscription> {
    return this.createSubscription({
      userId,
      appId,
      durationDays: days,
      paymentMethod: source
    });
  }

  /**
   * Cancel subscription (stop auto-renew)
   */
  async cancelAutoRenew(userId: string, appId: AppId): Promise<boolean> {
    const sub = await this.getActiveSubscription(userId, appId);
    if (!sub) return false;

    sub.autoRenew = false;
    sub.updatedAt = new Date();
    return true;
  }

  /**
   * Get premium benefits for an app
   */
  getPremiumBenefits(appId: AppId): PremiumBenefits {
    return PREMIUM_BENEFITS[appId];
  }

  /**
   * Get all premium benefits
   */
  getAllPremiumBenefits(): Record<AppId, PremiumBenefits> {
    return PREMIUM_BENEFITS;
  }

  /**
   * Get user's subscriptions across all apps
   */
  async getUserSubscriptions(userId: string): Promise<Subscription[]> {
    const subs: Subscription[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId) {
        subs.push(sub);
      }
    }
    return subs;
  }

  /**
   * Process successful VNPay payment
   */
  async processPaymentSuccess(
    userId: string, 
    appId: AppId, 
    transactionId: string
  ): Promise<Subscription> {
    return this.createSubscription({
      userId,
      appId,
      durationDays: 30, // 1 month
      paymentMethod: 'vnpay',
      transactionId
    });
  }

  private generateId(): string {
    return `sub_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// Singleton
export const subscriptionService = new SubscriptionService();
