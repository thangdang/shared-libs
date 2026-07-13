/**
 * Integration Test: Notification Channel Fallback Chain
 *
 * Validates Req 5.3: Channel fallback — if FCM fails → try Zalo OA → try SMS
 * (configurable per notification type).
 *
 * This test verifies:
 * 1. When FCM fails → should try Zalo OA next (for types with zalo in chain)
 * 2. When FCM + Zalo OA both fail → should try SMS (for emergency type)
 * 3. When all channels succeed → should use the first configured channel only
 * 4. Respects priority ordering from FALLBACK_CHAINS config
 * 5. Returns results for each attempted channel
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock all providers ───

const mockFCMSend = vi.fn();
const mockZaloSend = vi.fn();
const mockSMSSend = vi.fn();
const mockEmailSend = vi.fn();

vi.mock('../../src/providers/fcm.js', () => ({
  FCMProvider: vi.fn().mockImplementation(() => ({
    send: mockFCMSend,
  })),
}));

vi.mock('../../src/providers/zalo-oa.js', () => ({
  ZaloOAProvider: vi.fn().mockImplementation(() => ({
    send: mockZaloSend,
  })),
}));

vi.mock('../../src/providers/sms.js', () => ({
  SMSProvider: vi.fn().mockImplementation(() => ({
    send: mockSMSSend,
  })),
}));

vi.mock('../../src/providers/email.js', () => ({
  EmailProvider: vi.fn().mockImplementation(() => ({
    send: mockEmailSend,
  })),
}));

// ─── Mock Redis-dependent services (dedup + rate limiter) ───

vi.mock('../../src/dedup.js', () => ({
  DedupService: vi.fn().mockImplementation(() => ({
    check: vi.fn(async () => false), // Never deduplicated
    mark: vi.fn(async () => {}),
  })),
}));

vi.mock('../../src/rate-limiter.js', () => ({
  RateLimiter: vi.fn().mockImplementation(() => ({
    isLimited: vi.fn(async () => false), // Never rate-limited
    record: vi.fn(async () => {}),
  })),
}));

vi.mock('../../src/deep-link.js', () => ({
  DeepLinkBuilder: vi.fn().mockImplementation(() => ({
    build: vi.fn((path: string) => `https://app.winlux.com${path}`),
  })),
}));

// ─── Import after mocks ───
import { NotificationClient, FALLBACK_CHAINS } from '../../src/client.js';
import type { NotificationPayload } from '../../src/types.js';

// ─── Helper: create client with all providers configured ───
function createClient() {
  return new NotificationClient({
    product: 'smartbuy',
    redisUrl: 'redis://localhost:6379',
    fcmServiceAccount: { project_id: 'test' },
    zaloOAToken: 'test-zalo-token',
    sms: { apiKey: 'test-sms-key', secretKey: 'test-sms-secret', brandname: 'WinLux' },
    email: { apiKey: 'test-resend-key', from: 'WinLux <no-reply@winlux.com>' },
    maxPerDay: 100,
  });
}

// ─── Helper: create base notification payload ───
function createPayload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
  return {
    userId: 'user-123',
    type: 'price_drop',
    title: 'Giảm giá iPhone 15',
    body: 'iPhone 15 giảm 2 triệu — chỉ còn 22.990.000đ',
    ...overrides,
  };
}

// ─── Tests ───

describe('Integration: Notification channel fallback chain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Fallback chain configuration', () => {
    it('should have correct fallback chain for price_drop: [fcm, zalo]', () => {
      expect(FALLBACK_CHAINS['price_drop']).toEqual(['fcm', 'zalo']);
    });

    it('should have correct fallback chain for medication_reminder: [fcm, sms]', () => {
      expect(FALLBACK_CHAINS['medication_reminder']).toEqual(['fcm', 'sms']);
    });

    it('should have correct fallback chain for tax_deadline: [fcm, email]', () => {
      expect(FALLBACK_CHAINS['tax_deadline']).toEqual(['fcm', 'email']);
    });

    it('should have correct fallback chain for payment_receipt: [email, fcm]', () => {
      expect(FALLBACK_CHAINS['payment_receipt']).toEqual(['email', 'fcm']);
    });

    it('should have correct fallback chain for emergency: [fcm, sms, zalo]', () => {
      expect(FALLBACK_CHAINS['emergency']).toEqual(['fcm', 'sms', 'zalo']);
    });
  });

  describe('FCM succeeds — no fallback needed', () => {
    it('should only call FCM when it succeeds (price_drop)', async () => {
      mockFCMSend.mockResolvedValue({ success: true, channel: 'fcm', messageId: 'fcm-123' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'price_drop' }));

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ success: true, channel: 'fcm' });
      expect(mockFCMSend).toHaveBeenCalledTimes(1);
      expect(mockZaloSend).not.toHaveBeenCalled();
      expect(mockSMSSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });

    it('should only call FCM when it succeeds (emergency)', async () => {
      mockFCMSend.mockResolvedValue({ success: true, channel: 'fcm', messageId: 'fcm-456' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'emergency' }));

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ success: true, channel: 'fcm' });
      expect(mockFCMSend).toHaveBeenCalledTimes(1);
      expect(mockSMSSend).not.toHaveBeenCalled();
      expect(mockZaloSend).not.toHaveBeenCalled();
    });
  });

  describe('FCM fails → fallback to Zalo OA (price_drop chain)', () => {
    it('should try Zalo OA when FCM fails', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'Device not registered' });
      mockZaloSend.mockResolvedValue({ success: true, channel: 'zalo', messageId: 'zalo-789' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'price_drop' }));

      // Should have tried FCM first (failed), then Zalo (succeeded)
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: true, channel: 'zalo' });
      expect(mockFCMSend).toHaveBeenCalledTimes(1);
      expect(mockZaloSend).toHaveBeenCalledTimes(1);
      expect(mockSMSSend).not.toHaveBeenCalled();
    });

    it('should not try SMS for price_drop even when both FCM and Zalo fail', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'FCM unavailable' });
      mockZaloSend.mockResolvedValue({ success: false, channel: 'zalo', error: 'Zalo API error' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'price_drop' }));

      // price_drop chain is ['fcm', 'zalo'] — no SMS fallback
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: false, channel: 'zalo' });
      expect(mockSMSSend).not.toHaveBeenCalled();
      expect(mockEmailSend).not.toHaveBeenCalled();
    });
  });

  describe('FCM fails → fallback to SMS (medication_reminder chain)', () => {
    it('should try SMS when FCM fails for health-critical notifications', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'Token expired' });
      mockSMSSend.mockResolvedValue({ success: true, channel: 'sms', messageId: 'sms-001' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'medication_reminder',
        title: 'Uống thuốc',
        body: 'Đã đến giờ uống thuốc huyết áp',
      }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: true, channel: 'sms' });
      expect(mockFCMSend).toHaveBeenCalledTimes(1);
      expect(mockSMSSend).toHaveBeenCalledTimes(1);
      expect(mockZaloSend).not.toHaveBeenCalled();
    });
  });

  describe('FCM fails → fallback to Email (tax_deadline chain)', () => {
    it('should try email when FCM fails for important tax notifications', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'Push disabled' });
      mockEmailSend.mockResolvedValue({ success: true, channel: 'email', messageId: 'email-001' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'tax_deadline',
        title: 'Hạn nộp thuế TNCN',
        body: 'Còn 5 ngày nữa hết hạn nộp thuế thu nhập cá nhân',
      }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: true, channel: 'email' });
      expect(mockFCMSend).toHaveBeenCalledTimes(1);
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockZaloSend).not.toHaveBeenCalled();
      expect(mockSMSSend).not.toHaveBeenCalled();
    });
  });

  describe('Full fallback chain: FCM → SMS → Zalo (emergency)', () => {
    it('should try all channels in order until one succeeds', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'Network error' });
      mockSMSSend.mockResolvedValue({ success: false, channel: 'sms', error: 'eSMS timeout' });
      mockZaloSend.mockResolvedValue({ success: true, channel: 'zalo', messageId: 'zalo-emergency' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'emergency',
        title: 'Cảnh báo khẩn cấp',
        body: 'Phát hiện bất thường nghiêm trọng',
        priority: 'critical',
      }));

      // emergency chain: ['fcm', 'sms', 'zalo']
      expect(results).toHaveLength(3);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: false, channel: 'sms' });
      expect(results[2]).toMatchObject({ success: true, channel: 'zalo' });
    });

    it('should return all failures when entire chain fails', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'FCM down' });
      mockSMSSend.mockResolvedValue({ success: false, channel: 'sms', error: 'eSMS down' });
      mockZaloSend.mockResolvedValue({ success: false, channel: 'zalo', error: 'Zalo OA down' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'emergency', priority: 'critical' }));

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success === false)).toBe(true);
      expect(results.map(r => r.channel)).toEqual(['fcm', 'sms', 'zalo']);
    });

    it('should stop at SMS when SMS succeeds (not try Zalo)', async () => {
      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'FCM error' });
      mockSMSSend.mockResolvedValue({ success: true, channel: 'sms', messageId: 'sms-emergency' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'emergency', priority: 'critical' }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: true, channel: 'sms' });
      expect(mockZaloSend).not.toHaveBeenCalled();
    });
  });

  describe('Email-primary chain (payment_receipt: [email, fcm])', () => {
    it('should use email as primary channel for receipts', async () => {
      mockEmailSend.mockResolvedValue({ success: true, channel: 'email', messageId: 'email-receipt' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'payment_receipt',
        title: 'Biên lai thanh toán',
        body: 'Đơn hàng #12345 đã thanh toán thành công',
      }));

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ success: true, channel: 'email' });
      expect(mockEmailSend).toHaveBeenCalledTimes(1);
      expect(mockFCMSend).not.toHaveBeenCalled();
    });

    it('should fall back to FCM when email fails for receipts', async () => {
      mockEmailSend.mockResolvedValue({ success: false, channel: 'email', error: 'Resend API error' });
      mockFCMSend.mockResolvedValue({ success: true, channel: 'fcm', messageId: 'fcm-receipt' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'payment_receipt' }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'email' });
      expect(results[1]).toMatchObject({ success: true, channel: 'fcm' });
    });
  });

  describe('Explicit channel override bypasses fallback chain', () => {
    it('should use only specified channels when payload.channels is set', async () => {
      mockSMSSend.mockResolvedValue({ success: true, channel: 'sms', messageId: 'sms-override' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'price_drop',
        channels: ['sms'], // Override: send via SMS only, ignore default [fcm, zalo] chain
      }));

      expect(results).toHaveLength(1);
      expect(results[0]).toMatchObject({ success: true, channel: 'sms' });
      expect(mockFCMSend).not.toHaveBeenCalled();
      expect(mockZaloSend).not.toHaveBeenCalled();
    });

    it('should respect explicit channel order for fallback', async () => {
      mockZaloSend.mockResolvedValue({ success: false, channel: 'zalo', error: 'Zalo error' });
      mockEmailSend.mockResolvedValue({ success: true, channel: 'email', messageId: 'email-custom' });

      const client = createClient();
      const results = await client.send(createPayload({
        type: 'price_drop',
        channels: ['zalo', 'email'], // Custom override
      }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'zalo' });
      expect(results[1]).toMatchObject({ success: true, channel: 'email' });
    });
  });

  describe('Provider throws exception — treated as failure, continues fallback', () => {
    it('should catch FCM exception and continue to next channel', async () => {
      mockFCMSend.mockRejectedValue(new Error('Firebase connection timeout'));
      mockZaloSend.mockResolvedValue({ success: true, channel: 'zalo', messageId: 'zalo-catch' });

      const client = createClient();
      const results = await client.send(createPayload({ type: 'price_drop' }));

      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({
        success: false,
        channel: 'fcm',
        error: 'Firebase connection timeout',
      });
      expect(results[1]).toMatchObject({ success: true, channel: 'zalo' });
    });

    it('should catch all provider exceptions and return all failures', async () => {
      mockFCMSend.mockRejectedValue(new Error('FCM timeout'));
      mockSMSSend.mockRejectedValue(new Error('eSMS network error'));
      mockZaloSend.mockRejectedValue(new Error('Zalo fetch failed'));

      const client = createClient();
      const results = await client.send(createPayload({ type: 'emergency', priority: 'critical' }));

      expect(results).toHaveLength(3);
      expect(results.every(r => r.success === false)).toBe(true);
      expect(results[0].error).toBe('FCM timeout');
      expect(results[1].error).toBe('eSMS network error');
      expect(results[2].error).toBe('Zalo fetch failed');
    });
  });

  describe('Provider not configured — treated as failure, continues fallback', () => {
    it('should fail gracefully when Zalo is not configured and fall through', async () => {
      // Client without Zalo token
      const clientNoZalo = new NotificationClient({
        product: 'smartbuy',
        redisUrl: 'redis://localhost:6379',
        fcmServiceAccount: { project_id: 'test' },
        sms: { apiKey: 'test', secretKey: 'test', brandname: 'WinLux' },
        // No zaloOAToken
        // No email
      });

      mockFCMSend.mockResolvedValue({ success: false, channel: 'fcm', error: 'FCM error' });

      const results = await clientNoZalo.send(createPayload({ type: 'price_drop' }));

      // price_drop chain: ['fcm', 'zalo'] — Zalo not configured so returns error result
      expect(results).toHaveLength(2);
      expect(results[0]).toMatchObject({ success: false, channel: 'fcm' });
      expect(results[1]).toMatchObject({ success: false, channel: 'zalo', error: expect.stringContaining('not configured') });
    });
  });
});
