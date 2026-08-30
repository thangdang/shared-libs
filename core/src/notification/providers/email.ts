/**
 * Email Provider — Resend API wrapper.
 * Transactional email for receipts, reports, alerts across all WinLux products.
 *
 * Why Resend over SES:  Simpler API, better deliverability for VN,
 * no AWS account needed, free tier covers initial usage (3000 emails/month).
 *
 * Resend API:  POST https://api.resend.com/emails
 * Auth:  Bearer token via Authorization header
 *
 * Env vars:
 * - RESEND_API_KEY:  Resend API key
 * - RESEND_FROM_EMAIL:  Default sender (default: "WinLux <no-reply@winlux.com>")
 */

import type { NotificationResult } from '../types.js';

/** Payload for sending an email via Resend */
export interface EmailPayload {
  /** Recipient email address */
  to: string;
  /** Email subject line */
  subject: string;
  /** Pre-rendered HTML content */
  html: string;
  /** Sender address (default from env or "WinLux <no-reply@winlux.com>") */
  from?: string;
  /** Reply-to address */
  replyTo?: string;
}

/** Raw response from Resend API on success */
interface ResendSuccessResponse {
  id: string;
}

/** Raw response from Resend API on error */
interface ResendErrorResponse {
  statusCode: number;
  message: string;
  name: string;
}

const RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_FROM = 'WinLux <no-reply@winlux.com>';

export class EmailProvider {
  private readonly apiKey: string;
  private readonly defaultFrom: string;

  constructor(config?: { apiKey?: string; from?: string }) {
    this.apiKey = config?.apiKey || process.env.RESEND_API_KEY || '';
    this.defaultFrom = config?.from || process.env.RESEND_FROM_EMAIL || DEFAULT_FROM;
  }

  /**
   * Send an email via the Resend API.
   *
   * @param to - Recipient email address
   * @param subject - Email subject line
   * @param html - Pre-rendered HTML content
   * @param options - Optional from/replyTo overrides
   */
  async send(
    to: string,
    subject: string,
    html: string,
    options?: { from?: string; replyTo?: string },
  ): Promise<NotificationResult> {
    if (!this.apiKey) {
      return { success: false, channel: 'email', error: 'Resend API key not configured' };
    }

    if (!to || !subject || !html) {
      return { success: false, channel: 'email', error: 'to, subject, and html are required' };
    }

    const payload: EmailPayload = {
      to,
      subject,
      html,
      from: options?.from ?? this.defaultFrom,
      ...(options?.replyTo ? { replyTo: options.replyTo } : {}),
    };

    try {
      const response = await fetch(RESEND_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData: ResendErrorResponse = await response.json().catch(() => ({
          statusCode: response.status,
          message: response.statusText,
          name: 'UnknownError',
        }));

        return {
          success: false,
          channel: 'email',
          error: `Resend error [${errorData.statusCode || response.status}]: ${errorData.message}`,
        };
      }

      const data: ResendSuccessResponse = await response.json();
      return { success: true, channel: 'email', messageId: data.id };
    } catch (err: any) {
      return { success: false, channel: 'email', error: err.message };
    }
  }
}
