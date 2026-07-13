/**
 * RateLimiter — Limits notifications per user per day.
 * Prevents notification spam. Critical priority bypasses limits.
 */

export class RateLimiter {
  private redisUrl: string;
  private maxPerDay: number;
  private redis: any = null;

  constructor(redisUrl: string, maxPerDay: number = 5) {
    this.redisUrl = redisUrl;
    this.maxPerDay = maxPerDay;
  }

  private async getRedis() {
    if (!this.redis) {
      const Redis = require('ioredis');
      this.redis = new Redis(this.redisUrl);
    }
    return this.redis;
  }

  /**
   * Check if user has exceeded daily notification limit.
   */
  async isLimited(userId: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const key = `notif:rate:${userId}:${this.todayKey()}`;
      const count = await redis.get(key);
      return (parseInt(count || '0', 10)) >= this.maxPerDay;
    } catch {
      return false; // Fail-open
    }
  }

  /**
   * Record that a notification was sent to user.
   */
  async record(userId: string): Promise<void> {
    try {
      const redis = await this.getRedis();
      const key = `notif:rate:${userId}:${this.todayKey()}`;
      await redis.incr(key);
      await redis.expire(key, 86400); // TTL 24h
    } catch {
      // Silent fail
    }
  }

  /**
   * Get current count for a user today.
   */
  async getCount(userId: string): Promise<number> {
    try {
      const redis = await this.getRedis();
      const key = `notif:rate:${userId}:${this.todayKey()}`;
      const count = await redis.get(key);
      return parseInt(count || '0', 10);
    } catch {
      return 0;
    }
  }

  private todayKey(): string {
    return new Date().toISOString().slice(0, 10); // "2026-07-02"
  }
}
