/**
 * Unit tests for WebhookTracker — Req 7.5
 * Tests consecutive failure tracking, alerting threshold, and health status reporting.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookTracker } from './webhook-tracker';

describe('WebhookTracker', () => {
  let tracker: WebhookTracker;

  beforeEach(() => {
    tracker = new WebhookTracker({ alertThreshold: 3 });
  });

  describe('recordSuccess', () => {
    it('should reset failure count for a provider', () => {
      tracker.recordFailure('momo', 'error');
      tracker.recordFailure('momo', 'error');
      tracker.recordSuccess('momo');
      expect(tracker.getFailureCount('momo')).toBe(0);
    });

    it('should not affect other providers', () => {
      tracker.recordFailure('momo', 'error');
      tracker.recordFailure('stripe', 'error');
      tracker.recordSuccess('momo');
      expect(tracker.getFailureCount('momo')).toBe(0);
      expect(tracker.getFailureCount('stripe')).toBe(1);
    });
  });

  describe('recordFailure', () => {
    it('should increment consecutive failure count', () => {
      tracker.recordFailure('sepay', 'timeout');
      expect(tracker.getFailureCount('sepay')).toBe(1);
      tracker.recordFailure('sepay', 'timeout');
      expect(tracker.getFailureCount('sepay')).toBe(2);
      tracker.recordFailure('sepay', 'timeout');
      expect(tracker.getFailureCount('sepay')).toBe(3);
    });

    it('should start at 0 for unknown providers', () => {
      expect(tracker.getFailureCount('unknown')).toBe(0);
    });

    it('should log a warning when threshold is exceeded', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      // 3 failures = at threshold, no alert yet
      tracker.recordFailure('momo', 'bad signature');
      tracker.recordFailure('momo', 'bad signature');
      tracker.recordFailure('momo', 'bad signature');
      expect(warnSpy).not.toHaveBeenCalled();

      // 4th failure = exceeds threshold, alert emitted
      tracker.recordFailure('momo', 'bad signature');
      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Provider "momo" has 4 consecutive failures')
      );

      warnSpy.mockRestore();
    });

    it('should continue alerting on subsequent failures after threshold', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 6; i++) {
        tracker.recordFailure('zalopay', 'error');
      }

      // Alerts for failures 4, 5, 6 (3 alerts total)
      expect(warnSpy).toHaveBeenCalledTimes(3);

      warnSpy.mockRestore();
    });
  });

  describe('isProviderHealthy', () => {
    it('should return true when failures are within threshold', () => {
      expect(tracker.isProviderHealthy('momo')).toBe(true);
      tracker.recordFailure('momo', 'error');
      tracker.recordFailure('momo', 'error');
      tracker.recordFailure('momo', 'error');
      expect(tracker.isProviderHealthy('momo')).toBe(true); // at threshold, still healthy
    });

    it('should return false when failures exceed threshold', () => {
      for (let i = 0; i < 4; i++) {
        tracker.recordFailure('momo', 'error');
      }
      expect(tracker.isProviderHealthy('momo')).toBe(false);
    });

    it('should return true after success resets the counter', () => {
      for (let i = 0; i < 5; i++) {
        tracker.recordFailure('momo', 'error');
      }
      expect(tracker.isProviderHealthy('momo')).toBe(false);
      tracker.recordSuccess('momo');
      expect(tracker.isProviderHealthy('momo')).toBe(true);
    });
  });

  describe('getHealthStatus', () => {
    it('should return healthy status when no failures tracked', () => {
      const status = tracker.getHealthStatus();
      expect(status.overall).toBe('healthy');
      expect(Object.keys(status.providers)).toHaveLength(0);
      expect(status.checkedAt).toBeDefined();
    });

    it('should return healthy when all providers are within threshold', () => {
      tracker.recordSuccess('momo');
      tracker.recordSuccess('stripe');
      tracker.recordFailure('sepay', 'minor error');

      const status = tracker.getHealthStatus();
      expect(status.overall).toBe('healthy');
      expect(status.providers.momo.isHealthy).toBe(true);
      expect(status.providers.stripe.isHealthy).toBe(true);
      expect(status.providers.sepay.isHealthy).toBe(true);
    });

    it('should return degraded when some providers exceed threshold', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      tracker.recordSuccess('stripe');
      for (let i = 0; i < 5; i++) {
        tracker.recordFailure('momo', 'error');
      }

      const status = tracker.getHealthStatus();
      expect(status.overall).toBe('degraded');
      expect(status.providers.momo.isHealthy).toBe(false);
      expect(status.providers.momo.consecutiveFailures).toBe(5);
      expect(status.providers.stripe.isHealthy).toBe(true);

      vi.restoreAllMocks();
    });

    it('should return unhealthy when all providers exceed threshold', () => {
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      for (let i = 0; i < 5; i++) {
        tracker.recordFailure('momo', 'error');
        tracker.recordFailure('stripe', 'error');
      }

      const status = tracker.getHealthStatus();
      expect(status.overall).toBe('unhealthy');

      vi.restoreAllMocks();
    });

    it('should include lastError in provider health', () => {
      tracker.recordFailure('payos', 'Connection refused');
      const status = tracker.getHealthStatus();
      expect(status.providers.payos.lastError).toBe('Connection refused');
    });

    it('should include lastFailureAt and lastSuccessAt timestamps', () => {
      tracker.recordSuccess('momo');
      tracker.recordFailure('momo', 'error');

      const status = tracker.getHealthStatus();
      expect(status.providers.momo.lastSuccessAt).toBeInstanceOf(Date);
      expect(status.providers.momo.lastFailureAt).toBeInstanceOf(Date);
    });
  });

  describe('reset', () => {
    it('should clear all tracking state', () => {
      tracker.recordFailure('momo', 'error');
      tracker.recordFailure('stripe', 'error');
      tracker.recordSuccess('sepay');

      tracker.reset();

      expect(tracker.getFailureCount('momo')).toBe(0);
      expect(tracker.getFailureCount('stripe')).toBe(0);
      const status = tracker.getHealthStatus();
      expect(Object.keys(status.providers)).toHaveLength(0);
    });
  });

  describe('custom alertThreshold', () => {
    it('should respect custom threshold', () => {
      const customTracker = new WebhookTracker({ alertThreshold: 1 });
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      customTracker.recordFailure('momo', 'error'); // 1 = threshold, no alert
      expect(warnSpy).not.toHaveBeenCalled();

      customTracker.recordFailure('momo', 'error'); // 2 > threshold, alert
      expect(warnSpy).toHaveBeenCalledTimes(1);

      warnSpy.mockRestore();
    });
  });
});
