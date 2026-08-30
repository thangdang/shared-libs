/**
 * SePay Payment Provider
 * Supports: VCB, VIB, BIDV, MB, ACB, Techcombank, TPBank, and 30+ other banks
 * Payment methods: BANK_TRANSFER (QR VietQR), NAPAS_BANK_TRANSFER, CARD (Visa/Master/JCB)
 */
import crypto from 'crypto';
import axios from 'axios';
import type { PaymentConfig, WebhookVerifyResult } from '../types.js';

export interface SepayConfig {
  merchantId: string;
  secretKey: string;
  env?: 'sandbox' | 'production';
  successUrl?: string;
  errorUrl?: string;
  cancelUrl?: string;
}

function getBaseUrl(env?: string): string {
  return env === 'production'
    ? 'https://pay.sepay.vn'
    : 'https://pay.dev.sepay.vn';
}

/**
 * Create a SePay payment checkout.
 */
export async function createSepayPayment(
  orderId: string,
  amount: number,
  description: string,
  config: SepayConfig,
  paymentMethod: 'BANK_TRANSFER' | 'NAPAS_BANK_TRANSFER' | 'CARD' = 'BANK_TRANSFER'
) {
  const baseUrl = getBaseUrl(config.env);

  const formData: Record<string, string> = {
    merchant_id: config.merchantId,
    operation: 'PURCHASE',
    payment_method: paymentMethod,
    order_invoice_number: orderId,
    order_amount: amount.toString(),
    currency: 'VND',
    order_description: description.slice(0, 255),
    success_url: config.successUrl || '',
    error_url: config.errorUrl || '',
    cancel_url: config.cancelUrl || '',
  };

  const signFields = [
    'operation',
    'payment_method',
    'order_invoice_number',
    'order_amount',
    'currency',
    'order_description',
    'customer_id',
    'success_url',
    'error_url',
    'cancel_url',
    'custom_data',
  ];

  const signData = signFields.map((field) => formData[field] || '').join('');
  const signature = crypto
    .createHmac('sha256', config.secretKey)
    .update(signData)
    .digest('hex');

  const payload = { ...formData, signature };

  const res = await axios.post(`${baseUrl}/v1/checkout/init`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const { checkout_url, qr_code, order_code } = res.data?.data || res.data || {};

  return {
    checkoutUrl: checkout_url || res.data?.checkout_url,
    qrCode: qr_code,
    orderCode: order_code || orderId,
  };
}

/**
 * Verify SePay webhook/IPN notification.
 */
export function verifySepayWebhook(body: any): WebhookVerifyResult {
  // Payment Gateway IPN format
  if (body.notification_type === 'ORDER_PAID') {
    const order = body.order || {};
    return {
      valid: true,
      orderId: order.order_invoice_number || '',
      success: true,
      transId: order.transaction_id || body.id?.toString() || '',
      amount: order.order_amount || 0,
    };
  }

  // Webhook format (bank transfer notification)
  if (!body || !body.id) {
    return { valid: false, orderId: '', success: false, transId: '', amount: 0 };
  }

  if (body.transferType !== 'in') {
    return { valid: false, orderId: '', success: false, transId: '', amount: 0 };
  }

  return {
    valid: true,
    orderId: body.code || '',
    success: true,
    transId: body.id.toString(),
    amount: body.transferAmount || 0,
  };
}

/**
 * Verify HMAC-SHA256 signature from SePay webhook.
 */
export function verifySepaySignature(
  body: any,
  signature: string,
  secretKey: string
): boolean {
  if (!secretKey || !signature) return false;

  const payload = JSON.stringify(body);
  const computed = crypto
    .createHmac('sha256', secretKey)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}

/**
 * SePay Provider class for object-oriented usage.
 */
export class SepayProvider {
  private config: SepayConfig;

  constructor(config: SepayConfig) {
    this.config = config;
  }

  async createPayment(
    orderId: string,
    amount: number,
    description: string,
    paymentMethod?: 'BANK_TRANSFER' | 'NAPAS_BANK_TRANSFER' | 'CARD'
  ) {
    return createSepayPayment(orderId, amount, description, this.config, paymentMethod);
  }

  verifyWebhook(body: any): WebhookVerifyResult {
    return verifySepayWebhook(body);
  }

  verifySignature(body: any, signature: string): boolean {
    return verifySepaySignature(body, signature, this.config.secretKey);
  }
}
