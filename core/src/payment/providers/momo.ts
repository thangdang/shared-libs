/**
 * MoMo Payment Provider
 */
import crypto from 'crypto';
import axios from 'axios';
import type { WebhookVerifyResult } from '../types.js';

export interface MoMoConfig {
  endpoint?: string;
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  redirectUrl?: string;
  ipnUrl?: string;
}

const DEFAULT_ENDPOINT = 'https://payment.momo.vn/v2/gateway/api';

/**
 * Create a MoMo payment.
 */
export async function createMoMoPayment(
  orderId: string,
  amount: number,
  orderInfo: string,
  config: MoMoConfig
) {
  const endpoint = config.endpoint || DEFAULT_ENDPOINT;
  const requestId = orderId;

  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `amount=${amount}`,
    `extraData=`,
    `ipnUrl=${config.ipnUrl || ''}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo}`,
    `partnerCode=${config.partnerCode}`,
    `redirectUrl=${config.redirectUrl || ''}`,
    `requestId=${requestId}`,
    `requestType=payWithMethod`,
  ].join('&');

  const signature = crypto
    .createHmac('sha256', config.secretKey)
    .update(rawSignature)
    .digest('hex');

  const body = {
    partnerCode: config.partnerCode,
    requestId,
    amount,
    orderId,
    orderInfo,
    redirectUrl: config.redirectUrl || '',
    ipnUrl: config.ipnUrl || '',
    requestType: 'payWithMethod',
    extraData: '',
    lang: 'vi',
    signature,
  };

  const res = await axios.post(`${endpoint}/create`, body);
  return { payUrl: res.data.payUrl };
}

/**
 * Verify MoMo webhook/IPN notification.
 */
export function verifyMoMoWebhook(
  body: any,
  config: MoMoConfig
): WebhookVerifyResult {
  const {
    orderId,
    resultCode,
    transId,
    amount,
    orderInfo,
    orderType,
    requestId,
    extraData,
    signature,
  } = body;

  if (!orderId || !signature) {
    return { valid: false, orderId: orderId || '', success: false, transId: '' };
  }

  const rawSignature = [
    `accessKey=${config.accessKey}`,
    `amount=${amount}`,
    `extraData=${extraData || ''}`,
    `message=${body.message || ''}`,
    `orderId=${orderId}`,
    `orderInfo=${orderInfo || ''}`,
    `orderType=${orderType || ''}`,
    `partnerCode=${config.partnerCode}`,
    `payType=${body.payType || ''}`,
    `requestId=${requestId || ''}`,
    `responseTime=${body.responseTime || ''}`,
    `resultCode=${resultCode}`,
    `transId=${transId || ''}`,
  ].join('&');

  const expectedSignature = crypto
    .createHmac('sha256', config.secretKey)
    .update(rawSignature)
    .digest('hex');

  const valid = expectedSignature === signature;

  return {
    valid,
    orderId,
    success: resultCode === 0,
    transId: transId?.toString() || '',
    amount,
  };
}

/**
 * MoMo Provider class for object-oriented usage.
 */
export class MoMoProvider {
  private config: MoMoConfig;

  constructor(config: MoMoConfig) {
    this.config = config;
  }

  async createPayment(orderId: string, amount: number, orderInfo: string) {
    return createMoMoPayment(orderId, amount, orderInfo, this.config);
  }

  verifyWebhook(body: any): WebhookVerifyResult {
    return verifyMoMoWebhook(body, this.config);
  }
}
