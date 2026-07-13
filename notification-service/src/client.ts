/**
 * NotificationClient — Main entry point for sending notifications.
 *
 * Handles: provider selection, dedup, rate limiting, deep link building,
 * and channel fallback (fcm → zalo → sms/email based on notification type).
 * All products use this same client with product-specific config.
 */

import { FCMProvider } from './providers/fcm.js';
import { ZaloOAProvider } from './providers/zalo-oa.js';
import { SMSProvider } from './providers/sms.js';
import { EmailProvider } from './providers/email.js';
import { DedupService } from './dedup.js';
import { RateLimiter } from './rate-limiter.js';
import { DeepLinkBuilder } from './deep-link.js';
import type { NotificationPayload, NotificationResult, NotificationConfig } from './types.js';

/**
 * Default fallback chains per notification type.
 * When the primary channel fails, try the next channel in the chain.
 */
export const FALLBACK_CHAINS: Record<string, ('fcm' | 'zalo' | 'sms' | 'email')[]> = {
  // SmartBuy
  price_drop:          ['fcm', 'zalo'],
  flash_sale:          ['fcm', 'zalo'],
  back_in_stock:       ['fcm', 'zalo'],
  deal_of_day:         ['fcm', 'zalo'],
  weekly_digest:       ['email', 'fcm'],

  // CareMate — Health-critical: SMS fallback
  medication_reminder: ['fcm', 'sms'],
  health_tip:          ['fcm', 'zalo'],
  follow_up:           ['fcm', 'sms'],
  emergency:           ['fcm', 'sms', 'zalo'],

  // FIN Tax — Important: email fallback
  tax_deadline:        ['fcm', 'email'],
  budget_exceeded:     ['fcm', 'email'],
  weekly_summary:      ['email', 'fcm'],
  anomaly_alert:       ['fcm', 'email'],

  // Receipts/payments — Email primary
  payment_receipt:     ['email', 'fcm'],

  // TrendBrief
  breaking_news:       ['fcm', 'zalo'],
  morning_digest:      ['email', 'fcm'],
  weekly_trends:       ['email', 'fcm'],
  topic_alert:         ['fcm', 'zalo'],

  // Doctor Car
  maintenance_due:     ['fcm', 'sms'],
  inspection_expiry:   ['fcm', 'sms', 'email'],
  insurance_expiry:    ['fcm', 'email', 'sms'],
  recall_alert:        ['fcm', 'sms', 'zalo'],
  diagnosis_alert:     ['fcm', 'zalo'],

  // Video Engine
  pipeline_complete:   ['fcm', 'email'],
  video_published:     ['fcm', 'zalo'],
  performance_alert:   ['fcm', 'email'],

  // Common — defaults
  promo:               ['fcm', 'zalo'],
  system:              ['fcm', 'email'],
  custom:              ['fcm'],
};

export class NotificationClient {
  private config: NotificationConfig;
  private fcm: FCMProvider | null = null;
  private zalo: ZaloOAProvider | null = null;
  private sms: SMSProvider | null = null;
  private email: EmailProvider | null = null;
  private dedup: DedupService;
  private rateLimiter: RateLimiter;
  private deepLink: DeepLinkBuilder;

  constructor(config: NotificationConfig) {
    this.config = config;
    this.dedup = new DedupService(config.redisUrl, config.dedupWindowSeconds ?? 3600);
    this.rateLimiter = new RateLimiter(config.redisUrl, config.maxPerDay ?? 5);
    this.deepLink = new DeepLinkBuilder(config.deepLinkBase);

    if (config.fcmServiceAccount) {
      this.fcm = new FCMProvider(config.fcmServiceAccount);
    }
    if (config.zaloOAToken) {
      this.zalo = new ZaloOAProvider(config.zaloOAToken);
    }
    if (config.sms) {
      this.sms = new SMSProvider(config.sms);
    }
    if (config.email) {
      this.email = new EmailProvider(config.email);
    }
  }

  /**
   * Send notification to a user via configured channels with fallback.
   * If `payload.channels` is specified, uses those channels (explicit override).
   * Otherwise, uses the default fallback chain for the notification type.
   * Tries each channel in order; returns the first successful result,
   * or the last failure if all channels fail.
   * Handles dedup + rate limiting automatically.
   */
  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    const results: NotificationResult[] = [];

