/**
 * NotificationScheduler — BullMQ-based send scheduling for notifications.
 *
 * Supports:
 * - `sendAt`: absolute time (Date or ISO string) — schedules at exact time
 * - `sendAfter`: relative delay ("30m", "2h", "1d") — schedules after duration
 *
 * All time calculations are timezone-aware (Asia/Ho_Chi_Minh = UTC+7).
 *
 * @example
 * ```typescript
 * const scheduler = new NotificationScheduler('redis://localhost:6379');
 *
 * // Schedule at absolute time
 * const jobId = await scheduler.schedule(payload, {
 *   sendAt: '2026-07-08T07:00:00+07:00',
 * });
 *
 * // Schedule after relative delay
 * const jobId2 = await scheduler.schedule(payload, {
 *   sendAfter: '30m',
 * });
 *
 * // Cancel a scheduled notification
 * await scheduler.cancel(jobId);
 *
 * // List scheduled notifications
 * const jobs = await scheduler.getScheduled('user-123');
 * ```
 *
 * Requirements: Req 6.1, 6.2
 */

import { Queue, Job } from 'bullmq';
import type { NotificationPayload, NotificationPriority } from './types.js';

/** UTC+7 offset in milliseconds (Asia/Ho_Chi_Minh) */
const VN_TIMEZONE_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Quiet hours start — 10 PM VN time (inclusive) */
const QUIET_START = 22;

/** Quiet hours end — 7 AM VN time (exclusive) */
const QUIET_END = 7;

/** Queue name for scheduled notifications */
const QUEUE_NAME = 'notification:scheduled';

/**
 * Scheduling options — either sendAt (absolute) or sendAfter (relative).
 */
export interface ScheduleOptions {
  /**
   * Absolute send time.  Interpreted as Asia/Ho_Chi_Minh (UTC+7) if no timezone offset is specified.
   * Accepts a Date object or an ISO 8601 string.
   */
  sendAt?: Date | string;

  /**
   * Relative delay from now.  Supports suffixes: "m" (minutes), "h" (hours), "d" (days).
   * Examples: "30m", "2h", "1d", "7d"
   */
  sendAfter?: string;

  /**
   * Optional priority override for quiet hours evaluation.
   * If not specified, the priority from the notification payload is used.
   * Critical priority bypasses quiet hours entirely.
   */
  priority?: NotificationPriority;
}

/**
 * Represents a scheduled notification job.
 */
export interface ScheduledJob {
  /** BullMQ job ID */
  jobId: string;
  /** Notification payload */
  payload: NotificationPayload;
  /** Scheduled send time (UTC) */
  scheduledAt: Date;
  /** Remaining delay in milliseconds */
  delayMs: number;
  /** Current job state */
  state: string;
}

/**
 * Parse a relative duration string into milliseconds.
 *
 * Supported formats:
 * - "30m" → 30 minutes
 * - "1h" → 1 hour
 * - "2h" → 2 hours
 * - "1d" → 1 day
 * - "7d" → 7 days
 * - "90s" → 90 seconds
 *
 * @param duration - Duration string (e.g., "30m", "2h", "1d")
 * @returns Milliseconds equivalent
 * @throws Error if format is invalid
 */
export function parseDuration(duration: string): number {
  const trimmed = duration.trim().toLowerCase();
  const match = trimmed.match(/^(\d+(?:\.\d+)?)\s*(s|m|h|d|w)$/);

  if (!match) {
    throw new Error(
      `Invalid duration format: "${duration}". ` +
      `Expected format: <number><unit> where unit is s, m, h, d, or w. ` +
      `Examples: "30m", "2h", "1d", "7d"`,
    );
  }

  const value = parseFloat(match[1]);
  const unit = match[2];

  if (value <= 0) {
    throw new Error(`Duration must be positive, got: "${duration}"`);
  }

  const multipliers: Record<string, number> = {
    s: 1000,                    // seconds
    m: 60 * 1000,              // minutes
    h: 60 * 60 * 1000,        // hours
    d: 24 * 60 * 60 * 1000,   // days
    w: 7 * 24 * 60 * 60 * 1000, // weeks
  };

  return Math.round(value * multipliers[unit]);
}

