/**
 * Shared notification types for all WinLux products.
 */

export type NotificationPriority = 'critical' | 'high' | 'normal' | 'low';

export type NotificationType =
  // SmartBuy
  | 'price_drop' | 'flash_sale' | 'back_in_stock' | 'deal_of_day' | 'weekly_digest'
  // TrendBrief
  | 'breaking_news' | 'morning_digest' | 'weekly_trends' | 'topic_alert'
  // CareMate
  | 'health_tip' | 'medication_reminder' | 'follow_up' | 'emergency'
  // FIN Tax
  | 'tax_deadline' | 'budget_exceeded' | 'weekly_summary' | 'anomaly_alert'
  // Doctor Car
  | 'maintenance_due' | 'inspection_expiry' | 'insurance_expiry' | 'recall_alert' | 'diagnosis_alert'
  // Video Engine
  | 'pipeline_complete' | 'video_published' | 'performance_alert'
  // Common
  | 'promo' | 'system' | 'custom';

export interface NotificationPayload {
  /** User ID to send to */
  userId: string;
  /** Notification type (for dedup + rate limiting) */
  type: NotificationType;
  /** Title (Vietnamese) */
  title: string;
  /** Body text (Vietnamese, max 200 chars) */
  body: string;
  /** Deep link path (e.g., '/product/iphone-15', '/diagnosis/abc123') */
  deepLink?: string;
  /** Priority level */
  priority?: NotificationPriority;
  /** Additional data payload */
  data?: Record<string, string>;
  /** Image URL for rich notification */
  imageUrl?: string;
  /** Zalo-specific: user's Zalo ID (if different from userId) */
  zaloUserId?: string;
  /** Channel: which delivery channels to use */
  channels?: ('fcm' | 'zalo' | 'email' | 'sms')[];
}

export interface NotificationResult {
  success: boolean;
  channel: 'fcm' | 'zalo' | 'email' | 'sms';
  messageId?: string;
  error?: string;
  deduplicated?: boolean;
  rateLimited?: boolean;
}

export interface NotificationConfig {
  /** Product identifier */
  product: string;
  /** Redis URL for dedup + rate limiting */
  redisUrl: string;
  /** Firebase Admin service account (for FCM) */
  fcmServiceAccount?: object;
  /** Zalo OA access token */
  zaloOAToken?: string;
  /** SMS provider config (eSMS.vn) */
  sms?: {
    apiKey?: string;
    secretKey?: string;
    brandname?: string;
  };
  /** Email provider config (Resend) */
  email?: {
    apiKey?: string;
    from?: string;
  };
  /** Max notifications per user per day (default: 5) */
  maxPerDay?: number;
  /** Dedup window in seconds (default: 3600 = 1 hour) */
  dedupWindowSeconds?: number;
  /** Deep link base URL per platform */
  deepLinkBase?: {
    web?: string;     // e.g., 'https://smartbuy.winlux.com'
    ios?: string;     // e.g., 'smartbuy://'
    android?: string; // e.g., 'smartbuy://'
  };
}
