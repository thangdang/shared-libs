import crypto from 'crypto';
import axios from 'axios';

const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';
const PAYOS_CANCEL_URL = process.env.PAYOS_CANCEL_URL || '';
const PAYOS_RETURN_URL = process.env.PAYOS_RETURN_URL || '';

export async function createPayOSPayment(orderId: string, amount: number, description: string) {
  const orderCode = Date.now();

  const paymentData = {
    orderCode,
    amount,
    description: orderId.slice(0, 25), // payOS max 25 chars
    cancelUrl: PAYOS_CANCEL_URL,
    returnUrl: PAYOS_RETURN_URL,
    items: [{ name: description, quantity: 1, price: amount }],
  };

  const checksumData = `amount=${amount}&cancelUrl=${paymentData.cancelUrl}&description=${paymentData.description}&orderCode=${orderCode}&returnUrl=${paymentData.returnUrl}`;
  const signature = crypto.createHmac('sha256', PAYOS_CHECKSUM_KEY).update(checksumData).digest('hex');

  const res = await axios.post('https://api-merchant.payos.vn/v2/payment-requests', { ...paymentData, signature }, {
    headers: {
      'x-client-id': PAYOS_CLIENT_ID,
      'x-api-key': PAYOS_API_KEY,
      'Content-Type': 'application/json',
    },
  });

  const { checkoutUrl, qrCode } = res.data.data || {};
  return { checkoutUrl, qrCode, orderCode };
}

export function verifyPayOSWebhook(body: any): { valid: boolean; orderCode: number; success: boolean; transId: string } {
  const { code, data } = body;
  if (code !== '00' || !data) return { valid: false, orderCode: 0, success: false, transId: '' };

  // TODO: verify checksum signature for production
  return {
    valid: true,
    orderCode: data.orderCode,
    success: true,
    transId: data.paymentLinkId || data.reference || '',
  };
}
