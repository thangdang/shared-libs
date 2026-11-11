/**
 * Web Push Notification Service - Shared Growth Infrastructure
 * Browser push notifications for price drops, deadlines, and alerts
 * For all 5 AI apps: TrendBrief, SmartBuy, FinTax, DoctorCar, CareMate
 * 
 * Integration: OneSignal (free tier - 10K subscribers)
 */

import { AppId } from './analytics.service';

export interface PushNotification {
  notificationId: string;
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  tag?: string; // for replacing/stacking
  requireInteraction?: boolean;
  data?: Record<string, any>;
  actions?: PushAction[];
  ttl?: number; // time to live in seconds
}

export interface PushAction {
  action: string;
  title: string;
  icon?: string;
}

export interface PushSubscriber {
  playerId: string; // OneSignal player ID
  userId?: string;
  appId: AppId;
  subscribed: boolean;
  subscribedAt?: Date;
  lastActive?: Date;
  tags: Record<string, string>;
  segments: string[];
  deviceType: 'web' | 'android' | 'ios';
  timezone: string;
}

export interface PushCampaign {
  campaignId: string;
  name: string;
  appId: AppId | 'all';
  notification: PushNotification;
  segments: string[];
  scheduledAt?: Date;
  sentAt?: Date;
  status: 'draft' | 'scheduled' | 'sent' | 'cancelled';
  stats?: {
    sent: number;
    delivered: number;
    clicked: number;
    dismissed: number;
  };
}

// Predefined notification templates
export const PUSH_TEMPLATES = {
  // TrendBrief - Breaking news
  breakingNews: {
    icon: '/icons/trendbrief-icon.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'breaking-news',
    ttl: 3600
  },

  // SmartBuy - Price drop
  priceDrop: {
    icon: '/icons/smartbuy-icon.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'price-drop',
    ttl: 86400,
    actions: [
      { action: 'view', title: 'Xem ngay' },
      { action: 'dismiss', title: 'Bỏ qua' }
    ]
  },

  // SmartBuy - Flash sale
  flashSale: {
    icon: '/icons/smartbuy-icon.png',
    badge: '/icons/flash-sale.png',
    requireInteraction: true,
    tag: 'flash-sale',
    ttl: 7200
  },

  // FinTax - Tax deadline
  taxDeadline: {
    icon: '/icons/fintax-icon.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'tax-deadline',
    ttl: 86400
  },

  // DoctorCar - Maintenance reminder
  maintenanceReminder: {
    icon: '/icons/doctorcar-icon.png',
    badge: '/icons/badge.png',
    tag: 'maintenance',
    ttl: 604800 // 1 week
  },

  // CareMate - Medication reminder
  medicationReminder: {
    icon: '/icons/caremate-icon.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'medication',
    ttl: 3600
  },

  // CareMate - Vaccination reminder
  vaccinationReminder: {
    icon: '/icons/caremate-icon.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'vaccination',
    ttl: 86400
  },

  // Generic - Streak at risk
  streakAtRisk: {
    icon: '/icons/streak.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'streak',
    ttl: 43200 // 12 hours
  },

  // Generic - Achievement unlocked
  achievement: {
    icon: '/icons/achievement.png',
    badge: '/icons/badge.png',
    tag: 'achievement',
    ttl: 86400
  },

  // Generic - Referral success
  referralSuccess: {
    icon: '/icons/referral.png',
    badge: '/icons/badge.png',
    requireInteraction: true,
    tag: 'referral',
    ttl: 86400
  }
};

class WebPushService {
  private oneSignalAppId: string = '';
  private userId?: string;
  private appId: AppId;
  private isInitialized = false;
  private playerId?: string;

  constructor() {
    this.appId = this.detectAppId();
  }

