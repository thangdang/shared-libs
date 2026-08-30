/**
 * Notification Service Client
 * ────────────────────────────
 * Drop this file into any product service's src/services/ folder.
 * Wraps NotificationClient + NotificationScheduler with auto-config from env vars.
 *
 * Requirements:  Req 8.1
 */

import { NotificationClient } from '../notification-service/src/client.js';
import { NotificationScheduler } from '../notification-service/src/scheduler.js';
import type { NotificationPayload, NotificationResult, NotificationConfig } from '../notification-service/src/types.js';
import type { ScheduleOptions } from '../notification-service/src/scheduler.js';

// ─── Auto-config from environment variables ───────────────────────────────────

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

function buildConfig(product: string): NotificationConfig {
  return {
    product,
    redisUrl: REDIS_URL,
    fcmServiceAccount: process.env.FCM_SA ? JSON.parse(process.env.FCM_SA) : undefined,
    zaloOAToken: process.env.ZALO_OA_TOKEN,
    sms: process.env.ESMS_API_KEY
      ? {
          apiKey: process.env.ESMS_API_KEY,
          secretKey: process.env.ESMS_SECRET_KEY,
          brandname: process.env.ESMS_BRANDNAME,
        }
      : undefined,
    email: process.env.RESEND_API_KEY
      ? {
          apiKey: process.env.RESEND_API_KEY,
          from: process.env.EMAIL_FROM || `WinLux <no-reply@winlux.com>`,
        }
      : undefined,
  };
}

// ─── NotificationServiceClient class ─────────────────────────────────────────

export class NotificationServiceClient {
  private client: NotificationClient;
  private scheduler: NotificationScheduler;

  constructor(product: string) {
    this.client = new NotificationClient(buildConfig(product));
    this.scheduler = new NotificationScheduler(REDIS_URL);
  }

  /**
   * Send a notification immediately via configured channels with fallback.
   */
  async send(payload: NotificationPayload): Promise<NotificationResult[]> {
    return this.client.send(payload);
  }

  /**
   * Schedule a notification for deferred delivery.
   * Supports `sendAt` (absolute time) or `sendAfter` (relative delay like "30m", "2h").
   * Returns job ID for cancellation.
   */
  async schedule(payload: NotificationPayload, options: ScheduleOptions): Promise<string> {
    return this.scheduler.schedule(payload, options);
  }

  /**
   * Cancel a previously scheduled notification by job ID.
   * Returns `true` if successfully cancelled, `false` if not found or already sent.
   */
  async cancel(jobId: string): Promise<boolean> {
    return this.scheduler.cancel(jobId);
  }

  /**
   * List scheduled notifications for a user.
   */
  async getScheduled(userId?: string) {
    return this.scheduler.getScheduled(userId);
  }

  /**
   * Close connections gracefully.  Call on app shutdown.
   */
  async close(): Promise<void> {
    await this.scheduler.close();
  }
}

// ─── Convenience functions (stateless, create client per call) ────────────────

/**
 * Send a notification immediately.
 * Auto-configures from env vars.  Product name identifies the calling service.
 */
export async function sendNotification(
  product: string,
  payload: NotificationPayload,
): Promise<NotificationResult[]> {
  const client = new NotificationClient(buildConfig(product));
  return client.send(payload);
}

/**
 * Schedule a notification for deferred delivery.
 * Returns a job ID that can be used to cancel the scheduled notification.
 *
 * @param product - Product name (e.g., "smartbuy", "caremate", "fintax")
 * @param payload - Notification payload
 * @param options - Schedule options:  `sendAt` (absolute time) or `sendAfter` (relative delay)
 * @returns Job ID for cancellation
 */
export async function scheduleNotification(
  product: string,
  payload: NotificationPayload,
  options: ScheduleOptions,
): Promise<string> {
  const scheduler = new NotificationScheduler(REDIS_URL);
  try {
    return await scheduler.schedule(payload, options);
  } finally {
    await scheduler.close();
  }
}

/**
 * Cancel a previously scheduled notification.
 *
 * @param jobId - Job ID returned by `scheduleNotification()`
 * @returns `true` if cancelled successfully, `false` if already sent or not found
 */
export async function cancelScheduled(jobId: string): Promise<boolean> {
  const scheduler = new NotificationScheduler(REDIS_URL);
  try {
    return await scheduler.cancel(jobId);
  } finally {
    await scheduler.close();
  }
}
