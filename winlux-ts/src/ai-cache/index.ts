/**
 * AI Response Cache — MongoDB-backed caching for AI Q&A
 *
 * Stores successful AI responses in MongoDB so they can be served
 * when the local AI engine is offline.
 *
 * Features:
 * - Semantic hash-based lookup (query similarity)
 * - TTL-based expiration
 * - Usage tracking for analytics
 * - Fallback chain: Redis → MongoDB → AI Engine
 */

import crypto from 'crypto';
import { Collection, Db, ObjectId } from 'mongodb';

export interface AiCacheEntry {
  _id?: ObjectId;
  queryHash: string;           // SHA-256 hash of normalized query
  queryNormalized: string;     // Lowercase, trimmed query
  queryOriginal: string;       // Original query for debugging
  response: any;               // Cached AI response
  responseType: string;        // 'chat' | 'recommendation' | 'summary' | 'diagnosis' | etc.
  metadata?: {
    userId?: string;
    context?: Record<string, any>;
    aiModel?: string;
    processingTimeMs?: number;
  };
  usageCount: number;          // How many times served from cache
  lastUsedAt: Date;
  createdAt: Date;
  expiresAt: Date;
  source: 'ai_engine' | 'manual' | 'pre_computed';
}

export interface AiCacheConfig {
  collectionName?: string;
  defaultTtlSeconds?: number;
  maxCacheSize?: number;
}

const DEFAULT_CONFIG: Required<AiCacheConfig> = {
  collectionName: 'ai_response_cache',
  defaultTtlSeconds: 7 * 24 * 60 * 60, // 7 days
  maxCacheSize: 100000,
};

export class AiResponseCache {
  private collection!: Collection<AiCacheEntry>;
  private config: Required<AiCacheConfig>;
  private initialized = false;

