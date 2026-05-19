/**
 * Shared BullMQ Default Options
 *
 * Prevents unbounded job accumulation in Redis by enforcing retention limits
 * and retry policies across all services that use BullMQ queues.
 *
 * Usage:
 *   import { BULLMQ_DEFAULTS, createQueueOptions } from './bullmq-defaults';
 *
 *   // Use defaults directly
 *   const queue = new Queue('email', { ...BULLMQ_DEFAULTS, connection: redis });
 *
 *   // Or use helper for custom overrides
 *   const queue = new Queue('video-render', createQueueOptions({
 *     attempts: 5,
 *     backoff: { type: 'exponential', delay: 5000 },
 *   }));
 *
 * Copy this file into any service that uses BullMQ.
 * Only dependency: bullmq (already in services with queues).
 */

import type { QueueOptions, JobsOptions } from 'bullmq';

/**
 * Default job options applied to all jobs unless overridden.
 *
 * Rationale for each setting:
 * - removeOnComplete.age: 3600s (1h) — completed jobs older than 1 hour are removed
 * - removeOnComplete.count: 1000 — keep at most 1000 completed jobs (whichever limit hits first)
 * - removeOnFail.age: 86400s (24h) — failed jobs kept for 24h for debugging
 * - removeOnFail.count: 5000 — cap failed jobs to prevent Redis memory bloat
 * - attempts: 3 — retry up to 3 times before marking as permanently failed
 * - backoff.type: 'exponential' — 1s, 2s, 4s delays between retries
 * - backoff.delay: 1000ms — base delay for exponential backoff
 */
export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  /** Remove completed jobs after 1 hour or when count exceeds 1000 */
  removeOnComplete: {
    age: 3600,
    count: 1000,
  },
  /** Remove failed jobs after 24 hours or when count exceeds 5000 */
  removeOnFail: {
    age: 86400,
    count: 5000,
  },
  /** Number of retry attempts before permanent failure */
  attempts: 3,
  /** Exponential backoff: 1s → 2s → 4s */
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
};

/**
 * Shared BullMQ queue defaults.
 * Spread into Queue constructor options.
 *
 * @example
 * const queue = new Queue('notifications', {
 *   ...BULLMQ_DEFAULTS,
 *   connection: redisConnection,
 * });
 */
export const BULLMQ_DEFAULTS: Partial<QueueOptions> = {
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
};

/**
 * Creates queue options by merging custom job options with defaults.
 * Custom options override defaults (shallow merge on defaultJobOptions).
 *
 * @param overrides - Custom job options to merge with defaults
 * @returns Queue options ready to spread into Queue constructor
 *
 * @example
 * // For a queue that needs more retries and longer retention
 * const queue = new Queue('video-render', {
 *   ...createQueueOptions({
 *     attempts: 5,
 *     removeOnComplete: { age: 7200, count: 500 },
 *   }),
 *   connection: redis,
 * });
 */
export function createQueueOptions(overrides: Partial<JobsOptions> = {}): Partial<QueueOptions> {
  return {
    defaultJobOptions: {
      ...DEFAULT_JOB_OPTIONS,
      ...overrides,
    },
  };
}

/**
 * Worker concurrency defaults per service type.
 * Use as reference when configuring Worker instances.
 *
 * Rationale:
 * - CPU-bound tasks (video, AI): low concurrency to avoid starving the event loop
 * - IO-bound tasks (email, notifications): higher concurrency since they mostly wait on network
 */
export const WORKER_CONCURRENCY = {
  /** For CPU-intensive jobs (video rendering, AI inference) */
  cpuBound: 2,
  /** For IO-bound jobs (email, webhooks, notifications) */
  ioBound: 10,
  /** Default if unsure */
  default: 5,
} as const;
