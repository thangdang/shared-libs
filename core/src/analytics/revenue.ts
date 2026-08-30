/**
 * RevenueTracker — Unified revenue event tracking across all products.
 * Every monetization event (affiliate click, subscription, ad impression) goes here.
 */

import type { AnalyticsConfig, RevenueEvent } from './types.js';

export class RevenueTracker {
  private product: string;
  private db: any;
  private collectionName: string;

  constructor(config: AnalyticsConfig) {
    this.product = config.product;
    this.db = config.db;
    this.collectionName = 'revenue_events';
  }

  /**
   * Record a revenue event.
   */
  async record(
    stream: string,
    amountVnd: number,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    const event: RevenueEvent = {
      product: this.product,
      stream,
      amountVnd,
      amountUsd: amountVnd / 25000, // Approximate VND → USD
      userId,
      metadata,
      timestamp: new Date(),
    };

    await this.db.collection(this.collectionName).insertOne(event);
  }

  /**
   * Get revenue summary for a period.
   */
  async getSummary(days: number = 30): Promise<{
    total_vnd: number;
    total_usd: number;
    by_stream: Record<string, number>;
    daily: Array<{ date: string; amount: number }>;
  }> {
    const since = new Date(Date.now() - days * 86400000);

    // Total by stream
    const byStreamPipeline = [
      { $match: { product: this.product, timestamp: { $gte: since } } },
      { $group: { _id: '$stream', total: { $sum: '$amountVnd' } } },
    ];
    const byStreamResults = await this.db.collection(this.collectionName).aggregate(byStreamPipeline).toArray();

    const byStream: Record<string, number> = {};
    let totalVnd = 0;
    for (const r of byStreamResults) {
      byStream[r._id] = r.total;
      totalVnd += r.total;
    }

    // Daily breakdown
    const dailyPipeline = [
      { $match: { product: this.product, timestamp: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
          amount: { $sum: '$amountVnd' },
        },
      },
      { $sort: { _id: 1 } },
    ];
    const dailyResults = await this.db.collection(this.collectionName).aggregate(dailyPipeline).toArray();

    return {
      total_vnd: totalVnd,
      total_usd: Math.round(totalVnd / 25000),
      by_stream: byStream,
      daily: dailyResults.map((r: any) => ({ date: r._id, amount: r.amount })),
    };
  }

  /**
   * Get cross-product revenue (used by backoffice).
   */
  async getCrossProductSummary(days: number = 30): Promise<Record<string, number>> {
    const since = new Date(Date.now() - days * 86400000);

    const pipeline = [
      { $match: { timestamp: { $gte: since } } },
      { $group: { _id: '$product', total: { $sum: '$amountVnd' } } },
    ];
    const results = await this.db.collection(this.collectionName).aggregate(pipeline).toArray();

    const summary: Record<string, number> = {};
    for (const r of results) {
      summary[r._id] = r.total;
    }
    return summary;
  }
}
