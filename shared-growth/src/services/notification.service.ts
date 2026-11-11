/**
 * Notification Service - Shared Growth Infrastructure
 * Push notifications, email notifications, and in-app messaging
 * For all 5 AI apps: TrendBrief, SmartBuy, FinTax, DoctorCar, CareMate
 */

import { AppId } from './analytics.service';

export interface Notification {
  notificationId: string;
  userId: string;
  appId: AppId;
  type: NotificationType;
  channel: NotificationChannel;
  title: string;
  body: string;
  data?: Record<string, any>;
  actionUrl?: string;
  imageUrl?: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  status: NotificationStatus;
  scheduledAt?: Date;
  sentAt?: Date;
  readAt?: Date;
  createdAt: Date;
  expiresAt?: Date;
}

export type NotificationType = 
  | 'system'
  | 'marketing'
  | 'transactional'
  | 'reminder'
  | 'achievement'
  | 'referral'
  | 'update'
  | 'alert';

export type NotificationChannel = 'push' | 'email' | 'in_app' | 'sms';

export type NotificationStatus = 'pending' | 'scheduled' | 'sent' | 'delivered' | 'read' | 'failed';

export interface NotificationPreferences {
  userId: string;
  appId: AppId;
  channels: {
    push: boolean;
    email: boolean;
    inApp: boolean;
    sms: boolean;
  };
  types: {
    system: boolean;
    marketing: boolean;
    transactional: boolean;
    reminder: boolean;
    achievement: boolean;
    referral: boolean;
    update: boolean;
    alert: boolean;
  };
  quietHours?: {
    enabled: boolean;
    start: string; // HH:mm format
    end: string;
    timezone: string;
  };
  frequency: {
    maxPerDay: number;
    maxPerWeek: number;
  };
}

export interface NotificationTemplate {
  templateId: string;
  name: string;
  appId: AppId | 'all';
  type: NotificationType;
  channels: NotificationChannel[];
  subject?: string; // for email
  title: string;
  body: string;
  variables: string[]; // placeholders like {{userName}}
  actionUrl?: string;
  imageUrl?: string;
}

export interface InAppNotification {
  notificationId: string;
  title: string;
  body: string;
  type: NotificationType;
  actionUrl?: string;
  imageUrl?: string;
  isRead: boolean;
  createdAt: Date;
}

export interface PushSubscription {
  userId: string;
  appId: AppId;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  lastUsed?: Date;
  isActive: boolean;
}

