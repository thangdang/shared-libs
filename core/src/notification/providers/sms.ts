/**
 * SMS Provider — eSMS.vn API wrapper.
 * Extracted from auth-service/otp.service.ts for shared reuse across all products.
 *
 * Supports:
 * - SmsType=2: Brandname SMS (requires registered brand, for marketing/notifications)
 * - SmsType=8: Standard OTP/authentication SMS
 *
 * Env vars:
 * - ESMS_API_KEY: eSMS.vn API key
 * - ESMS_SECRET_KEY: eSMS.vn secret key
 * - ESMS_BRANDNAME: Registered brand name (e.g., "WinLux")
 */

import type { NotificationResult } from '../types.js';

/** SMS type for eSMS.vn API */
export type ESMSType = 2 | 8;

/** Options for sending an SMS */
export interface SMSSendOptions {
  /**
   * SMS type:
   * - 2: Brandname SMS (requires registered brand, for marketing/notifications)
   * - 8: Standard SMS (for OTP/authentication, no brand required)
   * Default: 2
   */
  smsType?: ESMSType;
  /** Override brand name for this specific message */
  brandname?: string;
}

/** Raw response from eSMS.vn API */
interface ESMSResponse {
  CodeResult: string;
  CountRegen498: number;
  SMSID: string;
  ErrorMessage: string;
}

const ESMS_API_URL = 'https://rest.esms.vn/MainService.svc/json/SendMultipleMessage_V4_post';

export class SMSProvider {
  private readonly apiKey: string;
  private readonly secretKey: string;
  private readonly brandname: string;

  constructor(config?: { apiKey?: string; secretKey?: string; brandname?: string }) {
    this.apiKey = config?.apiKey || process.env.ESMS_API_KEY || '';
    this.secretKey = config?.secretKey || process.env.ESMS_SECRET_KEY || '';
    this.brandname = config?.brandname || process.env.ESMS_BRANDNAME || 'WinLux';
  }

  /**
   * Send SMS to a phone number via eSMS.vn.
   *
   * @param phone - Phone number (VN format: "84xxxxxxxxx" or "0xxxxxxxxx")
   * @param message - Message content (ASCII recommended for OTP, Unicode for marketing)
   * @param options - Optional SMS type and brand override
   */
  async send(phone: string, message: string, options?: SMSSendOptions): Promise<NotificationResult> {
    if (!this.apiKey || !this.secretKey) {
      return { success: false, channel: 'sms', error: 'eSMS credentials not configured' };
    }

    if (!phone || !message) {
      return { success: false, channel: 'sms', error: 'Phone and message are required' };
    }

    const smsType = options?.smsType ?? 2;
    const brandname = options?.brandname ?? this.brandname;

    const payload: Record<string, string> = {
      ApiKey: this.apiKey,
      Content: message,
      Phone: phone,
      SecretKey: this.secretKey,
      SmsType: String(smsType),
    };

    // Brandname is required for SmsType=2 (brandname SMS)
    if (smsType === 2) {
      payload.Brandname = brandname;
    }

    try {
      const response = await fetch(ESMS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        return {
          success: false,
          channel: 'sms',
          error: `eSMS HTTP error: ${response.status} ${response.statusText}`,
        };
      }

      const data: ESMSResponse = await response.json();

      // CodeResult "100" = success
      if (data.CodeResult === '100') {
        return { success: true, channel: 'sms', messageId: data.SMSID };
      }

      return {
        success: false,
        channel: 'sms',
        error: `eSMS error [${data.CodeResult}]: ${data.ErrorMessage || 'Unknown error'}`,
      };
    } catch (err: any) {
      return { success: false, channel: 'sms', error: err.message };
    }
  }

  /**
   * Send OTP/authentication SMS (SmsType=8 — standard, no brand required).
   * Convenience method for auth flows.
   */
  async sendOTP(phone: string, message: string): Promise<NotificationResult> {
    return this.send(phone, message, { smsType: 8 });
  }

  /**
   * Send branded notification SMS (SmsType=2 — requires registered brand).
   * Convenience method for marketing/notification flows.
   */
  async sendBrandname(phone: string, message: string, brandname?: string): Promise<NotificationResult> {
    return this.send(phone, message, { smsType: 2, brandname });
  }
}
