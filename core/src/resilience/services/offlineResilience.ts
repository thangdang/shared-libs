/**
 * Offline Resilience Service Template
 *
 * Pattern for VPS Express.js services to serve cached AI responses
 * when the local PC (running AI engines) is offline.
 *
 * Each VPS service copies and adapts this template.
 */

import { Collection, Db, ObjectId } from 'mongodb';
import axios from 'axios';

export interface OfflineResilienceConfig {
  /** Cache TTL in days: 7 (news), 30 (products), 90 (health/tax) */
  cacheTTLDays: number;
  /** Minimum text search score to serve cached response */
  scoreThreshold: number;
  /** Queue poll interval in milliseconds */
  queuePollIntervalMs: number;
  /** AI engine base URL (e.g., http://192.168.1.x:8000) */
  aiEngineUrl: string;
  /** Service name for collection prefixing */
  serviceName: string;
}

export interface AICacheDocument {
  _id?: ObjectId;
  query: string;
  response: any;
  engine_endpoint: string;
  created_at: Date;
  expires_at: Date;
}

export interface AIQueueDocument {
  _id?: ObjectId;
  query: string;
  endpoint: string;
  user_id: string | null;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  created_at: Date;
  processed_at: Date | null;
  result: any | null;
  retry_count: number;
}

export interface CachedResponseResult {
  response: any;
  score: number;
  label: string;
}

export class OfflineResilienceService {
  private cacheCollection: Collection<AICacheDocument>;
  private queueCollection: Collection<AIQueueDocument>;
  private config: OfflineResilienceConfig;
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(db: Db, config: OfflineResilienceConfig) {
    this.config = config;
    this.cacheCollection = db.collection<AICacheDocument>(
      `${config.serviceName}_ai_cache`
    );
    this.queueCollection = db.collection<AIQueueDocument>(
      `${config.serviceName}_ai_queue`
    );
  }

  /**
   * Store a successful AI response in cache with TTL.
   */
  async cacheResponse(
    query: string,
    response: any,
    endpoint: string
  ): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + this.config.cacheTTLDays * 24 * 60 * 60 * 1000
    );

    await this.cacheCollection.insertOne({
      query,
      response,
      engine_endpoint: endpoint,
      created_at: now,
      expires_at: expiresAt,
    });
  }

  /**
   * Search cache using MongoDB $text search.
   * Returns cached response only if score exceeds threshold (0.7).
   * Includes "Dựa trên dữ liệu đã lưu" label on cached responses.
   */
  async findCachedResponse(
    query: string
  ): Promise<CachedResponseResult | null> {
    const results = await this.cacheCollection
      .find(
        { $text: { $search: query } },
        { projection: { score: { $meta: 'textScore' }, response: 1, query: 1 } }
      )
      .sort({ score: { $meta: 'textScore' } })
      .limit(1)
      .toArray();

    if (results.length === 0) {
      return null;
    }

    const result = results[0] as any;
    const score = result.score || 0;

    if (score < this.config.scoreThreshold) {
      return null;
    }

    return {
      response: result.response,
      score,
      label: 'Dựa trên dữ liệu đã lưu',
    };
  }

  /**
   * Queue a request for later processing when AI comes back online.
   */
  async queueRequest(
    query: string,
    endpoint: string,
    userId?: string
  ): Promise<void> {
    await this.queueCollection.insertOne({
      query,
      endpoint,
      user_id: userId || null,
      status: 'pending',
      created_at: new Date(),
      processed_at: null,
      result: null,
      retry_count: 0,
    });
  }

  /**
   * Process queued requests in FIFO order when AI is back online.
   * Retries failed items up to 3 times.
   */
  async processQueue(): Promise<void> {
    if (!(await this.isAIOnline())) {
      return;
    }

    // Find oldest pending request (FIFO)
    const pendingRequest = await this.queueCollection.findOneAndUpdate(
      { status: 'pending' },
      { $set: { status: 'processing' } },
      { sort: { created_at: 1 }, returnDocument: 'after' }
    );

    if (!pendingRequest) {
      return;
    }

    try {
      // Process the request
      const response = await axios.post(
        `${this.config.aiEngineUrl}${pendingRequest.endpoint}`,
        { query: pendingRequest.query },
        { timeout: 30000 }
      );

      // Store result in cache
      await this.cacheResponse(
        pendingRequest.query,
        response.data,
        pendingRequest.endpoint
      );

      // Mark as completed
      await this.queueCollection.updateOne(
        { _id: pendingRequest._id },
        {
          $set: {
            status: 'completed',
            processed_at: new Date(),
            result: response.data,
          },
        }
      );
    } catch (error) {
      const retryCount = (pendingRequest.retry_count || 0) + 1;

      if (retryCount >= 3) {
        await this.queueCollection.updateOne(
          { _id: pendingRequest._id },
          { $set: { status: 'failed', retry_count: retryCount } }
        );
      } else {
        // Re-queue for retry
        await this.queueCollection.updateOne(
          { _id: pendingRequest._id },
          { $set: { status: 'pending', retry_count: retryCount } }
        );
      }
    }
  }

  /**
   * Check if the AI engine is online via health check.
   */
  async isAIOnline(): Promise<boolean> {
    try {
      const response = await axios.get(
        `${this.config.aiEngineUrl}/health`,
        { timeout: 5000 }
      );
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Start periodic queue processing.
   */
  startQueuePolling(): void {
    this.pollInterval = setInterval(
      () => this.processQueue(),
      this.config.queuePollIntervalMs
    );
  }

  /**
   * Stop periodic queue processing.
   */
  stopQueuePolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }
}