  constructor(config: AiCacheConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Initialize the cache with MongoDB connection.
   * Creates indexes for efficient lookups.
   */
  async init(db: Db): Promise<void> {
    this.collection = db.collection<AiCacheEntry>(this.config.collectionName);

    // Create indexes
    await this.collection.createIndexes([
      { key: { queryHash: 1 }, unique: true },
      { key: { expiresAt: 1 }, expireAfterSeconds: 0 }, // TTL index
      { key: { responseType: 1, usageCount: -1 } },
      { key: { createdAt: -1 } },
      { key: { lastUsedAt: -1 } },
    ]);

    this.initialized = true;
    console.log(`✅ AI Response Cache initialized: ${this.config.collectionName}`);
  }

  /**
   * Normalize query for consistent hashing.
   */
  private normalizeQuery(query: string): string {
    return query
      .toLowerCase()
      .trim()
      .replace(/\s+/g, ' ')           // Normalize whitespace
      .replace(/[?!.,;:]+$/g, '');     // Remove trailing punctuation
  }

  /**
   * Generate hash for query lookup.
   */
  private hashQuery(normalizedQuery: string): string {
    return crypto.createHash('sha256').update(normalizedQuery).digest('hex');
  }

  /**
   * Get cached response for a query.
   * Updates usage stats on hit.
   */
  async get(query: string, responseType?: string): Promise<AiCacheEntry | null> {
    if (!this.initialized) return null;

    const normalized = this.normalizeQuery(query);
    const hash = this.hashQuery(normalized);

    const filter: any = { queryHash: hash };
    if (responseType) {
      filter.responseType = responseType;
    }

    const entry = await this.collection.findOneAndUpdate(
      filter,
      {
        $inc: { usageCount: 1 },
        $set: { lastUsedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return entry || null;
  }

  /**
   * Store AI response in cache.
   */
  async set(
    query: string,
    response: any,
    responseType: string,
    options: {
      ttlSeconds?: number;
      metadata?: AiCacheEntry['metadata'];
      source?: AiCacheEntry['source'];
    } = {}
  ): Promise<void> {
    if (!this.initialized) return;

    const normalized = this.normalizeQuery(query);
    const hash = this.hashQuery(normalized);
    const ttl = options.ttlSeconds ?? this.config.defaultTtlSeconds;

    const entry: AiCacheEntry = {
      queryHash: hash,
      queryNormalized: normalized,
      queryOriginal: query,
      response,
      responseType,
      metadata: options.metadata,
      usageCount: 0,
      lastUsedAt: new Date(),
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + ttl * 1000),
      source: options.source ?? 'ai_engine',
    };

    await this.collection.updateOne(
      { queryHash: hash },
      { $set: entry },
      { upsert: true }
    );
  }

  /**
   * Bulk insert pre-computed responses.
   * Useful for seeding common Q&A.
   */
  async bulkSet(
    entries: Array<{
      query: string;
      response: any;
      responseType: string;
      ttlSeconds?: number;
    }>
  ): Promise<number> {
    if (!this.initialized || entries.length === 0) return 0;

    const operations = entries.map((e) => {
      const normalized = this.normalizeQuery(e.query);
      const hash = this.hashQuery(normalized);
      const ttl = e.ttlSeconds ?? this.config.defaultTtlSeconds;

      return {
        updateOne: {
          filter: { queryHash: hash },
          update: {
            $set: {
              queryHash: hash,
              queryNormalized: normalized,
              queryOriginal: e.query,
              response: e.response,
              responseType: e.responseType,
              usageCount: 0,
              lastUsedAt: new Date(),
              createdAt: new Date(),
              expiresAt: new Date(Date.now() + ttl * 1000),
              source: 'pre_computed' as const,
            },
          },
          upsert: true,
        },
      };
    });

    const result = await this.collection.bulkWrite(operations);
    return result.upsertedCount + result.modifiedCount;
  }

  /**
   * Get cache statistics.
   */
  async getStats(): Promise<{
    totalEntries: number;
    byType: Record<string, number>;
    bySource: Record<string, number>;
    topQueries: Array<{ query: string; usageCount: number }>;
    hitRate?: number;
  }> {
    if (!this.initialized) {
      return { totalEntries: 0, byType: {}, bySource: {}, topQueries: [] };
    }

    const [totalEntries, byType, bySource, topQueries] = await Promise.all([
      this.collection.countDocuments(),
      this.collection.aggregate([
        { $group: { _id: '$responseType', count: { $sum: 1 } } },
      ]).toArray(),
      this.collection.aggregate([
        { $group: { _id: '$source', count: { $sum: 1 } } },
      ]).toArray(),
      this.collection.find()
        .sort({ usageCount: -1 })
        .limit(10)
        .project({ queryNormalized: 1, usageCount: 1 })
        .toArray(),
    ]);

    return {
      totalEntries,
      byType: Object.fromEntries(byType.map((t) => [t._id, t.count])),
      bySource: Object.fromEntries(bySource.map((s) => [s._id, s.count])),
      topQueries: topQueries.map((q) => ({
        query: q.queryNormalized,
        usageCount: q.usageCount,
      })),
    };
  }

  /**
   * Delete expired or low-usage entries.
   */
  async cleanup(minUsageCount = 0): Promise<number> {
    if (!this.initialized) return 0;

    const result = await this.collection.deleteMany({
      $or: [
        { expiresAt: { $lt: new Date() } },
        { usageCount: { $lt: minUsageCount }, source: 'ai_engine' },
      ],
    });

    return result.deletedCount;
  }

  /**
   * Invalidate cache entries by pattern.
   */
  async invalidate(pattern: {
    responseType?: string;
    olderThan?: Date;
  }): Promise<number> {
    if (!this.initialized) return 0;

    const filter: any = {};
    if (pattern.responseType) filter.responseType = pattern.responseType;
    if (pattern.olderThan) filter.createdAt = { $lt: pattern.olderThan };

    const result = await this.collection.deleteMany(filter);
    return result.deletedCount;
  }
}

/**
 * Create AI-aware service wrapper.
 * Automatically caches FULL RAG responses only — no fallback/template data.
 */
export function createAiCacheMiddleware(cache: AiResponseCache) {
  /**
   * Check if response is a FULL RAG response (not template/fallback).
   */
  function isFullRagResponse(response: any): boolean {
    if (!response) return false;
    if (response.fallback === true) return false;
    if (response.error) return false;
    if (response._template === true) return false;
    if (response._partial === true) return false;

    // Must have actual AI-generated content
    return !!(
      response.message ||
      response.answer ||
      response.recommendations ||
      response.analysis ||
      response.data
    );
  }

  return async function withCache<T>(
    query: string,
    responseType: string,
    aiCall: () => Promise<T>,
    options: {
      ttlSeconds?: number;
      metadata?: AiCacheEntry['metadata'];
      skipCache?: boolean;
    } = {}
  ): Promise<{ data: T; fromCache: boolean; cacheKey?: string }> {
    // Skip cache if requested
    if (options.skipCache) {
      const data = await aiCall();
      return { data, fromCache: false };
    }

    // Try cache first — only serve full RAG responses
    const cached = await cache.get(query, responseType);
    if (cached && cached.metadata?.ragComplete) {
      return {
        data: cached.response as T,
        fromCache: true,
        cacheKey: cached.queryHash,
      };
    }

    // Call AI engine
    const data = await aiCall();

    // ✅ Only cache FULL RAG responses
    if (isFullRagResponse(data)) {
      await cache.set(query, data, responseType, {
        ttlSeconds: options.ttlSeconds,
        metadata: { ...options.metadata, ragComplete: true },
        source: 'ai_engine',
      });
    }

    return { data, fromCache: false };
  };
}

export default AiResponseCache;
