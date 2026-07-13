/**
 * NotificationDigest — Batch digest capability for grouping same-type notifications.
 *
 * Buffers multiple notifications of the same type for a given user, then emits
 * a single summary notification after a configurable time window expires.
 *
 * Example:  5 price_drop notifications within 15 minutes → 1 summary:
 *   "Bạn có 5 sản phẩm giảm giá"
 *
 * Uses in-memory Map + setTimeout for window expiry.  For distributed environments,
 * consider extending with BullMQ delayed jobs (same pattern as NotificationScheduler).
 *
 * @example
 * ```typescript
 * const digest = new NotificationDigest({
 *   windowMs: 5 * 60 * 1000, // 5 minutes
 *   onDigest: async (userId, type, notifications) => {
 *     await notifier.send({
 *       userId,
 *       type,
 *       title: `🔔 Bạn có ${notifications.length} thông báo mới`,
 *       body: buildSummary(type, notifications),
 *     });
 *   },
 * });
 *
 * // Add notifications — they get buffered
 * await digest.add(payload1);
 * await digest.add(payload2);
 *
 * // After windowMs, onDigest fires with all buffered payloads
 * ```
 *
 * Requirements:  Req 6.4
 */

import type { NotificationPayload, NotificationType } from './types.js';

/**
 * Callback invoked when the digest window expires for a given user+type combination.
 * Receives all buffered notifications for that key.
 */
export type DigestCallback = (
  userId: string,
  type: NotificationType,
  notifications: NotificationPayload[],
) => void | Promise<void>;

/**
 * Configuration for the NotificationDigest.
 */
export interface DigestConfig {
  /**
   * Time window in milliseconds to buffer notifications before emitting a digest.
   * Default:  5 minutes (300000ms).
   */
  windowMs?: number;

  /**
   * Callback invoked when the digest window expires.
   * Receives the userId, notification type, and all buffered notifications for that key.
   */
  onDigest: DigestCallback;

  /**
   * Maximum number of notifications to buffer per key before force-flushing.
   * Prevents unbounded memory growth.  Default:  100.
   */
  maxBufferSize?: number;
}

/** Default digest window:  5 minutes */
const DEFAULT_WINDOW_MS = 5 * 60 * 1000;

/** Default max buffer size per key */
const DEFAULT_MAX_BUFFER_SIZE = 100;

/**
 * Internal buffer entry for a single user+type combination.
 */
interface BufferEntry {
  notifications: NotificationPayload[];
  timer: ReturnType<typeof setTimeout>;
}

/**
 * Build the buffer key from userId and notification type.
 */
export function buildDigestKey(userId: string, type: NotificationType): string {
  return `${userId}:${type}`;
}

/**
 * NotificationDigest — Groups same-type notifications per user into batch summaries.
 *
 * Buffer lifecycle:
 * 1. First notification for a key → create buffer + start timer
 * 2. Subsequent notifications for same key → append to buffer
 * 3. Timer expires OR buffer reaches maxBufferSize → flush and invoke onDigest callback
 */
export class NotificationDigest {
  private buffer: Map<string, BufferEntry> = new Map();
  private readonly windowMs: number;
  private readonly maxBufferSize: number;
  private readonly onDigest: DigestCallback;
  private _disposed = false;

  constructor(config: DigestConfig) {
    if (!config.onDigest) {
      throw new Error('DigestConfig.onDigest callback is required');
    }

    if (config.windowMs !== undefined && config.windowMs <= 0) {
      throw new Error('DigestConfig.windowMs must be a positive number');
    }

    if (config.maxBufferSize !== undefined && config.maxBufferSize <= 0) {
      throw new Error('DigestConfig.maxBufferSize must be a positive number');
    }

    this.windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
    this.maxBufferSize = config.maxBufferSize ?? DEFAULT_MAX_BUFFER_SIZE;
    this.onDigest = config.onDigest;
  }

  /**
   * Add a notification to the digest buffer.
   *
   * If this is the first notification for the user+type key, a timer is started.
   * If the buffer for this key reaches maxBufferSize, it is flushed immediately.
   *
   * @param payload - The notification payload to buffer
   * @returns The buffer key used for this notification
   */
  add(payload: NotificationPayload): string {
    if (this._disposed) {
      throw new Error('NotificationDigest has been disposed');
    }

    const key = buildDigestKey(payload.userId, payload.type);
    const existing = this.buffer.get(key);

    if (existing) {
      // Append to existing buffer
      existing.notifications.push(payload);

      // Force flush if max buffer size reached
      if (existing.notifications.length >= this.maxBufferSize) {
        this.flush(key);
      }
    } else {
      // Create new buffer entry with timer
      const timer = setTimeout(() => {
        this.flush(key);
      }, this.windowMs);

      this.buffer.set(key, {
        notifications: [payload],
        timer,
      });
    }

    return key;
  }

  /**
   * Manually flush all buffered notifications for a given key.
   * Invokes the onDigest callback and removes the buffer entry.
   *
   * @param key - The buffer key (userId:type) to flush
   * @returns true if the key existed and was flushed, false if not found
   */
  flush(key: string): boolean {
    const entry = this.buffer.get(key);
    if (!entry) {
      return false;
    }

    // Clear the timer
    clearTimeout(entry.timer);

    // Remove from buffer before calling callback (prevents re-entrancy issues)
    this.buffer.delete(key);

    // Extract userId and type from key
    const [userId, ...typeParts] = key.split(':');
    const type = typeParts.join(':') as NotificationType;

    // Invoke callback (fire-and-forget for async callbacks)
    try {
      const result = this.onDigest(userId, type, entry.notifications);
      if (result instanceof Promise) {
        result.catch(() => {
          // Swallow errors from async callbacks — the caller should handle their own errors
        });
      }
    } catch {
      // Swallow synchronous errors from callback
    }

    return true;
  }

  /**
   * Flush all buffered notifications for all keys.
   * Useful for graceful shutdown scenarios.
   */
  flushAll(): void {
    const keys = Array.from(this.buffer.keys());
    for (const key of keys) {
      this.flush(key);
    }
  }

  /**
   * Get the number of buffered notifications for a given key.
   * Returns 0 if the key does not exist.
   *
   * @param key - The buffer key (userId:type)
   */
  getBufferSize(key: string): number {
    const entry = this.buffer.get(key);
    return entry ? entry.notifications.length : 0;
  }

  /**
   * Get all currently active buffer keys.
   */
  getActiveKeys(): string[] {
    return Array.from(this.buffer.keys());
  }

  /**
   * Get the total number of active digest buffers.
   */
  get pendingCount(): number {
    return this.buffer.size;
  }

  /**
   * Check if the digest has been disposed.
   */
  get disposed(): boolean {
    return this._disposed;
  }

  /**
   * Dispose the digest — flush all pending buffers and prevent new additions.
   * Call this during application shutdown to ensure no notifications are lost.
   */
  dispose(): void {
    if (this._disposed) return;

    this._disposed = true;
    this.flushAll();
  }
}

/**
 * Factory function to create a NotificationDigest instance.
 *
 * @param config - Digest configuration
 * @returns A new NotificationDigest instance
 *
 * @example
 * ```typescript
 * const digest = createDigest({
 *   windowMs: 15 * 60 * 1000, // 15 minutes
 *   onDigest: async (userId, type, notifications) => {
 *     console.log(`User ${userId} has ${notifications.length} ${type} notifications`);
 *   },
 * });
 * ```
 */
export function createDigest(config: DigestConfig): NotificationDigest {
  return new NotificationDigest(config);
}
