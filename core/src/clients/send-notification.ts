/**
 * Simplified notification sender for product services.
 *
 * Products import this function to send notifications without managing
 * client lifecycle.  Auto-configures from environment variables.
 *
 * Usage in product workers:
 *   import { sendNotification } from '../../shared-notification';
 *   // OR if path differs:
 *   import { sendNotification } from '@winlux/service-clients/send-notification';
 *
 *   await sendNotification('smartbuy', {
 *     userId: user.id,
 *     type: 'price_drop',
 *     title: '🔥 Giá giảm sốc!',
 *     body: 'iPhone 15 còn 22.990.000₫',
 *     deepLink: '/product/abc123',
 *   });
 *
 * Channels are auto-selected by notification type (see FALLBACK_CHAINS).
 * Dedup + rate limiting + quiet hours handled automatically.
 */

export { sendNotification, scheduleNotification, cancelScheduled } from './notification-client';
