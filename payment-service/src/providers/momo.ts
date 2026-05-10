import crypto from 'crypto';
import axios from 'axios';

const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || 'https://payment.momo.vn/v2/gateway/api';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || '';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || '';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || '';
const MOMO_REDIRECT_URL = process.env.MOMO_REDIRECT_URL || '';
const MOMO_IPN_URL = process.env.MOMO_IPN_URL || '';

export async function createMoMoPayment(orderId: string, amount: number, orderInfo: string) {
  const requestId = orderId;
  const rawSignature = `accessKey=${MOMO_ACCESS_KEY}&amount=${amount}&extraData=&ipnUrl=${MOMO_IPN_URL}&orderId=${orderId}&orderInfo=${orderInfo}&partnerCode=${MOMO_PARTNER_CODE}&redirectUrl=${MOMO_REDIRECT_URL}&requestId=${requestId}&requestType=payWithMethod`;
  const signature = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(rawSignature).digest('hex');

  const body = {
    partnerCode: MOMO_PARTNER_CODE,
    requestId, amount, orderId, orderInfo,
    redirectUrl: MOMO_REDIRECT_URL,
    ipnUrl: MOMO_IPN_URL,
    requestType: 'payWithMethod',
    extraData: '', lang: 'vi', signature,
  };

  const res = await axios.post(`${MOMO_ENDPOINT}/create`, body);
  return { payUrl: res.data.payUrl };
}

export function verifyMoMoWebhook(body: any): { valid: boolean; orderId: string; success: boolean; transId: string } {
  const { orderId, resultCode, transId } = body;
  // TODO: verify signature for production
  return { valid: true, orderId, success: resultCode === 0, transId: transId?.toString() || '' };
}