// Predefined notification templates for growth
export const NOTIFICATION_TEMPLATES: NotificationTemplate[] = [
  // Onboarding sequence
  {
    templateId: 'welcome',
    name: 'Welcome Email',
    appId: 'all',
    type: 'transactional',
    channels: ['email', 'in_app'],
    subject: 'Chào mừng {{userName}} đến với {{appName}}! 🎉',
    title: 'Chào mừng bạn!',
    body: 'Cảm ơn bạn đã đăng ký {{appName}}.  Bắt đầu khám phá các tính năng ngay!',
    variables: ['userName', 'appName'],
    actionUrl: '/dashboard'
  },
  {
    templateId: 'onboarding-day1',
    name: 'Day 1 Onboarding',
    appId: 'all',
    type: 'marketing',
    channels: ['email', 'push'],
    subject: '{{userName}}, hoàn thành profile để trải nghiệm tốt hơn',
    title: 'Hoàn thành profile của bạn',
    body: 'Chỉ cần 2 phút để hoàn thành profile và mở khóa tất cả tính năng của {{appName}}.',
    variables: ['userName', 'appName'],
    actionUrl: '/settings/profile'
  },
  {
    templateId: 'onboarding-day3',
    name: 'Day 3 Engagement',
    appId: 'all',
    type: 'marketing',
    channels: ['email', 'push'],
    subject: '{{userName}}, đừng bỏ lỡ những tính năng hay!',
    title: 'Khám phá tính năng mới',
    body: 'Bạn đã thử tính năng {{featureName}} chưa?  Rất nhiều người dùng yêu thích tính năng này!',
    variables: ['userName', 'featureName'],
    actionUrl: '/features'
  },

  // Referral notifications
  {
    templateId: 'referral-invite',
    name: 'Referral Invite',
    appId: 'all',
    type: 'referral',
    channels: ['email'],
    subject: '{{referrerName}} mời bạn dùng {{appName}}',
    title: 'Bạn được mời dùng {{appName}}!',
    body: '{{referrerName}} nghĩ bạn sẽ thích {{appName}}.  Đăng ký ngay để nhận {{rewardDays}} ngày Premium miễn phí!',
    variables: ['referrerName', 'appName', 'rewardDays'],
    actionUrl: '/signup?ref={{referralCode}}'
  },
  {
    templateId: 'referral-success',
    name: 'Referral Success',
    appId: 'all',
    type: 'referral',
    channels: ['email', 'push', 'in_app'],
    subject: '🎉 {{friendName}} đã đăng ký qua link của bạn!',
    title: 'Bạn bè đã tham gia!',
    body: '{{friendName}} đã đăng ký {{appName}} qua link giới thiệu của bạn.  Bạn nhận được {{rewardDays}} ngày Premium!',
    variables: ['friendName', 'appName', 'rewardDays'],
    actionUrl: '/referral/rewards'
  },
  {
    templateId: 'referral-reminder',
    name: 'Referral Reminder',
    appId: 'all',
    type: 'marketing',
    channels: ['push', 'in_app'],
    subject: '',
    title: 'Mời bạn bè, nhận Premium miễn phí!',
    body: 'Giới thiệu {{appName}} cho bạn bè và nhận {{rewardDays}} ngày Premium cho mỗi người đăng ký thành công.',
    variables: ['appName', 'rewardDays'],
    actionUrl: '/referral'
  },

  // Achievement notifications
  {
    templateId: 'achievement-unlocked',
    name: 'Achievement Unlocked',
    appId: 'all',
    type: 'achievement',
    channels: ['push', 'in_app'],
    subject: '',
    title: '🏆 Mở khóa thành tích: {{achievementName}}!',
    body: 'Chúc mừng!  Bạn đã đạt được "{{achievementName}}".  {{achievementDescription}}',
    variables: ['achievementName', 'achievementDescription'],
    actionUrl: '/achievements'
  },
  {
    templateId: 'streak-milestone',
    name: 'Streak Milestone',
    appId: 'all',
    type: 'achievement',
    channels: ['push', 'in_app'],
    subject: '',
    title: '🔥 {{streakDays}} ngày liên tiếp!',
    body: 'Tuyệt vời!  Bạn đã sử dụng {{appName}} {{streakDays}} ngày liên tiếp.  Tiếp tục phát huy!',
    variables: ['streakDays', 'appName'],
    actionUrl: '/achievements'
  },
  {
    templateId: 'streak-at-risk',
    name: 'Streak At Risk',
    appId: 'all',
    type: 'reminder',
    channels: ['push'],
    subject: '',
    title: '⚠️ Chuỗi {{streakDays}} ngày sắp mất!',
    body: 'Đừng để chuỗi {{streakDays}} ngày của bạn bị mất!  Mở {{appName}} ngay hôm nay.',
    variables: ['streakDays', 'appName'],
    actionUrl: '/'
  },

  // Premium notifications
  {
    templateId: 'premium-trial-ending',
    name: 'Premium Trial Ending',
    appId: 'all',
    type: 'transactional',
    channels: ['email', 'push'],
    subject: 'Dùng thử Premium sắp hết - Nâng cấp để tiếp tục',
    title: 'Trial Premium sắp hết',
    body: 'Còn {{daysLeft}} ngày trial Premium của bạn.  Nâng cấp ngay với giá chỉ 99.000đ/tháng.',
    variables: ['daysLeft'],
    actionUrl: '/pricing'
  },
  {
    templateId: 'premium-expired',
    name: 'Premium Expired',
    appId: 'all',
    type: 'transactional',
    channels: ['email', 'in_app'],
    subject: 'Premium đã hết hạn',
    title: 'Premium đã hết hạn',
    body: 'Gói Premium của bạn đã hết hạn.  Gia hạn ngay để tiếp tục sử dụng các tính năng cao cấp.',
    variables: [],
    actionUrl: '/pricing'
  },

  // Re-engagement notifications
  {
    templateId: 'inactive-7days',
    name: '7 Day Inactive',
    appId: 'all',
    type: 'marketing',
    channels: ['email', 'push'],
    subject: '{{userName}}, chúng tôi nhớ bạn! 😊',
    title: 'Chúng tôi nhớ bạn!',
    body: 'Đã 7 ngày rồi bạn chưa ghé {{appName}}.  Có nhiều điều mới đang chờ bạn khám phá!',
    variables: ['userName', 'appName'],
    actionUrl: '/'
  },
  {
    templateId: 'inactive-30days',
    name: '30 Day Inactive',
    appId: 'all',
    type: 'marketing',
    channels: ['email'],
    subject: '{{userName}}, quay lại nhận ưu đãi đặc biệt!',
    title: 'Ưu đãi đặc biệt cho bạn',
    body: 'Chúng tôi rất nhớ bạn!  Quay lại {{appName}} và nhận {{offerDays}} ngày Premium miễn phí.',
    variables: ['userName', 'appName', 'offerDays'],
    actionUrl: '/reactivate?offer={{offerCode}}'
  },

  // App-specific reminders
  {
    templateId: 'trendbrief-daily',
    name: 'TrendBrief Daily Digest',
    appId: 'trendbrief',
    type: 'reminder',
    channels: ['push', 'email'],
    subject: '📰 Bản tin xu hướng hôm nay',
    title: 'Bản tin xu hướng hôm nay',
    body: '{{trendCount}} xu hướng mới trong ngành {{industry}}.  Xem ngay!',
    variables: ['trendCount', 'industry'],
    actionUrl: '/today'
  },
  {
    templateId: 'doctorcar-maintenance',
    name: 'DoctorCar Maintenance Reminder',
    appId: 'doctorcar',
    type: 'reminder',
    channels: ['push', 'email'],
    subject: '🚗 Nhắc nhở bảo dưỡng xe',
    title: 'Đến lịch bảo dưỡng xe',
    body: '{{carName}} đã đến lịch {{maintenanceType}}.  Km hiện tại: {{currentKm}}km.',
    variables: ['carName', 'maintenanceType', 'currentKm'],
    actionUrl: '/maintenance/{{maintenanceId}}'
  },
  {
    templateId: 'caremate-medication',
    name: 'CareMate Medication Reminder',
    appId: 'caremate',
    type: 'reminder',
    channels: ['push'],
    subject: '',
    title: '💊 Nhắc nhở uống thuốc',
    body: 'Đến giờ {{memberName}} uống {{medicationName}}.  Liều lượng: {{dosage}}.',
    variables: ['memberName', 'medicationName', 'dosage'],
    actionUrl: '/medications/{{medicationId}}'
  },
  {
    templateId: 'caremate-vaccination',
    name: 'CareMate Vaccination Reminder',
    appId: 'caremate',
    type: 'reminder',
    channels: ['push', 'email'],
    subject: '💉 Lịch tiêm chủng sắp tới',
    title: 'Nhắc nhở tiêm chủng',
    body: '{{memberName}} có lịch tiêm {{vaccineName}} vào ngày {{scheduleDate}}.',
    variables: ['memberName', 'vaccineName', 'scheduleDate'],
    actionUrl: '/vaccinations/{{vaccinationId}}'
  },
  {
    templateId: 'fintax-deadline',
    name: 'FinTax Deadline Reminder',
    appId: 'fintax',
    type: 'reminder',
    channels: ['push', 'email'],
    subject: '📅 Nhắc nhở hạn nộp thuế',
    title: 'Hạn nộp thuế sắp tới',
    body: 'Còn {{daysLeft}} ngày đến hạn nộp {{taxType}}.  Chuẩn bị hồ sơ ngay!',
    variables: ['daysLeft', 'taxType'],
    actionUrl: '/deadlines/{{deadlineId}}'
  }
];

