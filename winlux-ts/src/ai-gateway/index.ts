/**
 * AI Gateway — Resilient HTTP client for AI Engine communication
 *
 * Features:
 * - Circuit breaker (auto-open after N failures)
 * - Health status caching (avoid repeated failed checks)
 * - Graceful degradation (fallback responses)
 * - Request queuing (optional, for when AI comes back)
 *
 * Usage:
 * ```typescript
 * import { AIGateway, createAIGateway } from '@winlux/ai-gateway';
 *
 * const gateway = createAIGateway({
 *   baseUrl: 'http://localhost:8001',
 *   serviceName: 'smartbuy',
 *   redis,
 * });
 *
 * const result = await gateway.call('/ai/query', { message: 'hello' });
 * if (result.offline) {
 *   // Handle fallback
 * }
 * ```
 */

import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { Redis } from 'ioredis';

// ─── Types ───

export interface AIGatewayConfig {
  /** Base URL of the AI engine (e.g., http://localhost:8001) */
  baseUrl: string;
  /** Service name for logging and metrics */
  serviceName: string;
  /** Redis client for health status caching */
  redis?: Redis;
  /** Request timeout in ms (default: 10000) */
  timeoutMs?: number;
  /** Number of failures before opening circuit (default: 3) */
  circuitBreakerThreshold?: number;
  /** Time in ms before attempting to close circuit (default: 60000) */
  circuitBreakerResetMs?: number;
  /** Health check endpoint (default: /health) */
  healthEndpoint?: string;
  /** Logger instance (default: console) */
  logger?: Logger;
}

export interface AIGatewayResponse<T = any> {
  /** Response data from AI engine */
  data: T | null;
  /** True if AI engine is offline/unavailable */
  offline: boolean;
  /** True if response came from cache */
  cached?: boolean;
  /** Error message if failed */
  error?: string;
  /** HTTP status code */
  status?: number;
  /** Response time in ms */
  responseTimeMs?: number;
}

export interface AIHealthStatus {
  available: boolean;
  lastCheck: number;
  consecutiveFailures: number;
  circuitOpen: boolean;
  circuitOpenedAt?: number;
}

export interface Logger {
  info: (message: string, meta?: Record<string, any>) => void;
  warn: (message: string, meta?: Record<string, any>) => void;
  error: (message: string, meta?: Record<string, any>) => void;
  debug: (message: string, meta?: Record<string, any>) => void;
}

// ─── Default Logger ───

const defaultLogger: Logger = {
  info: (msg, meta) => console.log(`[AIGateway] ${msg}`, meta || ''),
  warn: (msg, meta) => console.warn(`[AIGateway] ${msg}`, meta || ''),
  error: (msg, meta) => console.error(`[AIGateway] ${msg}`, meta || ''),
  debug: (msg, meta) => console.debug(`[AIGateway] ${msg}`, meta || ''),
};

// ─── AI Gateway Class ───

export class AIGateway {
  private client: AxiosInstance;
  private redis?: Redis;
  private serviceName: string;
  private logger: Logger;

  // Circuit breaker state
  private failureCount = 0;
  private circuitOpen = false;
  private circuitOpenedAt = 0;
  private circuitBreakerThreshold: number;
  private circuitBreakerResetMs: number;

  // Health check
  private healthEndpoint: string;
  private lastHealthCheck = 0;
  private healthCheckIntervalMs = 30000; // 30 seconds

