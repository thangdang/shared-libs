/**
 * ZaloPay Payment Provider
 */
import crypto from 'crypto';
import axios from 'axios';
import type { WebhookVerifyResult } from '../types.js';

export interface ZaloPayConfig {
  endpoint?: string;
  appId: string;
  key1: string;
  key2: string;
  redirectUrl?: string;
  callbackUrl?: string;
}

const DEFAULT_ENDPOINT = 'https://sb-openapi.zalopay.vn/v2';

/**
 * Create a ZaloPay payment.
 */
export async function createZaloPayPayment(
  orderId: string,
  amount: number,
  userId: string,
  description: string,
  config: ZaloPayConfig
) {
  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const appTransId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${orderId}`;
  const appTime = Date.now();
  const embedData = JSON.stringify({ redirecturl: config.redirectUrl || '' });
  const items = JSON.stringify([{ name: description, amount, quantity: 1 }]);

  const hmacInput = `${config.appId}|${appTransId}|${userId}|${amount}|${appTime}|${embedData}|${items}`;
  const mac = crypto.createHmac('sha256', config.key1).update(hmacInput).digest('hex');

  const body = {
    app_id: parseInt(config.appId),
    app_user: userId,
    app_trans_id: appTransId,
    app_time: appTime,
    amount,
    item: items,
    embed_data: embedData,
    description,
    bank_code: '',
    mac,
    callback_url: config.callbackUrl || '',
  };

  const res = await axios.post(`${endpoint}/create`, body);
  return { payUrl: res.data.order_url, appTransId };
}

/**
 * Verify ZaloPay callback.
 */
export function verifyZaloPayCallback(
  body: any,
  config: ZaloPayConfig
): WebhookVerifyResult {
  const dataStr = body.data;
  const reqMac = body.mac;
  const mac = crypto.createHmac('sha256', config.key2).update(dataStr).digest('hex');

  if (mac !== reqMac) {
    return { valid: false, orderId: '', success: false, transId: '' };
  }

  const data = JSON.parse(dataStr);
  return {
    valid: true,
    orderId: data.app_trans_id,
    success: true,
    transId: data.zp_trans_id?.toString() || '',
    amount: data.amount,
  };
}

/**
 * ZaloPay Provider class for object-oriented usage.
 */
export class ZaloPayProvider {
  private config: ZaloPayConfig;

  constructor(config: ZaloPayConfig) {
    this.config = config;
  }

  async createPayment(
    orderId: string,
    amount: number,
    userId: string,
    description: string
  ) {
    return createZaloPayPayment(orderId, amount, userId, description, this.config);
  }

  verifyWebhook(body: any): WebhookVerifyResult {
    return verifyZaloPayCallback(body, this.config);
  }
}