class NotificationService {
  private pushSubscription: PushSubscription | null = null;
  private inAppNotifications: InAppNotification[] = [];
  private preferences: NotificationPreferences | null = null;
  private userId?: string;
  private appId: AppId;

  constructor() {
    this.appId = this.detectAppId();
    this.loadPreferences();
    this.loadInAppNotifications();
  }

  /**
   * Detect current app
   */
  private detectAppId(): AppId {
    const hostname = window.location.hostname;
    if (hostname.includes('trendbrief')) return 'trendbrief';
    if (hostname.includes('smartbuy')) return 'smartbuy';
    if (hostname.includes('fintax')) return 'fintax';
    if (hostname.includes('doctorcar')) return 'doctorcar';
    if (hostname.includes('caremate')) return 'caremate';
    return 'trendbrief';
  }

  /**
   * Initialize notification service with user
   */
  async initialize(userId: string): Promise<void> {
    this.userId = userId;
    await this.loadPreferences();
    await this.loadInAppNotifications();
    await this.requestPushPermission();
  }

  /**
   * Request push notification permission
   */
  async requestPushPermission(): Promise<boolean> {
    if (!('Notification' in window) || !('serviceWorker' in navigator)) {
      return false;
    }

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return false;
    }

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(this.getVapidPublicKey())
      });

      await this.savePushSubscription(subscription);
      return true;
    } catch (error) {
      console.error('Push subscription failed:', error);
      return false;
    }
  }

  /**
   * Get VAPID public key from server
   */
  private getVapidPublicKey(): string {
    // This would be fetched from server in production
    return 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
  }

  /**
   * Convert base64 to Uint8Array for VAPID key
   */
  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  /**
   * Save push subscription to server
   */
  private async savePushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
    if (!this.userId) return;

    try {
      await fetch('/api/notifications/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          appId: this.appId,
          endpoint: subscription.endpoint,
          keys: subscription.keys
        })
      });
    } catch (error) {
      console.error('Failed to save push subscription:', error);
    }
  }

  /**
   * Load user preferences
   */
  private async loadPreferences(): Promise<void> {
    if (!this.userId) {
      this.preferences = this.getDefaultPreferences();
      return;
    }

    try {
      const response = await fetch(`/api/notifications/preferences/${this.userId}`);
      this.preferences = await response.json();
    } catch {
      this.preferences = this.getDefaultPreferences();
    }
  }

  /**
   * Get default notification preferences
   */
  private getDefaultPreferences(): NotificationPreferences {
    return {
      userId: this.userId || '',
      appId: this.appId,
      channels: {
        push: true,
        email: true,
        inApp: true,
        sms: false
      },
      types: {
        system: true,
        marketing: true,
        transactional: true,
        reminder: true,
        achievement: true,
        referral: true,
        update: true,
        alert: true
      },
      quietHours: {
        enabled: true,
        start: '22:00',
        end: '07:00',
        timezone: 'Asia/Ho_Chi_Minh'
      },
      frequency: {
        maxPerDay: 5,
        maxPerWeek: 20
      }
    };
  }

  /**
   * Update notification preferences
   */
  async updatePreferences(updates: Partial<NotificationPreferences>): Promise<void> {
    if (!this.userId) return;

    this.preferences = { ...this.preferences!, ...updates };

    try {
      await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.userId,
          preferences: this.preferences
        })
      });
    } catch (error) {
      console.error('Failed to update preferences:', error);
    }
  }

  /**
   * Load in-app notifications
   */
  private async loadInAppNotifications(): Promise<void> {
    if (!this.userId) {
      this.inAppNotifications = [];
      return;
    }

    try {
      const response = await fetch(`/api/notifications/in-app/${this.userId}`);
      this.inAppNotifications = await response.json();
    } catch {
      this.inAppNotifications = [];
    }
  }

  /**
   * Get unread in-app notifications
   */
  getUnreadNotifications(): InAppNotification[] {
    return this.inAppNotifications.filter(n => !n.isRead);
  }

  /**
   * Get all in-app notifications
   */
  getAllNotifications(): InAppNotification[] {
    return this.inAppNotifications;
  }

  /**
   * Get unread count
   */
  getUnreadCount(): number {
    return this.inAppNotifications.filter(n => !n.isRead).length;
  }

  /**
   * Mark notification as read
   */
  async markAsRead(notificationId: string): Promise<void> {
    const notification = this.inAppNotifications.find(n => n.notificationId === notificationId);
    if (notification) {
      notification.isRead = true;
    }

    try {
      await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST'
      });
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(): Promise<void> {
    this.inAppNotifications.forEach(n => n.isRead = true);

    try {
      await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: this.userId })
      });
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  }

  /**
   * Send notification using template
   */
  async sendFromTemplate(
    templateId: string,
    recipientUserId: string,
    variables: Record<string, string>,
    channels?: NotificationChannel[]
  ): Promise<void> {
    try {
      await fetch('/api/notifications/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          recipientUserId,
          variables,
          channels
        })
      });
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Send custom notification
   */
  async sendCustom(notification: Partial<Notification>): Promise<void> {
    try {
      await fetch('/api/notifications/send-custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification)
      });
    } catch (error) {
      console.error('Failed to send custom notification:', error);
    }
  }

  /**
   * Schedule notification
   */
  async schedule(notification: Partial<Notification>, scheduledAt: Date): Promise<void> {
    try {
      await fetch('/api/notifications/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...notification,
          scheduledAt
        })
      });
    } catch (error) {
      console.error('Failed to schedule notification:', error);
    }
  }

  /**
   * Show local notification (in-app toast)
   */
  showToast(title: string, body: string, type: 'success' | 'info' | 'warning' | 'error' = 'info'): void {
    // Dispatch custom event for UI to handle
    window.dispatchEvent(new CustomEvent('notification-toast', {
      detail: { title, body, type }
    }));
  }

  /**
   * Unsubscribe from push notifications
   */
  async unsubscribePush(): Promise<void> {
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await fetch('/api/notifications/push/unsubscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: this.userId, appId: this.appId })
        });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push:', error);
    }
  }

  /**
   * Get notification preferences
   */
  getPreferences(): NotificationPreferences | null {
    return this.preferences;
  }

  /**
   * Check if notifications are enabled for a type
   */
  isTypeEnabled(type: NotificationType): boolean {
    return this.preferences?.types[type] ?? true;
  }

  /**
   * Check if channel is enabled
   */
  isChannelEnabled(channel: NotificationChannel): boolean {
    const channelKey = channel === 'in_app' ? 'inApp' : channel;
    return this.preferences?.channels[channelKey as keyof typeof this.preferences.channels] ?? true;
  }
}

// Singleton instance
export const notificationService = new NotificationService();

// Convenience exports
export const showToast = (title: string, body: string, type?: 'success' | 'info' | 'warning' | 'error') =>
  notificationService.showToast(title, body, type);

export const getUnreadCount = () => notificationService.getUnreadCount();

export const markNotificationRead = (id: string) => notificationService.markAsRead(id);