/**
 * Convert a sendAt value to a UTC Date, treating naive inputs as Asia/Ho_Chi_Minh.
 *
 * - If a Date object: used as-is (already in UTC internally).
 * - If an ISO string with timezone offset (e.g., "+07:00"): parsed directly.
 * - If a naive ISO string (no offset): interpreted as Asia/Ho_Chi_Minh (UTC+7).
 *
 * @param sendAt - Date object or ISO 8601 string
 * @returns UTC Date
 */
function resolveAbsoluteTime(sendAt: Date | string): Date {
  if (sendAt instanceof Date) {
    return sendAt;
  }

  // If the string has a timezone indicator (Z, +HH:MM, -HH:MM), parse directly
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2}|[+-]\d{4})$/i.test(sendAt);

  if (hasTimezone) {
    const parsed = new Date(sendAt);
    if (isNaN(parsed.getTime())) {
      throw new Error(`Invalid sendAt date string: "${sendAt}"`);
    }
    return parsed;
  }

  // No timezone → interpret as Asia/Ho_Chi_Minh (UTC+7)
  // Parse as UTC first, then subtract 7 hours to convert VN time to UTC
  const asUtc = new Date(sendAt + 'Z');
  if (isNaN(asUtc.getTime())) {
    throw new Error(`Invalid sendAt date string: "${sendAt}"`);
  }

  return new Date(asUtc.getTime() - VN_TIMEZONE_OFFSET_MS);
}

/**
 * Get the current time in Vietnam timezone (UTC+7) as a Date.
 * Useful for debugging and logging.
 */
export function getCurrentVNTime(): Date {
  const now = new Date();
  return new Date(now.getTime() + VN_TIMEZONE_OFFSET_MS);
}

/**
 * Get the hour component in Vietnam timezone (0–23).
 */
export function getVNHour(date: Date): number {
  // Convert UTC date to VN time and extract hour
  const vnTime = new Date(date.getTime() + VN_TIMEZONE_OFFSET_MS);
  return vnTime.getUTCHours();
}

/**
 * Calculate the next 07:00 AM VN time from a given date.
 * If the date is already between 00:00–06:59 VN time, returns 07:00 same day.
 * If the date is at 22:00–23:59 VN time, returns 07:00 next day.
 *
 * @param date - A UTC Date that falls within quiet hours
 * @returns A UTC Date representing the next 07:00 AM in VN timezone
 */
function nextMorning(date: Date): Date {
  // Convert to VN time for calculation
  const vnTimeMs = date.getTime() + VN_TIMEZONE_OFFSET_MS;
  const vnDate = new Date(vnTimeMs);

  const vnHour = vnDate.getUTCHours();

  // Set to 07:00 VN time on the appropriate day
  vnDate.setUTCHours(QUIET_END, 0, 0, 0);

  if (vnHour >= QUIET_START) {
    // It's 22:00–23:59 VN → next day 07:00
    vnDate.setUTCDate(vnDate.getUTCDate() + 1);
  }
  // else: It's 00:00–06:59 VN → same day 07:00

  // Convert back from VN time to UTC
  return new Date(vnDate.getTime() - VN_TIMEZONE_OFFSET_MS);
}

/**
 * Apply quiet hours enforcement to a scheduled send time.
 *
 * During quiet hours (22:00–07:00 VN time), notifications are delayed
 * to the next morning at 07:00 AM VN time.  Critical priority notifications
 * bypass quiet hours and are never delayed.
 *
 * @param sendTime - The intended send time (UTC)
 * @param priority - Notification priority level
 * @returns Adjusted send time — original if outside quiet hours or critical, otherwise next 07:00 VN
 *
 * Requirements:  Req 6.3
 */
export function applyQuietHours(sendTime: Date, priority: NotificationPriority): Date {
  if (priority === 'critical') return sendTime; // Never delay critical

  const vnHour = getVNHour(sendTime);
  if (vnHour >= QUIET_START || vnHour < QUIET_END) {
    // During quiet hours — reschedule to 07:00 AM next morning
    return nextMorning(sendTime);
  }

  return sendTime;
}

/**
 * NotificationScheduler — BullMQ-based scheduling for deferred notification sends.
 *
 * Uses BullMQ delayed jobs to schedule notifications at a specific time
 * or after a relative delay.  All times are timezone-aware (Asia/Ho_Chi_Minh, UTC+7).
 */