    // 1. Check dedup (same user + type + data within window = skip)
    const dedupKey = `${payload.userId}:${payload.type}:${payload.data?.product_id || ''}`;
    const isDuplicate = await this.dedup.check(dedupKey);
    if (isDuplicate) {
      return [{ success: false, channel: 'fcm', deduplicated: true }];
    }

    // 2. Check rate limit (max N per user per day)
    const isLimited = await this.rateLimiter.isLimited(payload.userId);
    if (isLimited && payload.priority !== 'critical') {
      return [{ success: false, channel: 'fcm', rateLimited: true }];
    }

    // 3. Build deep link
    const deepLink = payload.deepLink
      ? this.deepLink.build(payload.deepLink, this.config.product)
      : undefined;

    // 4. Determine channels — explicit override or fallback chain
    const channels = payload.channels || FALLBACK_CHAINS[payload.type] || ['fcm'];

    // 5. Send via channels with fallback logic
    for (const channel of channels) {
      try {
        const result = await this.sendViaChannel(channel, payload, deepLink);
        results.push(result);

        // If successful, stop trying further channels (fallback not needed)
        if (result.success) {
          break;
        }
      } catch (err: any) {
        results.push({ success: false, channel, error: err.message });
      }
    }

    // 6. Mark as sent (for dedup + rate limit)
    const anySent = results.some(r => r.success);
    if (anySent) {
      await this.dedup.mark(dedupKey);
      await this.rateLimiter.record(payload.userId);
    }

    return results;
  }

  /**
   * Send a notification via a specific channel.
   * @internal
   */
  private async sendViaChannel(
    channel: 'fcm' | 'zalo' | 'sms' | 'email',
    payload: NotificationPayload,
    deepLink?: string,
  ): Promise<NotificationResult> {
    switch (channel) {
      case 'fcm':
        if (!this.fcm) {
          return { success: false, channel: 'fcm', error: 'fcm provider not configured' };
        }
        return this.fcm.send({
          userId: payload.userId,
          title: payload.title,
          body: payload.body,
          data: { ...payload.data, deep_link: deepLink || '' },
          imageUrl: payload.imageUrl,
        });

      case 'zalo':
        if (!this.zalo) {
          return { success: false, channel: 'zalo', error: 'zalo provider not configured' };
        }
        return this.zalo.send({
          zaloUserId: payload.zaloUserId || payload.userId,
          text: `${payload.title}\n${payload.body}`,
          deepLink,
        });

      case 'sms':
        if (!this.sms) {
          return { success: false, channel: 'sms', error: 'sms provider not configured' };
        }
        return this.sms.send(
          payload.userId, // userId is expected to be phone number for SMS
          `${payload.title}: ${payload.body}`,
        );

      case 'email':
        if (!this.email) {
          return { success: false, channel: 'email', error: 'email provider not configured' };
        }
        return this.email.send(
          payload.userId, // userId is expected to be email for email channel
          payload.title,
          `<p>${payload.body}</p>`,
        );

      default:
        return { success: false, channel, error: `Unknown channel: ${channel}` };
    }
  }

  /**
   * Send to multiple users (batch).
   * Respects per-user dedup + rate limiting.
   */
  async sendBatch(payloads: NotificationPayload[]): Promise<Map<string, NotificationResult[]>> {
    const results = new Map<string, NotificationResult[]>();

    for (const payload of payloads) {
      const result = await this.send(payload);
      results.set(payload.userId, result);
    }

    return results;
  }

  /**
   * Get notification stats for monitoring.
   */
  async getStats(): Promise<{
    product: string;
    fcmConfigured: boolean;
    zaloConfigured: boolean;
    smsConfigured: boolean;
    emailConfigured: boolean;
    dedupWindowSeconds: number;
    maxPerDay: number;
  }> {
    return {
      product: this.config.product,
      fcmConfigured: this.fcm !== null,
      zaloConfigured: this.zalo !== null,
      smsConfigured: this.sms !== null,
      emailConfigured: this.email !== null,
      dedupWindowSeconds: this.config.dedupWindowSeconds ?? 3600,
      maxPerDay: this.config.maxPerDay ?? 5,
    };
  }
}
