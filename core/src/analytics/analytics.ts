/**
 * Analytics — Unified event tracking for all products.
 * Logs events to MongoDB with consistent schema.
 */

import type { AnalyticsConfig, AnalyticsEvent } from './types.js';

export class Analytics {
  private product: string;
  private db: any;
  private collectionName: string;

  constructor(config: AnalyticsConfig) {
    this.product = config.product;
    this.db = config.db;
    this.collectionName = `${config.collectionPrefix || ''}analytics_events`;
  }

  /**
   * Track an event. Fire-and-forget (non-blocking).
   */
  async track(
    eventType: string,
    userId?: string,
    properties?: Record<string, any>,
    options?: { platform?: string; sessionId?: string; ip?: string }
  ): Promise<void> {
    const event: AnalyticsEvent = {
      product: this.product,
      userId,
      sessionId: options?.sessionId,
      eventType,
      properties,
      timestamp: new Date(),
      platform: options?.platform as any,
      ip: options?.ip,
    };

    // Fire-and-forget — never block the request
    this.db.collection(this.collectionName).insertOne(event).catch((err: any) => {
      console.warn(`[Analytics] Failed to track ${eventType}:`, err.message);
    });
  }

  /**
   * Track a page/screen view.
   */
  async trackPageView(userId: string, path: string, options?: { platform?: string; referrer?: string }): Promise<void> {
    await this.track('page_view', userId, { path, referrer: options?.referrer }, options);
  }

  /**
   * Track user signup.
   */
  async trackSignup(userId: string, method: string): Promise<void> {
    await this.track('signup', userId, { method });
  }

  /**
   * Track conversion event (subscription, purchase, etc.).
   */
  async trackConversion(userId: string, type: string, value?: number): Promise<void> {
    await this.track('conversion', userId, { type, value_vnd: value });
  }

  /**
   * Get event counts for a period (for dashboard).
   */
  async getCounts(days: number = 7): Promise<Record<string, number>> {
    const since = new Date(Date.now() - days * 86400000);
    const pipeline = [
      { $match: { product: this.product, timestamp: { $gte: since } } },
      { $group: { _id: '$eventType', count: { $sum: 1 } } },
    ];

    const results = await this.db.collection(this.collectionName).aggregate(pipeline).toArray();
    const counts: Record<string, number> = {};
    for (const r of results) {
      counts[r._id] = r.count;
    }
    return counts;
  }
}
