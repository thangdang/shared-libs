/**
 * Redis Cache Helper with Mandatory TTL + Key Namespacing
 *
 * Enforces consistent caching patterns across all services:
 * - All keys are namespaced by product prefix
 * - TTL is always required (prevents memory leaks)
 * - Values are auto-serialized/deserialized as JSON
 * - Optional zlib compression for large values (>1KB)
 *
 * Usage:
 *   import { RedisCacheHelper } from './redis-cache-helper';
 *   const cache = new RedisCacheHelper(redis, 'sb'); // SmartBuy prefix
 *   await cache.set('product', productId, data, 3600); // 1h TTL
 *   const data = await cache.get('product', productId);
 *   await cache.del('product', productId);
 *
 * Product prefixes:
 *   tb = TrendBrief AI
 *   sb = SmartBuy AI
 *   cm = CareMate AI
 *   ft = FIN Tax AI
 *   ch = Childhood AI
 *
 * Copy this file into any service that uses Redis caching.
 * Only dependency: ioredis (already in all services).
 */

import { Redis } from 'ioredis';
import { deflate, inflate } from 'zlib';
import { promisify } from 'util';

const deflateAsync = promisify(deflate);
const inflateAsync = promisify(inflate);

/** Supported product prefixes */
export type ProductPrefix = 'tb' | 'sb' | 'cm' | 'ft' | 'ch';

/** Options for the cache helper */
export interface RedisCacheHelperOptions {
  /**
   * Enable zlib compression for values larger than compressThreshold.
   * Reduces memory usage at the cost of CPU.
   * @default false
   */
  compress?: boolean;
  /**
   * Minimum value size (in bytes) before compression kicks in.
   * Only applies when compress: true.
   * @default 1024 (1KB)
   */
  compressThreshold?: number;
}

/** Prefix added to compressed values so we know to decompress on read */
const COMPRESSED_PREFIX = '__z__';

/**
 * Redis cache helper that enforces TTL on all writes and namespaces keys
 * by product prefix to avoid collisions in shared Redis instances.
 *
 * @example
 * const redis = new Redis(process.env.REDIS_URL);
 * const cache = new RedisCacheHelper(redis, 'sb', { compress: true });
 *
 * // Set with 1 hour TTL
 * await cache.set('product', '507f1f77bcf86cd799439011', productData, 3600);
 *
 * // Get (returns null if expired or missing)
 * const product = await cache.get<Product>('product', '507f1f77bcf86cd799439011');
 *
 * // Delete explicitly
 * await cache.del('product', '507f1f77bcf86cd799439011');
 */
export class RedisCacheHelper {
  private readonly redis: Redis;
  private readonly prefix: ProductPrefix;
  private readonly compress: boolean;
  private readonly compressThreshold: number;

  /**
   * @param redis - ioredis client instance
   * @param prefix - Product prefix (tb/sb/cm/ft/ch)
   * @param options - Optional configuration
   */
  constructor(redis: Redis, prefix: ProductPrefix, options: RedisCacheHelperOptions = {}) {
    this.redis = redis;
    this.prefix = prefix;
    this.compress = options.compress ?? false;
    this.compressThreshold = options.compressThreshold ?? 1024;
  }

  /**
   * Builds a namespaced cache key.
   * Format: `{prefix}:{type}:{id}`
   *
   * @example buildKey('product', '123') => 'sb:product:123'
   */
  buildKey(type: string, id: string): string {
    return `${this.prefix}:${type}:${id}`;
  }

  /**
   * Store a value in Redis with a mandatory TTL.
   *
   * @param type - Entity type (e.g., 'product', 'user', 'feed')
   * @param id - Entity identifier
   * @param data - Data to cache (will be JSON-serialized)
   * @param ttlSeconds - Time-to-live in seconds (required, must be > 0)
   * @throws Error if ttlSeconds is not a positive integer
   *
   * @example
   * await cache.set('product', productId, { name: 'Widget', price: 9.99 }, 3600);
   */
  async set<T>(type: string, id: string, data: T, ttlSeconds: number): Promise<void> {
    if (!ttlSeconds || ttlSeconds <= 0) {
      throw new Error('TTL is required and must be a positive number of seconds');
    }

    const key = this.buildKey(type, id);
    let value = JSON.stringify(data);

    // Compress if enabled and value exceeds threshold
    if (this.compress && Buffer.byteLength(value, 'utf8') > this.compressThreshold) {
      const compressed = await deflateAsync(Buffer.from(value, 'utf8'));
      value = COMPRESSED_PREFIX + compressed.toString('base64');
    }

    await this.redis.setex(key, Math.floor(ttlSeconds), value);
  }

  /**
   * Retrieve a cached value by type and id.
   * Returns null if the key doesn't exist or has expired.
   *
   * @param type - Entity type (e.g., 'product', 'user', 'feed')
   * @param id - Entity identifier
   * @returns Parsed data or null
   *
   * @example
   * const product = await cache.get<Product>('product', productId);
   * if (!product) {
   *   // Cache miss — fetch from DB
   * }
   */
  async get<T = unknown>(type: string, id: string): Promise<T | null> {
    const key = this.buildKey(type, id);
    const value = await this.redis.get(key);

    if (value === null) {
      return null;
    }

    let jsonStr = value;

    // Decompress if value was compressed
    if (value.startsWith(COMPRESSED_PREFIX)) {
      const compressedData = Buffer.from(value.slice(COMPRESSED_PREFIX.length), 'base64');
      const decompressed = await inflateAsync(compressedData);
      jsonStr = decompressed.toString('utf8');
    }

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      // If JSON parse fails, return null (corrupted cache entry)
      return null;
    }
  }

  /**
   * Delete a cached value by type and id.
   *
   * @param type - Entity type (e.g., 'product', 'user', 'feed')
   * @param id - Entity identifier
   * @returns true if the key was deleted, false if it didn't exist
   *
   * @example
   * await cache.del('product', productId);
   */
  async del(type: string, id: string): Promise<boolean> {
    const key = this.buildKey(type, id);
    const result = await this.redis.del(key);
    return result > 0;
  }

  /**
   * Delete all keys matching a type pattern.
   * Useful for cache invalidation of an entire entity type.
   *
   * WARNING: Uses SCAN (non-blocking) but still iterates all matching keys.
   * Use sparingly in production.
   *
   * @param type - Entity type to flush (e.g., 'product')
   * @returns Number of keys deleted
   */
  async delByType(type: string): Promise<number> {
    const pattern = `${this.prefix}:${type}:*`;
    let cursor = '0';
    let deleted = 0;

    do {
      const [nextCursor, keys] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        deleted += await this.redis.del(...keys);
      }
    } while (cursor !== '0');

    return deleted;
  }

  /**
   * Check remaining TTL for a cached key.
   *
   * @param type - Entity type
   * @param id - Entity identifier
   * @returns TTL in seconds, -1 if no TTL, -2 if key doesn't exist
   */
  async ttl(type: string, id: string): Promise<number> {
    const key = this.buildKey(type, id);
    return this.redis.ttl(key);
  }
}
