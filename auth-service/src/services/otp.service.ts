/**
 * OTP Service — Send/verify OTP via eSMS.vn
 * Uses Redis for OTP storage (5 min TTL)
 */
import axios from 'axios';
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const OTP_TTL = 300; // 5 minutes
const ESMS_API_KEY = process.env.ESMS_API_KEY || '';
const ESMS_SECRET_KEY = process.env.ESMS_SECRET_KEY || '';
const ESMS_BRAND_NAME = process.env.ESMS_BRAND_NAME || 'WinLux';

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export async function sendOTP(phone: string): Promise<void> {
  // Rate limit: max 3 OTPs per phone per hour
  const rateLimitKey = `otp:rate:${phone}`;
  const count = parseInt(await redis.get(rateLimitKey) || '0');
  if (count >= 3) throw new Error('Quá nhiều yêu cầu OTP. Vui lòng thử lại sau 1 giờ.');

  const otp = generateOTP();

  // Store OTP in Redis
  await redis.set(`otp:${phone}`, otp, 'EX', OTP_TTL);
  await redis.incr(rateLimitKey);
  await redis.expire(rateLimitKey, 3600);

  // Send via eSMS.vn
  if (ESMS_API_KEY) {
    const message = `Ma xac thuc ${ESMS_BRAND_NAME}: ${otp}. Het han sau 5 phut.`;
    await axios.post('http://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post_json/', {
      ApiKey: ESMS_API_KEY,
      Content: message,
      Phone: phone,
      SecretKey: ESMS_SECRET_KEY,
      SmsType: '2', // Brandname SMS
      Brandname: ESMS_BRAND_NAME,
    }).catch((err) => {
      console.error('[OTP] eSMS send failed:', err.message);
    });
  } else {
    // Dev mode: log OTP to console
    console.log(`[OTP] DEV MODE — Phone: ${phone}, OTP: ${otp}`);
  }
}

export async function verifyOTP(phone: string, otp: string): Promise<boolean> {
  const stored = await redis.get(`otp:${phone}`);
  if (!stored || stored !== otp) return false;

  // Delete OTP after successful verification
  await redis.del(`otp:${phone}`);
  return true;
}