export class NotificationScheduler {
  private queue: Queue;

  /**
   * Create a new NotificationScheduler.
   *
   * @param redisUrl - Redis connection URL (e.g., "redis://localhost:6379")
   * @param queueName - Optional custom queue name (default: "notification:scheduled")
   */
  constructor(redisUrl: string, queueName: string = QUEUE_NAME) {
    this.queue = new Queue(queueName, {
      connection: { url: redisUrl },
    });
  }

  /**
   * Schedule a notification for deferred delivery.
   *
   * Either `sendAt` (absolute) or `sendAfter` (relative) must be specified.
   * If both are provided, `sendAt` takes precedence.
   *
   * @param payload - The notification payload to send
   * @param options - Scheduling options (sendAt or sendAfter)
   * @returns Job ID that can be used to cancel or query the scheduled notification
   * @throws Error if neither sendAt nor sendAfter is specified, or if the resolved time is in the past
   *
   * @example
   * ```typescript
   * // Absolute scheduling
   * const id = await scheduler.schedule(payload, {
   *   sendAt: new Date('2026-07-08T07:00:00+07:00'),
   * });
   *
   * // Relative scheduling
   * const id = await scheduler.schedule(payload, { sendAfter: '2h' });
   * ```
   */
  async schedule(payload: NotificationPayload, options: ScheduleOptions): Promise<string> {
    const priority = options.priority ?? payload.priority ?? 'normal';
    const delay = this.calculateDelay(options, priority);

    const job = await this.queue.add('send', payload, {
      delay,
      removeOnComplete: true,
      removeOnFail: { count: 100 },
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    return job.id!;
  }

  /**
   * Cancel a previously scheduled notification.
   *
   * @param jobId - The job ID returned by `schedule()`
   * @returns `true` if the job was successfully cancelled, `false` if not found or already processed
   */
  async cancel(jobId: string): Promise<boolean> {
    const job = await Job.fromId(this.queue, jobId);

    if (!job) {
      return false;
    }

    const state = await job.getState();

    // Can only cancel if still in delayed or waiting state
    if (state === 'delayed' || state === 'waiting') {
      await job.remove();
      return true;
    }

    return false;
  }

  /**
   * List scheduled (delayed) notifications, optionally filtered by userId.
   *
   * @param userId - Optional user ID to filter by.  If omitted, returns all scheduled jobs.
   * @returns Array of scheduled job information
   */
  async getScheduled(userId?: string): Promise<ScheduledJob[]> {
    const delayedJobs = await this.queue.getDelayed();
    const now = Date.now();

    const jobs: ScheduledJob[] = [];

    for (const job of delayedJobs) {
      const payload = job.data as NotificationPayload;

      // Filter by userId if specified
      if (userId && payload.userId !== userId) {
        continue;
      }

      const scheduledAt = new Date(job.timestamp + (job.opts.delay || 0));
      const delayMs = Math.max(0, scheduledAt.getTime() - now);

      jobs.push({
        jobId: job.id!,
        payload,
        scheduledAt,
        delayMs,
        state: await job.getState(),
      });
    }

    return jobs;
  }

  /**
   * Close the queue connection gracefully.
   * Call this when shutting down the application.
   */
  async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Calculate the delay in milliseconds from schedule options.
   * Applies quiet hours enforcement before returning the final delay.
   * @internal
   */
  private calculateDelay(options: ScheduleOptions, priority: NotificationPriority): number {
    if (!options.sendAt && !options.sendAfter) {
      throw new Error(
        'Either sendAt (absolute time) or sendAfter (relative delay) must be specified.',
      );
    }

    let targetTime: Date;

    if (options.sendAt) {
      // Absolute time
      targetTime = resolveAbsoluteTime(options.sendAt);
    } else {
      // Relative delay — calculate target time from now
      const delayMs = parseDuration(options.sendAfter!);
      targetTime = new Date(Date.now() + delayMs);
    }

    // Apply quiet hours enforcement (Req 6.3)
    const adjustedTime = applyQuietHours(targetTime, priority);
    const delay = adjustedTime.getTime() - Date.now();

    if (delay < 0) {
      throw new Error(
        'Scheduled time is in the past. Use a future sendAt time or a positive sendAfter duration.',
      );
    }

    return delay;
  }
}
