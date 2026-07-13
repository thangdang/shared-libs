/**
 * @winlux/analytics
 *
 * Shared analytics and event tracking for all 6 WinLux products.
 * Provides: unified event schema, server-side logging, revenue tracking.
 *
 * Usage:
 *   import { Analytics, RevenueTracker } from '@winlux/analytics';
 *
 *   const analytics = new Analytics({ product: 'smartbuy', db });
 *   await analytics.track('product_viewed', userId, { product_id: '123' });
 *
 *   const revenue = new RevenueTracker({ product: 'smartbuy', db });
 *   await revenue.record('affiliate', 25000, { platform: 'shopee', product_id: '123' });
 */

export { Analytics } from './analytics.js';
export { RevenueTracker } from './revenue.js';
export { HealthChecker, type HealthStatus } from './health.js';
export type { AnalyticsEvent, RevenueEvent, AnalyticsConfig } from './types.js';
