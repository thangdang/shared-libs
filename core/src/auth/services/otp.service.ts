/**
 * OTP Service — Send/verify OTP via eSMS.vn
 * Uses Redis for OTP storage (5 min TTL)
 */
import axios from 'axios';
import type { AuthConfig } from '../types.js';

const OTP_TTL = 300; // 5 minutes
const RATE_LIMIT_WINDOW = 3600; // 1 hour
const RATE_LIMIT_MAX = 3; // max OTPs per phone per hour

export interface OTPServiceConfig {
  redisUrl?: string;
  sms?: {
    apiKey: string;
    secretKey: string;
    brandName?: string;
  };
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * OTP Service class for managing OTP send/verify with Redis.
 */
export class OTPService {
  private redis: any;
  private config: OTPServiceConfig;

  constructor(config: OTPServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize Redis connection (lazy).
   */
  private async getRedis() {
    if (!this.redis) {
      const Redis = (await import('ioredis')).default;
      this.redis = new Redis(this.config.redisUrl || 'redis://localhost:6379');
    }
    return this.redis;
  }

  /**
   * Send OTP to a phone number.
   */
  async send(phone: string): Promise<void> {
    const redis = await this.getRedis();

    // Rate limit check
    const rateLimitKey = `otp:rate:${phone}`;
    const count = parseInt((await redis.get(rateLimitKey)) || '0');
    if (count >= RATE_LIMIT_MAX) {
      throw new Error('Quá nhiều yêu cầu OTP. Vui lòng thử lại sau 1 giờ.');
    }

    const otp = generateOTP();

    // Store OTP in Redis
    await redis.set(`otp:${phone}`, otp, 'EX', OTP_TTL);
    await redis.incr(rateLimitKey);
    await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);

    // Send via eSMS.vn
    if (this.config.sms?.apiKey) {
      const brandName = this.config.sms.brandName || 'WinLux';
      const message = `Ma xac thuc ${brandName}: ${otp}. Het han sau 5 phut.`;

      await axios
        .post(
          'http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
          {
            ApiKey: this.config.sms.apiKey,
            Content: message,
            Phone: phone,
            SecretKey: this.config.sms.secretKey,
            SmsType: '2',
            Brandname: brandName,
          }
        )
        .catch((err) => {
          console.error('[OTP] eSMS send failed:', err.message);
        });
    } else {
      // Dev mode: log OTP to console
      console.log(`[OTP] DEV MODE — Phone: ${phone}, OTP: ${otp}`);
    }
  }

  /**
   * Verify an OTP code.
   */
  async verify(phone: string, otp: string): Promise<boolean> {
    const redis = await this.getRedis();
    const stored = await redis.get(`otp:${phone}`);

    if (!stored || stored !== otp) return false;

    // Delete OTP after successful verification
    await redis.del(`otp:${phone}`);
    return true;
  }

  /**
   * Close Redis connection.
   */
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
    }
  }
}

// ─── Functional API (stateless, requires Redis instance) ───

/**
 * Send OTP using a provided Redis instance.
 */
export async function sendOTP(
  phone: string,
  redis: any,
  config?: OTPServiceConfig['sms']
): Promise<void> {
  const rateLimitKey = `otp:rate:${phone}`;
  const count = parseInt((await redis.get(rateLimitKey)) || '0');
  if (count >= RATE_LIMIT_MAX) {
    throw new Error('Quá nhiều yêu cầu OTP. Vui lòng thử lại sau 1 giờ.');
  }

  const otp = generateOTP();

  await redis.set(`otp:${phone}`, otp, 'EX', OTP_TTL);
  await redis.incr(rateLimitKey);
  await redis.expire(rateLimitKey, RATE_LIMIT_WINDOW);

  if (config?.apiKey) {
    const brandName = config.brandName || 'WinLux';
    const message = `Ma xac thuc ${brandName}: ${otp}. Het han sau 5 phut.`;

    await axios
      .post(
        'http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/',
        {
          ApiKey: config.apiKey,
          Content: message,
          Phone: phone,
          SecretKey: config.secretKey,
          SmsType: '2',
          Brandname: brandName,
        }
      )
      .catch((err) => {
        console.error('[OTP] eSMS send failed:', err.message);
      });
  } else {
    console.log(`[OTP] DEV MODE — Phone: ${phone}, OTP: ${otp}`);
  }
}

/**
 * Verify OTP using a provided Redis instance.
 */
export async function verifyOTP(
  phone: string,
  otp: string,
  redis: any
): Promise<boolean> {
  const stored = await redis.get(`otp:${phone}`);
  if (!stored || stored !== otp) return false;

  await redis.del(`otp:${phone}`);
  return true;
}
