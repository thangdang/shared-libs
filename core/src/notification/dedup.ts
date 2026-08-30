/**
 * DedupService — Prevents duplicate notifications within a time window.
 * Uses Redis SET with TTL.
 */

export class DedupService {
  private redisUrl: string;
  private windowSeconds: number;
  private redis: any = null;

  constructor(redisUrl: string, windowSeconds: number = 3600) {
    this.redisUrl = redisUrl;
    this.windowSeconds = windowSeconds;
  }

  private async getRedis() {
    if (!this.redis) {
      const Redis = require('ioredis');
      this.redis = new Redis(this.redisUrl);
    }
    return this.redis;
  }

  /**
   * Check if this notification was already sent within the dedup window.
   */
  async check(key: string): Promise<boolean> {
    try {
      const redis = await this.getRedis();
      const exists = await redis.exists(`notif:dedup:${key}`);
      return exists === 1;
    } catch {
      return false; // On Redis failure, allow sending (fail-open)
    }
  }

  /**
   * Mark notification as sent (for dedup tracking).
   */
  async mark(key: string): Promise<void> {
    try {
      const redis = await this.getRedis();
      await redis.set(`notif:dedup:${key}`, '1', 'EX', this.windowSeconds);
    } catch {
      // Silent fail — dedup is best-effort
    }
  }
}
