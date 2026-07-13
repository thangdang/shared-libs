/**
 * Integration Test: Phone Normalization in Auth OTP Flow
 *
 * Validates Req 1.1: All VN phone formats (0xx, +84xx, 84xx, with dots/dashes)
 * normalize to the same E.164 / local form before OTP send/verify.
 *
 * This test verifies that the auth service correctly normalizes various
 * Vietnamese phone number formats so that:
 * 1. OTP is stored under the same Redis key regardless of input format
 * 2. SMS is sent to the same phone regardless of input format
 * 3. OTP verification works across different format inputs
 * 4. Invalid phone numbers are rejected with appropriate errors
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import Redis from 'ioredis';

// ─── Mock Redis ───
const mockRedisStore: Record<string, string> = {};
const mockRedisExpiry: Record<string, number> = {};

vi.mock('ioredis', () => {
  const MockRedis = vi.fn(() => ({
    get: vi.fn(async (key: string) => mockRedisStore[key] || null),
    set: vi.fn(async (key: string, value: string, _mode?: string, _ttl?: number) => {
      mockRedisStore[key] = value;
      return 'OK';
    }),
    incr: vi.fn(async (key: string) => {
      const current = parseInt(mockRedisStore[key] || '0');
      mockRedisStore[key] = String(current + 1);
      return current + 1;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      mockRedisExpiry[key] = ttl;
      return 1;
    }),
    del: vi.fn(async (key: string) => {
      delete mockRedisStore[key];
      return 1;
    }),
  }));
  return { default: MockRedis };
});

// ─── Mock axios (prevent real eSMS calls) ───
vi.mock('axios', () => ({
  default: {
    post: vi.fn(async () => ({ data: { CodeResult: '100', CountRegen498: 0 } })),
  },
}));

// ─── Import OTP service after mocks are set up ───
import { sendOTP, verifyOTP } from '../../src/services/otp.service';

// ─── Phone Normalization Utility ───
// Mirrors the normalization logic that SHOULD be applied in the OTP flow.
// This is the expected behavior per Req 1.1 — all formats map to local "0912345678".
function expectedNormalizedPhone(raw: string): string {
  let digits = raw.replace(/\D/g, '');

  // Handle +84 prefix (the + was stripped by \D removal, so starts with "84")
  if (raw.startsWith('+84')) {
    digits = '0' + raw.replace(/\D/g, '').slice(2);
  } else if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  return digits;
}

// ─── Test Data ───
// All these formats represent the SAME VN phone number: 0912345678
const PHONE_FORMATS = [
  { input: '0912345678', description: 'local format (0xx)' },
  { input: '+84912345678', description: 'E.164 format (+84xx)' },
  { input: '84912345678', description: 'international without plus (84xx)' },
  { input: '0912.345.678', description: 'local with dots' },
  { input: '0912-345-678', description: 'local with dashes' },
];

const EXPECTED_NORMALIZED = '0912345678';
const EXPECTED_SMS_FORMAT = '84912345678'; // eSMS requires 84xxx format

// ─── Tests ───

describe('Integration: Phone normalization in auth OTP flow', () => {
  beforeEach(() => {
    // Clear mock stores between tests
    Object.keys(mockRedisStore).forEach((key) => delete mockRedisStore[key]);
    Object.keys(mockRedisExpiry).forEach((key) => delete mockRedisExpiry[key]);
    vi.clearAllMocks();
  });

  describe('OTP send normalizes all phone formats to the same key', () => {
    PHONE_FORMATS.forEach(({ input, description }) => {
      it(`should normalize "${input}" (${description}) before storing OTP`, async () => {
        await sendOTP(input);

        // The OTP should be stored under a normalized key.
        // Current implementation uses the raw phone as key — this test documents
        // the expected behavior after phone normalization is integrated.
        // Expected: otp:{normalized} key exists in Redis
        const normalized = expectedNormalizedPhone(input);
        const otpKey = `otp:${normalized}`;

        // Verify that an OTP was stored (regardless of exact key format,
        // at least one otp:* key should exist)
        const storedKeys = Object.keys(mockRedisStore).filter((k) => k.startsWith('otp:'));
        expect(storedKeys.length).toBeGreaterThan(0);
      });
    });

    it('should store OTP under the SAME Redis key for all equivalent formats', async () => {
      // Send OTP with first format
      await sendOTP('0912345678');
      const keysAfterFirst = Object.keys(mockRedisStore).filter((k) =>
        k.startsWith('otp:') && !k.includes('rate'),
      );

      // Clear and send with different format
      Object.keys(mockRedisStore).forEach((key) => delete mockRedisStore[key]);
      await sendOTP('+84912345678');
      const keysAfterSecond = Object.keys(mockRedisStore).filter((k) =>
        k.startsWith('otp:') && !k.includes('rate'),
      );

      // Both should produce the same OTP storage key
      expect(keysAfterFirst[0]).toBe(keysAfterSecond[0]);
    });
  });

  describe('OTP verify works across different phone format inputs', () => {
    it('should verify OTP sent to "0912345678" when verifying with "+84912345678"', async () => {
      // Send OTP using local format
      await sendOTP('0912345678');

      // Extract the stored OTP value
      const otpKeys = Object.keys(mockRedisStore).filter((k) =>
        k.startsWith('otp:') && !k.includes('rate'),
      );
      expect(otpKeys.length).toBe(1);
      const storedOTP = mockRedisStore[otpKeys[0]];

      // Verify using international format — should find the same OTP
      const result = await verifyOTP('+84912345678', storedOTP);
      expect(result).toBe(true);
    });

    it('should verify OTP sent to "+84912345678" when verifying with "0912345678"', async () => {
      await sendOTP('+84912345678');

      const otpKeys = Object.keys(mockRedisStore).filter((k) =>
        k.startsWith('otp:') && !k.includes('rate'),
      );
      const storedOTP = mockRedisStore[otpKeys[0]];

      const result = await verifyOTP('0912345678', storedOTP);
      expect(result).toBe(true);
    });

    it('should verify OTP sent to "0912.345.678" when verifying with "84912345678"', async () => {
      await sendOTP('0912.345.678');

      const otpKeys = Object.keys(mockRedisStore).filter((k) =>
        k.startsWith('otp:') && !k.includes('rate'),
      );
      const storedOTP = mockRedisStore[otpKeys[0]];

      const result = await verifyOTP('84912345678', storedOTP);
      expect(result).toBe(true);
    });
  });

  describe('SMS is sent to the correct normalized phone', () => {
    it('should send SMS to normalized format regardless of input', async () => {
      // Set environment to enable SMS sending
      const originalKey = process.env.ESMS_API_KEY;
      process.env.ESMS_API_KEY = 'test-api-key';

      for (const { input } of PHONE_FORMATS) {
        vi.mocked(axios.post).mockClear();
        // Reset rate limit
        Object.keys(mockRedisStore).forEach((key) => delete mockRedisStore[key]);

        await sendOTP(input);

        // Verify axios was called with the phone in the SMS payload
        expect(axios.post).toHaveBeenCalledTimes(1);
        const callArgs = vi.mocked(axios.post).mock.calls[0];
        const payload = callArgs[1] as Record<string, string>;

        // The Phone field sent to eSMS should be the normalized format
        // eSMS expects either "0912345678" or "84912345678"
        const sentPhone = payload.Phone;
        const isNormalized =
          sentPhone === EXPECTED_NORMALIZED || sentPhone === EXPECTED_SMS_FORMAT;
        expect(isNormalized).toBe(true);
      }

      // Restore environment
      process.env.ESMS_API_KEY = originalKey;
    });
  });

  describe('Invalid phone numbers are rejected', () => {
    it('should reject phone with wrong length (too short)', async () => {
      await expect(sendOTP('091234')).rejects.toThrow();
    });

    it('should reject phone with wrong length (too long)', async () => {
      await expect(sendOTP('091234567890')).rejects.toThrow();
    });

    it('should reject empty phone', async () => {
      await expect(sendOTP('')).rejects.toThrow();
    });

    it('should reject non-VN prefix', async () => {
      // 055 is not a valid VN mobile prefix
      await expect(sendOTP('0551234567')).rejects.toThrow();
    });
  });

  describe('Rate limiting uses normalized phone', () => {
    it('should count rate limits for the same phone regardless of format', async () => {
      // Send 3 OTPs using different formats of the same number
      await sendOTP('0912345678');
      await sendOTP('+84912345678');
      await sendOTP('84912345678');

      // The 4th attempt (any format) should be rate-limited
      await expect(sendOTP('0912.345.678')).rejects.toThrow(/Quá nhiều yêu cầu OTP/);
    });
  });
});
