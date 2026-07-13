/**
 * @winlux/notification-service
 *
 * Shared notification service for all 6 WinLux products.
 * Provides: FCM push, Zalo OA messaging, dedup, rate limiting, deep links.
 *
 * Usage:
 *   import { NotificationClient } from '@winlux/notification-service';
 *
 *   const notifier = new NotificationClient({
 *     product: 'smartbuy',
 *     redisUrl: 'redis://localhost:6379',
 *     fcmServiceAccount: require('./firebase-sa.json'),
 *     zaloOAToken: process.env.ZALO_OA_ACCESS_TOKEN,
 *   });
 *
 *   await notifier.send({
 *     userId: 'user123',
 *     type: 'price_drop',
 *     title: '🔔 Giá đã giảm!',
 *     body: 'iPhone 15 giảm xuống 24.990.000đ',
 *     deepLink: '/product/iphone-15',
 *     priority: 'high',
 *   });
 */

export { NotificationClient } from './client.js';
export { FCMProvider } from './providers/fcm.js';
export { ZaloOAProvider } from './providers/zalo-oa.js';
export { SMSProvider } from './providers/sms.js';
export { EmailProvider } from './providers/email.js';
export { NotificationScheduler, parseDuration, getCurrentVNTime, getVNHour } from './scheduler.js';
export { NotificationDigest, createDigest, buildDigestKey } from './digest.js';
export { DedupService } from './dedup.js';
export { RateLimiter } from './rate-limiter.js';
export { DeepLinkBuilder } from './deep-link.js';

export type {
  NotificationPayload,
  NotificationResult,
  NotificationConfig,
  NotificationType,
  NotificationPriority,
} from './types.js';

export type { ESMSType, SMSSendOptions } from './providers/sms.js';
export type { EmailPayload } from './providers/email.js';
export type { ScheduleOptions, ScheduledJob } from './scheduler.js';
export type { DigestConfig, DigestCallback } from './digest.js';
