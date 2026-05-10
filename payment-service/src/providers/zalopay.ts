import crypto from 'crypto';
import axios from 'axios';

const ZALOPAY_APP_ID = process.env.ZALOPAY_APP_ID || '';
const ZALOPAY_KEY1 = process.env.ZALOPAY_KEY1 || '';
const ZALOPAY_KEY2 = process.env.ZALOPAY_KEY2 || '';
const ZALOPAY_ENDPOINT = process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2';
const ZALOPAY_REDIRECT_URL = process.env.ZALOPAY_REDIRECT_URL || '';
const ZALOPAY_CALLBACK_URL = process.env.ZALOPAY_CALLBACK_URL || '';

export async function createZaloPayPayment(orderId: string, amount: number, userId: string, description: string) {
  const appTransId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${orderId}`;
  const appTime = Date.now();
  const embedData = JSON.stringify({ redirecturl: ZALOPAY_REDIRECT_URL });
  const items = JSON.stringify([{ name: description, amount, quantity: 1 }]);

  const hmacInput = `${ZALOPAY_APP_ID}|${appTransId}|${userId}|${amount}|${appTime}|${embedData}|${items}`;
  const mac = crypto.createHmac('sha256', ZALOPAY_KEY1).update(hmacInput).digest('hex');

  const body = {
    app_id: parseInt(ZALOPAY_APP_ID),
    app_user: userId,
    app_trans_id: appTransId,
    app_time: appTime,
    amount,
    item: items,
    embed_data: embedData,
    description,
    bank_code: '',
    mac,
    callback_url: ZALOPAY_CALLBACK_URL,
  };

  const res = await axios.post(`${ZALOPAY_ENDPOINT}/create`, body);
  return { payUrl: res.data.order_url, appTransId };
}

export function verifyZaloPayCallback(body: any): { valid: boolean; appTransId: string; success: boolean; transId: string } {
  const dataStr = body.data;
  const reqMac = body.mac;
  const mac = crypto.createHmac('sha256', ZALOPAY_KEY2).update(dataStr).digest('hex');

  if (mac !== reqMac) return { valid: false, appTransId: '', success: false, transId: '' };

  const data = JSON.parse(dataStr);
  return { valid: true, appTransId: data.app_trans_id, success: true, transId: data.zp_trans_id?.toString() || '' };
}