  private detectAppId(): AppId {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('trendbrief')) return 'trendbrief';
    if (hostname.includes('smartbuy')) return 'smartbuy';
    if (hostname.includes('fintax')) return 'fintax';
    if (hostname.includes('doctorcar')) return 'doctorcar';
    if (hostname.includes('caremate')) return 'caremate';
    return 'trendbrief';
  }

  /**
   * Initialize OneSignal
   */
  async initialize(appId: string): Promise<void> {
    if (this.isInitialized || typeof window === 'undefined') return;

    this.oneSignalAppId = appId;

    // Load OneSignal SDK
    await this.loadOneSignalSDK();

    // Initialize
    window.OneSignal = window.OneSignal || [];
    window.OneSignal.push(() => {
      window.OneSignal.init({
        appId: this.oneSignalAppId,
        allowLocalhostAsSecureOrigin: true,
        notifyButton: {
          enable: false // We use our own UI
        },
        welcomeNotification: {
          disable: true
        }
      });

      // Get player ID
      window.OneSignal.getUserId((playerId: string) => {
        this.playerId = playerId;
      });

      // Listen for subscription changes
      window.OneSignal.on('subscriptionChange', (isSubscribed: boolean) => {
        this.onSubscriptionChange(isSubscribed);
      });
    });

    this.isInitialized = true;
  }

  /**
   * Load OneSignal SDK script
   */
  private loadOneSignalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (document.getElementById('onesignal-sdk')) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.id = 'onesignal-sdk';
      script.src = 'https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js';
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
      document.head.appendChild(script);
    });
  }

  /**
   * Handle subscription change
   */
  private async onSubscriptionChange(isSubscribed: boolean): Promise<void> {
    if (isSubscribed && this.playerId) {
      // Set default tags
      await this.setTags({
        app_id: this.appId,
        subscribed_at: new Date().toISOString()
      });

      // Report to our backend
      await this.reportSubscription(true);
    } else {
      await this.reportSubscription(false);
    }
  }

  /**
   * Report subscription status to backend
   */
  private async reportSubscription(subscribed: boolean): Promise<void> {
    try {
      await fetch('/api/push/subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          userId: this.userId,
          appId: this.appId,
          subscribed
        })
      });
    } catch (error) {
      console.error('Failed to report subscription:', error);
    }
  }

  /**
   * Set user ID for targeting
   */
  setUserId(userId: string): void {
    this.userId = userId;

    if (window.OneSignal && this.playerId) {
      window.OneSignal.setExternalUserId(userId);
      this.setTags({ user_id: userId });
    }
  }

  /**
   * Request push permission
   */
  async requestPermission(): Promise<boolean> {
    if (!this.isInitialized || typeof window === 'undefined') return false;

    return new Promise((resolve) => {
      window.OneSignal.push(() => {
        window.OneSignal.showNativePrompt();
        
        window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
          resolve(isEnabled);
        });
      });
    });
  }

  /**
   * Check if push is enabled
   */
  async isPushEnabled(): Promise<boolean> {
    if (!this.isInitialized || typeof window === 'undefined') return false;

    return new Promise((resolve) => {
      window.OneSignal.push(() => {
        window.OneSignal.isPushNotificationsEnabled((isEnabled: boolean) => {
          resolve(isEnabled);
        });
      });
    });
  }

  /**
   * Get permission state
   */
  async getPermissionState(): Promise<'default' | 'granted' | 'denied'> {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      return 'denied';
    }
    return Notification.permission;
  }

  /**
   * Set tags for segmentation
   */
  async setTags(tags: Record<string, string>): Promise<void> {
    if (!this.isInitialized || typeof window === 'undefined') return;

    window.OneSignal.push(() => {
      window.OneSignal.sendTags(tags);
    });
  }

  /**
   * Remove tags
   */
  async removeTags(tagKeys: string[]): Promise<void> {
    if (!this.isInitialized || typeof window === 'undefined') return;

    window.OneSignal.push(() => {
      window.OneSignal.deleteTags(tagKeys);
    });
  }

  /**
   * Send price drop notification
   */
  async sendPriceDropAlert(
    productName: string,
    oldPrice: number,
    newPrice: number,
    productUrl: string,
    imageUrl?: string
  ): Promise<void> {
    const discount = Math.round(((oldPrice - newPrice) / oldPrice) * 100);
    
    await this.sendToBackend({
      ...PUSH_TEMPLATES.priceDrop,
      title: `💰 Giảm ${discount}%: ${productName}`,
      body: `Giá mới: ${this.formatPrice(newPrice)} (trước đó ${this.formatPrice(oldPrice)})`,
      url: productUrl,
      image: imageUrl,
      data: {
        type: 'price_drop',
        product_name: productName,
        old_price: oldPrice,
        new_price: newPrice,
        discount
      }
    });
  }

  /**
   * Send flash sale notification
   */
  async sendFlashSaleAlert(
    title: string,
    description: string,
    expiresAt: Date,
    url: string
  ): Promise<void> {
    const timeLeft = this.getTimeLeft(expiresAt);
    
    await this.sendToBackend({
      ...PUSH_TEMPLATES.flashSale,
      title: `⚡ Flash Sale: ${title}`,
      body: `${description} - Còn ${timeLeft}`,
      url,
      data: {
        type: 'flash_sale',
        expires_at: expiresAt.toISOString()
      }
    });
  }

  /**
   * Send breaking news notification (TrendBrief)
   */
  async sendBreakingNews(
    headline: string,
    source: string,
    articleUrl: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.breakingNews,
      title: `🔴 TIN NÓNG`,
      body: headline,
      url: articleUrl,
      data: {
        type: 'breaking_news',
        source
      }
    });
  }

  /**
   * Send tax deadline reminder (FinTax)
   */
  async sendTaxDeadlineReminder(
    taxType: string,
    deadline: Date,
    daysLeft: number,
    url: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.taxDeadline,
      title: `📅 Nhắc nhở hạn nộp thuế`,
      body: `Còn ${daysLeft} ngày để nộp ${taxType}. Deadline: ${deadline.toLocaleDateString('vi-VN')}`,
      url,
      data: {
        type: 'tax_deadline',
        tax_type: taxType,
        deadline: deadline.toISOString(),
        days_left: daysLeft
      }
    });
  }

  /**
   * Send maintenance reminder (DoctorCar)
   */
  async sendMaintenanceReminder(
    carName: string,
    maintenanceType: string,
    dueKm: number,
    currentKm: number,
    url: string
  ): Promise<void> {
    const kmLeft = dueKm - currentKm;
    
    await this.sendToBackend({
      ...PUSH_TEMPLATES.maintenanceReminder,
      title: `🚗 Nhắc nhở bảo dưỡng`,
      body: `${carName}: ${maintenanceType} - Còn ${kmLeft.toLocaleString('vi-VN')}km`,
      url,
      data: {
        type: 'maintenance',
        car_name: carName,
        maintenance_type: maintenanceType,
        due_km: dueKm,
        current_km: currentKm
      }
    });
  }

  /**
   * Send medication reminder (CareMate)
   */
  async sendMedicationReminder(
    memberName: string,
    medicationName: string,
    dosage: string,
    url: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.medicationReminder,
      title: `💊 Nhắc nhở uống thuốc`,
      body: `${memberName}: ${medicationName} - ${dosage}`,
      url,
      data: {
        type: 'medication',
        member_name: memberName,
        medication_name: medicationName,
        dosage
      }
    });
  }

  /**
   * Send vaccination reminder (CareMate)
   */
  async sendVaccinationReminder(
    memberName: string,
    vaccineName: string,
    scheduleDate: Date,
    url: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.vaccinationReminder,
      title: `💉 Lịch tiêm chủng`,
      body: `${memberName}: ${vaccineName} vào ${scheduleDate.toLocaleDateString('vi-VN')}`,
      url,
      data: {
        type: 'vaccination',
        member_name: memberName,
        vaccine_name: vaccineName,
        schedule_date: scheduleDate.toISOString()
      }
    });
  }

  /**
   * Send streak at risk notification
   */
  async sendStreakAtRisk(currentStreak: number, url: string): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.streakAtRisk,
      title: `⚠️ Chuỗi ${currentStreak} ngày sắp mất!`,
      body: `Đừng để mất chuỗi ngày của bạn. Mở app ngay hôm nay!`,
      url,
      data: {
        type: 'streak_at_risk',
        current_streak: currentStreak
      }
    });
  }

  /**
   * Send achievement notification
   */
  async sendAchievementUnlocked(
    achievementName: string,
    description: string,
    url: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.achievement,
      title: `🏆 Mở khóa: ${achievementName}`,
      body: description,
      url,
      data: {
        type: 'achievement',
        achievement_name: achievementName
      }
    });
  }

  /**
   * Send referral success notification
   */
  async sendReferralSuccess(
    friendName: string,
    rewardDays: number,
    url: string
  ): Promise<void> {
    await this.sendToBackend({
      ...PUSH_TEMPLATES.referralSuccess,
      title: `🎉 ${friendName} đã đăng ký!`,
      body: `Bạn nhận được ${rewardDays} ngày Premium miễn phí!`,
      url,
      data: {
        type: 'referral_success',
        friend_name: friendName,
        reward_days: rewardDays
      }
    });
  }

  /**
   * Send notification to backend for delivery
   */
  private async sendToBackend(notification: Partial<PushNotification>): Promise<void> {
    try {
      await fetch('/api/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: this.playerId,
          userId: this.userId,
          appId: this.appId,
          notification
        })
      });
    } catch (error) {
      console.error('Failed to send push notification:', error);
    }
  }

  /**
   * Format price for display
   */
  private formatPrice(price: number): string {
    return price.toLocaleString('vi-VN') + 'đ';
  }

  /**
   * Get time left string
   */
  private getTimeLeft(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();
    
    if (diff <= 0) return 'Đã hết hạn';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} ngày`;
    }
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    
    return `${minutes} phút`;
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribe(): Promise<void> {
    if (!this.isInitialized || typeof window === 'undefined') return;

    window.OneSignal.push(() => {
      window.OneSignal.setSubscription(false);
    });
  }
}

// Singleton instance
export const webPushService = new WebPushService();

// Convenience exports
export const requestPushPermission = () => webPushService.requestPermission();
export const isPushEnabled = () => webPushService.isPushEnabled();
export const sendPriceDropAlert = (
  productName: string,
  oldPrice: number,
  newPrice: number,
  productUrl: string,
  imageUrl?: string
) => webPushService.sendPriceDropAlert(productName, oldPrice, newPrice, productUrl, imageUrl);

// TypeScript declarations for OneSignal
declare global {
  interface Window {
    OneSignal: any[];
  }
}
