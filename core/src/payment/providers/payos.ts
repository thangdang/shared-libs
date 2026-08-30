/**
 * payOS Payment Provider
 */
import crypto from 'crypto';
import axios from 'axios';
import type { WebhookVerifyResult } from '../types.js';

export interface PayOSConfig {
  clientId: string;
  apiKey: string;
  checksumKey: string;
  cancelUrl?: string;
  returnUrl?: string;
}

/**
 * Create a payOS payment.
 */
export async function createPayOSPayment(
  orderId: string,
  amount: number,
  description: string,
  config: PayOSConfig
) {
  const orderCode = Date.now();

  const paymentData = {
    orderCode,
    amount,
    description: orderId.slice(0, 25), // payOS max 25 chars
    cancelUrl: config.cancelUrl || '',
    returnUrl: config.returnUrl || '',
    items: [{ name: description, quantity: 1, price: amount }],
  };

  const checksumData = [
    `amount=${amount}`,
    `cancelUrl=${paymentData.cancelUrl}`,
    `description=${paymentData.description}`,
    `orderCode=${orderCode}`,
    `returnUrl=${paymentData.returnUrl}`,
  ].join('&');

  const signature = crypto
    .createHmac('sha256', config.checksumKey)
    .update(checksumData)
    .digest('hex');

  const res = await axios.post(
    'https://api-merchant.payos.vn/v2/payment-requests',
    { ...paymentData, signature },
    {
      headers: {
        'x-client-id': config.clientId,
        'x-api-key': config.apiKey,
        'Content-Type': 'application/json',
      },
    }
  );

  const { checkoutUrl, qrCode } = res.data.data || {};
  return { checkoutUrl, qrCode, orderCode };
}

/**
 * Verify payOS webhook.
 */
export function verifyPayOSWebhook(body: any): WebhookVerifyResult {
  const { code, data } = body;

  if (code !== '00' || !data) {
    return { valid: false, orderId: '', success: false, transId: '' };
  }

  return {
    valid: true,
    orderId: data.orderCode?.toString() || '',
    success: true,
    transId: data.paymentLinkId || data.reference || '',
    amount: data.amount,
  };
}

/**
 * payOS Provider class for object-oriented usage.
 */
export class PayOSProvider {
  private config: PayOSConfig;

  constructor(config: PayOSConfig) {
    this.config = config;
  }

  async createPayment(orderId: string, amount: number, description: string) {
    return createPayOSPayment(orderId, amount, description, this.config);
  }

  verifyWebhook(body: any): WebhookVerifyResult {
    return verifyPayOSWebhook(body);
  }
}
