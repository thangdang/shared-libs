/**
 * @winlux/analytics
 *
 * Shared analytics and event tracking for all 6 WinLux products.
 * Provides: unified event schema, server-side logging, revenue tracking, trend scanning.
 *
 * Usage:
 *   import { Analytics, RevenueTracker, TrendScanner } from '@winlux/analytics';
 *
 *   const analytics = new Analytics({ product: 'smartbuy', db });
 *   await analytics.track('product_viewed', userId, { product_id: '123' });
 *
 *   const revenue = new RevenueTracker({ product: 'smartbuy', db });
 *   await revenue.record('affiliate', 25000, { platform: 'shopee', product_id: '123' });
 *
 *   const scanner = new TrendScanner({ mongoUri: 'mongodb://localhost:27017' });
 *   const trends = await scanner.fetchTrends();
 */

export { Analytics } from './analytics.js';
export { RevenueTracker } from './revenue.js';
export { HealthChecker, type HealthStatus } from './health.js';
export { TrendScanner, type Trend, type TrendSuggestion, type TrendScannerConfig } from './trend-scanner.js';
export type { AnalyticsEvent, RevenueEvent, AnalyticsConfig } from './types.js';
