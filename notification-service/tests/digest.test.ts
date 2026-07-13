/**
 * Unit Tests: NotificationDigest
 *
 * Validates Req 6.4: Batch digest — group multiple notifications of same type
 * into one summary (e.g., 5 price drops → 1 summary notification).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  NotificationDigest,
  createDigest,
  buildDigestKey,
} from '../src/digest.js';
import type { NotificationPayload, NotificationType } from '../src/types.js';

// ─── Helpers ───

function createPayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    userId: 'user-001',
    type: 'price_drop',
    title: 'Giảm giá iPhone 15',
    body: 'iPhone 15 giảm 2 triệu — chỉ còn 22.990.000đ',
    ...overrides,
  };
}

// ─── Tests ───

describe('NotificationDigest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('buildDigestKey', () => {
    it('should build key from userId and type', () => {
      expect(buildDigestKey('user-001', 'price_drop')).toBe('user-001:price_drop');
    });

    it('should handle special characters in userId', () => {
      expect(buildDigestKey('user:special', 'flash_sale')).toBe('user:special:flash_sale');
    });
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      expect(digest.pendingCount).toBe(0);
      expect(digest.disposed).toBe(false);
      digest.dispose();
    });

    it('should throw if onDigest is not provided', () => {
      expect(() => new NotificationDigest({} as any)).toThrow('onDigest callback is required');
    });

    it('should throw if windowMs is zero or negative', () => {
      expect(() => new NotificationDigest({ windowMs: 0, onDigest: vi.fn() })).toThrow(
        'windowMs must be a positive number',
      );
      expect(() => new NotificationDigest({ windowMs: -1000, onDigest: vi.fn() })).toThrow(
        'windowMs must be a positive number',
      );
    });

    it('should throw if maxBufferSize is zero or negative', () => {
      expect(() => new NotificationDigest({ maxBufferSize: 0, onDigest: vi.fn() })).toThrow(
        'maxBufferSize must be a positive number',
      );
    });
  });

  describe('add()', () => {
    it('should buffer a notification and return the key', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      const key = digest.add(createPayload());

      expect(key).toBe('user-001:price_drop');
      expect(digest.pendingCount).toBe(1);
      expect(digest.getBufferSize(key)).toBe(1);
      digest.dispose();
    });

    it('should buffer multiple notifications for the same key', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      const key = digest.add(createPayload());
      digest.add(createPayload({ body: 'Samsung S24 giảm 3 triệu' }));
      digest.add(createPayload({ body: 'Xiaomi 14 giảm 1.5 triệu' }));

      expect(digest.getBufferSize(key)).toBe(3);
      expect(digest.pendingCount).toBe(1); // same key → one buffer entry
      digest.dispose();
    });

    it('should create separate buffers for different users', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      digest.add(createPayload({ userId: 'user-001' }));
      digest.add(createPayload({ userId: 'user-002' }));

      expect(digest.pendingCount).toBe(2);
      expect(digest.getBufferSize('user-001:price_drop')).toBe(1);
      expect(digest.getBufferSize('user-002:price_drop')).toBe(1);
      digest.dispose();
    });

    it('should create separate buffers for different notification types', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      digest.add(createPayload({ type: 'price_drop' }));
      digest.add(createPayload({ type: 'flash_sale' }));

      expect(digest.pendingCount).toBe(2);
      expect(digest.getBufferSize('user-001:price_drop')).toBe(1);
      expect(digest.getBufferSize('user-001:flash_sale')).toBe(1);
      digest.dispose();
    });

    it('should throw if digest has been disposed', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      digest.dispose();

      expect(() => digest.add(createPayload())).toThrow('has been disposed');
    });
  });

  describe('timer-based flush (window expiry)', () => {
    it('should invoke onDigest after windowMs expires', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 5000, onDigest });

      digest.add(createPayload());
      expect(onDigest).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(onDigest).toHaveBeenCalledTimes(1);
      expect(onDigest).toHaveBeenCalledWith(
        'user-001',
        'price_drop',
        [expect.objectContaining({ userId: 'user-001', type: 'price_drop' })],
      );
      digest.dispose();
    });

    it('should pass all buffered notifications to onDigest callback', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 10000, onDigest });

      digest.add(createPayload({ body: 'Notification 1' }));
      vi.advanceTimersByTime(3000);
      digest.add(createPayload({ body: 'Notification 2' }));
      vi.advanceTimersByTime(3000);
      digest.add(createPayload({ body: 'Notification 3' }));

      // Timer started at first add, so should fire at 10000ms from first add
      vi.advanceTimersByTime(4000); // total: 10000ms

      expect(onDigest).toHaveBeenCalledTimes(1);
      const notifications = onDigest.mock.calls[0][2];
      expect(notifications).toHaveLength(3);
      expect(notifications[0].body).toBe('Notification 1');
      expect(notifications[1].body).toBe('Notification 2');
      expect(notifications[2].body).toBe('Notification 3');
      digest.dispose();
    });

    it('should clear buffer entry after flush', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 1000, onDigest });

      const key = digest.add(createPayload());
      expect(digest.pendingCount).toBe(1);

      vi.advanceTimersByTime(1000);

      expect(digest.pendingCount).toBe(0);
      expect(digest.getBufferSize(key)).toBe(0);
      digest.dispose();
    });

    it('should handle multiple independent timers for different keys', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 5000, onDigest });

      digest.add(createPayload({ userId: 'user-A', type: 'price_drop' }));
      vi.advanceTimersByTime(2000);
      digest.add(createPayload({ userId: 'user-B', type: 'flash_sale' }));

      // user-A timer fires at 5000ms
      vi.advanceTimersByTime(3000);
      expect(onDigest).toHaveBeenCalledTimes(1);
      expect(onDigest).toHaveBeenCalledWith('user-A', 'price_drop', expect.any(Array));

      // user-B timer fires at 7000ms
      vi.advanceTimersByTime(2000);
      expect(onDigest).toHaveBeenCalledTimes(2);
      expect(onDigest).toHaveBeenCalledWith('user-B', 'flash_sale', expect.any(Array));
      digest.dispose();
    });

    it('should use default 5-minute window when windowMs not specified', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ onDigest });

      digest.add(createPayload());

      vi.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
      expect(onDigest).not.toHaveBeenCalled();

      vi.advanceTimersByTime(1 * 60 * 1000); // 5 minutes total
      expect(onDigest).toHaveBeenCalledTimes(1);
      digest.dispose();
    });
  });

  describe('maxBufferSize — force flush', () => {
    it('should force flush when buffer reaches maxBufferSize', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({
        windowMs: 60000,
        maxBufferSize: 3,
        onDigest,
      });

      digest.add(createPayload({ body: 'N1' }));
      digest.add(createPayload({ body: 'N2' }));
      expect(onDigest).not.toHaveBeenCalled();

      digest.add(createPayload({ body: 'N3' })); // hits maxBufferSize=3
      expect(onDigest).toHaveBeenCalledTimes(1);

      const notifications = onDigest.mock.calls[0][2];
      expect(notifications).toHaveLength(3);
      digest.dispose();
    });

    it('should allow new buffer after force flush', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({
        windowMs: 60000,
        maxBufferSize: 2,
        onDigest,
      });

      digest.add(createPayload({ body: 'Batch 1 - N1' }));
      digest.add(createPayload({ body: 'Batch 1 - N2' })); // force flush
      expect(onDigest).toHaveBeenCalledTimes(1);

      // Start a new buffer for same key
      digest.add(createPayload({ body: 'Batch 2 - N1' }));
      expect(digest.getBufferSize('user-001:price_drop')).toBe(1);

      vi.advanceTimersByTime(60000);
      expect(onDigest).toHaveBeenCalledTimes(2);
      expect(onDigest.mock.calls[1][2]).toHaveLength(1);
      expect(onDigest.mock.calls[1][2][0].body).toBe('Batch 2 - N1');
      digest.dispose();
    });
  });

  describe('flush()', () => {
    it('should manually flush a specific key', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      const key = digest.add(createPayload());
      digest.add(createPayload({ body: 'Second one' }));

      const flushed = digest.flush(key);
      expect(flushed).toBe(true);
      expect(onDigest).toHaveBeenCalledTimes(1);
      expect(onDigest.mock.calls[0][2]).toHaveLength(2);
      expect(digest.pendingCount).toBe(0);
      digest.dispose();
    });

    it('should return false for non-existent key', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      const flushed = digest.flush('nonexistent:key');
      expect(flushed).toBe(false);
      expect(onDigest).not.toHaveBeenCalled();
      digest.dispose();
    });

    it('should cancel the timer when manually flushed', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 5000, onDigest });

      const key = digest.add(createPayload());
      digest.flush(key);

      // Advance past original timer — should NOT fire again
      vi.advanceTimersByTime(5000);
      expect(onDigest).toHaveBeenCalledTimes(1); // only the manual flush
      digest.dispose();
    });
  });

  describe('flushAll()', () => {
    it('should flush all active buffers', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      digest.add(createPayload({ userId: 'user-A', type: 'price_drop' }));
      digest.add(createPayload({ userId: 'user-B', type: 'flash_sale' }));
      digest.add(createPayload({ userId: 'user-C', type: 'back_in_stock' }));

      digest.flushAll();

      expect(onDigest).toHaveBeenCalledTimes(3);
      expect(digest.pendingCount).toBe(0);
      digest.dispose();
    });

    it('should be safe to call when no buffers exist', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      digest.flushAll();
      expect(onDigest).not.toHaveBeenCalled();
      digest.dispose();
    });
  });

  describe('getActiveKeys()', () => {
    it('should return all active buffer keys', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });

      digest.add(createPayload({ userId: 'user-1', type: 'price_drop' }));
      digest.add(createPayload({ userId: 'user-2', type: 'flash_sale' }));

      const keys = digest.getActiveKeys();
      expect(keys).toContain('user-1:price_drop');
      expect(keys).toContain('user-2:flash_sale');
      expect(keys).toHaveLength(2);
      digest.dispose();
    });

    it('should return empty array when no buffers active', () => {
      const digest = new NotificationDigest({ onDigest: vi.fn() });
      expect(digest.getActiveKeys()).toEqual([]);
      digest.dispose();
    });
  });

  describe('dispose()', () => {
    it('should flush all pending buffers on dispose', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      digest.add(createPayload({ userId: 'user-A' }));
      digest.add(createPayload({ userId: 'user-B', type: 'flash_sale' }));

      digest.dispose();

      expect(onDigest).toHaveBeenCalledTimes(2);
      expect(digest.disposed).toBe(true);
    });

    it('should be idempotent — calling dispose twice does not double-flush', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 60000, onDigest });

      digest.add(createPayload());
      digest.dispose();
      digest.dispose(); // second call

      expect(onDigest).toHaveBeenCalledTimes(1);
    });
  });

  describe('error handling in onDigest callback', () => {
    it('should not throw if sync callback throws', () => {
      const onDigest = vi.fn().mockImplementation(() => {
        throw new Error('Callback error');
      });
      const digest = new NotificationDigest({ windowMs: 1000, onDigest });

      digest.add(createPayload());

      // Should not throw
      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(onDigest).toHaveBeenCalledTimes(1);
      digest.dispose();
    });

    it('should not throw if async callback rejects', () => {
      const onDigest = vi.fn().mockRejectedValue(new Error('Async error'));
      const digest = new NotificationDigest({ windowMs: 1000, onDigest });

      digest.add(createPayload());

      expect(() => vi.advanceTimersByTime(1000)).not.toThrow();
      expect(onDigest).toHaveBeenCalledTimes(1);
      digest.dispose();
    });
  });

  describe('createDigest() factory', () => {
    it('should create a NotificationDigest instance', () => {
      const digest = createDigest({ onDigest: vi.fn() });
      expect(digest).toBeInstanceOf(NotificationDigest);
      digest.dispose();
    });

    it('should pass config through correctly', () => {
      const onDigest = vi.fn();
      const digest = createDigest({ windowMs: 3000, onDigest });

      digest.add(createPayload());
      vi.advanceTimersByTime(3000);

      expect(onDigest).toHaveBeenCalledTimes(1);
      digest.dispose();
    });
  });

  describe('real-world scenario:  5 price drops → 1 summary', () => {
    it('should batch 5 price_drop notifications for the same user', () => {
      const onDigest = vi.fn();
      const digest = new NotificationDigest({ windowMs: 15 * 60 * 1000, onDigest });

      // Simulate 5 price drop notifications arriving over time
      digest.add(createPayload({ body: 'iPhone 15 giảm 2tr' }));
      vi.advanceTimersByTime(60000); // 1 min later
      digest.add(createPayload({ body: 'Samsung S24 giảm 3tr' }));
      vi.advanceTimersByTime(120000); // 2 min later
      digest.add(createPayload({ body: 'Xiaomi 14 giảm 1.5tr' }));
      vi.advanceTimersByTime(180000); // 3 min later
      digest.add(createPayload({ body: 'MacBook Air M3 giảm 5tr' }));
      vi.advanceTimersByTime(60000); // 1 min later
      digest.add(createPayload({ body: 'AirPods Pro 2 giảm 800K' }));

      // Not yet — 7 min have passed out of 15 min window
      expect(onDigest).not.toHaveBeenCalled();

      // Advance remaining time
      vi.advanceTimersByTime(8 * 60 * 1000);

      expect(onDigest).toHaveBeenCalledTimes(1);
      const [userId, type, notifications] = onDigest.mock.calls[0];
      expect(userId).toBe('user-001');
      expect(type).toBe('price_drop');
      expect(notifications).toHaveLength(5);
      digest.dispose();
    });
  });
});
