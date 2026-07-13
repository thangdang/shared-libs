/**
 * Analytics Service Client
 * ────────────────────────
 * Drop this file into any product service's src/services/ folder.
 * Wraps @winlux/analytics (Analytics + RevenueTracker + HealthChecker) with auto-config from env vars.
 *
 * Requirements:  Req 8.2
 */

import { Analytics } from '../analytics/src/analytics.js';
import { RevenueTracker } from '../analytics/src/revenue.js';
import { HealthChecker } from '../analytics/src/health.js';
import type { AnalyticsConfig, HealthStatus } from '../analytics/src/types.js';
import mongoose from 'mongoose';

// ─── Auto-config from environment variables ───────────────────────────────────

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/winlux';
const ANALYTICS_URL = process.env.ANALYTICS_URL || MONGO_URI;
const APP_VERSION = process.env.APP_VERSION || '1.0.0';

let _dbConnection: any = null;

/**
 * Get or create a shared MongoDB connection for analytics.
 * Reuses existing connection to avoid connection pool exhaustion.
 */
async function getDb(): Promise<any> {
  if (_dbConnection && _dbConnection.readyState === 1) {
    return _dbConnection.connection.db;
  }

  // If mongoose is already connected (from the host app), reuse it
  if (mongoose.connection.readyState === 1) {
    _dbConnection = mongoose;
    return mongoose.connection.db;
  }

  // Otherwise, create a new connection
  _dbConnection = await mongoose.connect(ANALYTICS_URL);
  return mongoose.connection.db;
}

function buildConfig(product: string, db: any): AnalyticsConfig {
  return {
    product,
    db,
    collectionPrefix: process.env.ANALYTICS_COLLECTION_PREFIX || '',
  };
}

// ─── AnalyticsServiceClient class ────────────────────────────────────────────

export class AnalyticsServiceClient {
  private analytics: Analytics | null = null;
  private revenue: RevenueTracker | null = null;
  private healthChecker: HealthChecker;
  private product: string;
  private initialized = false;

  constructor(product: string) {
    this.product = product;
    this.healthChecker = new HealthChecker(product, APP_VERSION);

    // Register MongoDB health check
    this.healthChecker.register('mongodb', async () => {
      try {
        const db = await getDb();
        await db.admin().ping();
        return true;
      } catch {
        return false;
      }
    });
  }

  /**
   * Lazily initialize analytics and revenue tracker on first use.
   */
  private async init(): Promise<void> {
    if (this.initialized) return;
    const db = await getDb();
    const config = buildConfig(this.product, db);
    this.analytics = new Analytics(config);
    this.revenue = new RevenueTracker(config);
    this.initialized = true;
  }

  /**
   * Track an analytics event.
   * Fire-and-forget — never blocks the caller.
   */
  async trackEvent(
    eventType: string,
    userId?: string,
    properties?: Record<string, any>,
    options?: { platform?: string; sessionId?: string; ip?: string },
  ): Promise<void> {
    await this.init();
    await this.analytics!.track(eventType, userId, properties, options);
  }

  /**
   * Record a revenue event (affiliate, premium, ad, commission, etc.).
   */
  async recordRevenue(
    stream: string,
    amountVnd: number,
    metadata?: Record<string, any>,
    userId?: string,
  ): Promise<void> {
    await this.init();
    await this.revenue!.record(stream, amountVnd, metadata, userId);
  }

  /**
   * Get standardized health status including dependency checks.
   */
  async getHealthStatus(): Promise<HealthStatus> {
    return this.healthChecker.check();
  }
}

// ─── Convenience functions (stateless, create client per call) ────────────────

/**
 * Track an analytics event.
 * Auto-configures from env vars.  Product name identifies the calling service.
 */
export async function trackEvent(
  product: string,
  eventType: string,
  userId?: string,
  properties?: Record<string, any>,
  options?: { platform?: string; sessionId?: string; ip?: string },
): Promise<void> {
  const db = await getDb();
  const config = buildConfig(product, db);
  const analytics = new Analytics(config);
  await analytics.track(eventType, userId, properties, options);
}

/**
 * Record a revenue event.
 * Auto-configures from env vars.  Product name identifies the calling service.
 *
 * @param product - Product name (e.g., "smartbuy", "caremate", "fintax", "doctorcar")
 * @param stream - Revenue stream type (e.g., "affiliate", "premium", "ad", "commission")
 * @param amountVnd - Amount in VND
 * @param metadata - Additional metadata (e.g., { platform: 'shopee', product_id: '123' })
 * @param userId - Optional user ID
 */
export async function recordRevenue(
  product: string,
  stream: string,
  amountVnd: number,
  metadata?: Record<string, any>,
  userId?: string,
): Promise<void> {
  const db = await getDb();
  const config = buildConfig(product, db);
  const revenue = new RevenueTracker(config);
  await revenue.record(stream, amountVnd, metadata, userId);
}

/**
 * Get health status for the analytics service.
 * Returns standardized health response with dependency checks.
 *
 * @param product - Product name
 * @returns Health status object with status, uptime, and dependency states
 */
export async function getHealthStatus(product: string): Promise<HealthStatus> {
  const checker = new HealthChecker(product, APP_VERSION);

  checker.register('mongodb', async () => {
    try {
      const db = await getDb();
      await db.admin().ping();
      return true;
    } catch {
      return false;
    }
  });

  return checker.check();
}