  constructor(config: AIGatewayConfig) {
    this.serviceName = config.serviceName;
    this.redis = config.redis;
    this.logger = config.logger || defaultLogger;
    this.circuitBreakerThreshold = config.circuitBreakerThreshold ?? 3;
    this.circuitBreakerResetMs = config.circuitBreakerResetMs ?? 60000;
    this.healthEndpoint = config.healthEndpoint ?? '/health';

    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeoutMs ?? 10000,
      headers: { 'Content-Type': 'application/json' },
    });

    this.logger.info(`Initialized for ${config.baseUrl}`, { service: this.serviceName });
  }

  // ─── Public Methods ───

  /**
   * Check if AI engine is available (fast, uses cached status)
   */
  async isAvailable(): Promise<boolean> {
    // Check circuit breaker
    if (this.circuitOpen) {
      if (Date.now() - this.circuitOpenedAt > this.circuitBreakerResetMs) {
        this.logger.info('Circuit breaker reset, attempting recovery', { service: this.serviceName });
        this.circuitOpen = false;
        this.failureCount = 0;
      } else {
        return false;
      }
    }

    // Check Redis cache
    if (this.redis) {
      try {
        const cached = await this.redis.get(`ai_health:${this.serviceName}`);
        if (cached === 'offline') return false;
        if (cached === 'online') return true;
      } catch {
        // Redis error, continue with direct check
      }
    }

    // If we haven't checked recently, return optimistic true
    // (let the actual call determine availability)
    return true;
  }

  /**
   * Get detailed health status
   */
  async getHealthStatus(): Promise<AIHealthStatus> {
    const available = await this.checkHealth();
    return {
      available,
      lastCheck: this.lastHealthCheck,
      consecutiveFailures: this.failureCount,
      circuitOpen: this.circuitOpen,
      circuitOpenedAt: this.circuitOpen ? this.circuitOpenedAt : undefined,
    };
  }

  /**
   * Make a request to the AI engine with circuit breaker protection
   */
  async call<T = any>(
    endpoint: string,
    data?: any,
    options?: { method?: 'GET' | 'POST'; cache?: boolean; cacheTtlSec?: number }
  ): Promise<AIGatewayResponse<T>> {
    const startTime = Date.now();
    const method = options?.method ?? 'POST';

    // Check availability first
    if (!(await this.isAvailable())) {
      return {
        data: null,
        offline: true,
        error: 'AI engine unavailable (circuit open)',
        responseTimeMs: Date.now() - startTime,
      };
    }

    try {
      const config: AxiosRequestConfig = {
        method,
        url: endpoint,
        ...(method === 'POST' ? { data } : { params: data }),
      };

      const response = await this.client.request<T>(config);

      // Success: reset failure count
      this.failureCount = 0;
      await this.updateHealthCache('online');

      return {
        data: response.data,
        offline: false,
        status: response.status,
        responseTimeMs: Date.now() - startTime,
      };
    } catch (error: any) {
      return this.handleError<T>(error, startTime);
    }
  }

  /**
   * Perform a health check against the AI engine
   */
  async checkHealth(): Promise<boolean> {
    this.lastHealthCheck = Date.now();

    try {
      const response = await this.client.get(this.healthEndpoint, { timeout: 5000 });
      const healthy = response.status === 200;

      if (healthy) {
        this.failureCount = 0;
        await this.updateHealthCache('online');
      }

      return healthy;
    } catch (error) {
      this.logger.warn('Health check failed', { service: this.serviceName, error: (error as Error).message });
      await this.updateHealthCache('offline');
      return false;
    }
  }

  /**
   * Force circuit breaker to open (e.g., for maintenance)
   */
  openCircuit(): void {
    this.circuitOpen = true;
    this.circuitOpenedAt = Date.now();
    this.logger.warn('Circuit manually opened', { service: this.serviceName });
  }

  /**
   * Force circuit breaker to close (e.g., after maintenance)
   */
  closeCircuit(): void {
    this.circuitOpen = false;
    this.failureCount = 0;
    this.logger.info('Circuit manually closed', { service: this.serviceName });
  }

  // ─── Private Methods ───

  private async handleError<T>(error: any, startTime: number): Promise<AIGatewayResponse<T>> {
    this.failureCount++;

    const isNetworkError =
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message?.includes('timeout');

    if (isNetworkError) {
      this.logger.warn('Network error', {
        service: this.serviceName,
        code: error.code,
        failures: this.failureCount,
      });

      // Open circuit after threshold
      if (this.failureCount >= this.circuitBreakerThreshold) {
        this.circuitOpen = true;
        this.circuitOpenedAt = Date.now();
        await this.updateHealthCache('offline');
        this.logger.error('Circuit breaker opened', { service: this.serviceName });
      }

      return {
        data: null,
        offline: true,
        error: `AI engine unreachable: ${error.code || error.message}`,
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Non-network error (4xx, 5xx)
    const status = error.response?.status;
    this.logger.warn('Request error', {
      service: this.serviceName,
      status,
      message: error.message,
    });

    return {
      data: error.response?.data || null,
      offline: false, // Engine is reachable, just returned error
      error: error.response?.data?.message || error.message,
      status,
      responseTimeMs: Date.now() - startTime,
    };
  }

  private async updateHealthCache(status: 'online' | 'offline'): Promise<void> {
    if (!this.redis) return;
    try {
      await this.redis.setex(`ai_health:${this.serviceName}`, 60, status);
    } catch {
      // Redis error, ignore
    }
  }
}

// ─── Factory Function ───

export function createAIGateway(config: AIGatewayConfig): AIGateway {
  return new AIGateway(config);
}

// ─── Fallback Helpers ───

export const FALLBACK_MESSAGES = {
  vi: {
    general: 'Trợ lý AI đang bảo trì. Vui lòng thử lại sau.',
    chat: 'Trợ lý AI đang không khả dụng. Bạn vẫn có thể sử dụng các tính năng khác.',
    health: 'Trợ lý sức khỏe AI đang bảo trì. Để được tư vấn chính xác, vui lòng liên hệ bác sĩ.',
    search: 'AI tìm kiếm đang bận. Đang sử dụng tìm kiếm thường.',
  },
  en: {
    general: 'AI assistant is under maintenance. Please try again later.',
    chat: 'AI assistant is unavailable. You can still use other features.',
    health: 'Health AI assistant is under maintenance. Please consult a doctor for accurate advice.',
    search: 'AI search is busy. Using standard search.',
  },
};

/**
 * Create a fallback response for when AI is offline
 */
export function createFallbackResponse(
  type: keyof typeof FALLBACK_MESSAGES.vi,
  lang: 'vi' | 'en' = 'vi'
): { message: string; fallback: true; ai_offline: true } {
  return {
    message: FALLBACK_MESSAGES[lang][type],
    fallback: true,
    ai_offline: true,
  };
}

export default AIGateway;
