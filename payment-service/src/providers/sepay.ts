import crypto from 'crypto';
import axios from 'axios';

const SEPAY_MERCHANT_ID = process.env.SEPAY_MERCHANT_ID || '';
const SEPAY_SECRET_KEY = process.env.SEPAY_SECRET_KEY || '';
const SEPAY_ENV = process.env.SEPAY_ENV || 'sandbox'; // 'sandbox' | 'production'
const SEPAY_SUCCESS_URL = process.env.SEPAY_SUCCESS_URL || '';
const SEPAY_ERROR_URL = process.env.SEPAY_ERROR_URL || '';
const SEPAY_CANCEL_URL = process.env.SEPAY_CANCEL_URL || '';

const SEPAY_BASE_URL = SEPAY_ENV === 'production'
  ? 'https://pay.sepay.vn'
  : 'https://pay.dev.sepay.vn';

/**
 * Create a SePay payment checkout
 * Supports: VCB, VIB, BIDV, MB, ACB, Techcombank, TPBank, and 30+ other banks
 * Payment methods: BANK_TRANSFER (QR VietQR), NAPAS_BANK_TRANSFER, CARD (Visa/Master/JCB)
 */
export async function createSepayPayment(
  orderId: string,
  amount: number,
  description: string,
  paymentMethod: 'BANK_TRANSFER' | 'NAPAS_BANK_TRANSFER' | 'CARD' = 'BANK_TRANSFER'
) {
  const invoiceNumber = orderId;

  const formData: Record<string, string> = {
    merchant_id: SEPAY_MERCHANT_ID,
    operation: 'PURCHASE',
    payment_method: paymentMethod,
    order_invoice_number: invoiceNumber,
    order_amount: amount.toString(),
    currency: 'VND',
    order_description: description.slice(0, 255),
    success_url: SEPAY_SUCCESS_URL,
    error_url: SEPAY_ERROR_URL,
    cancel_url: SEPAY_CANCEL_URL,
  };

  // Generate HMAC-SHA256 signature
  // Fields must be in exact order as defined by SePay SDK
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

  const signData = signFields.map(field => formData[field] || '').join('');
  const signature = crypto.createHmac('sha256', SEPAY_SECRET_KEY).update(signData).digest('hex');

  const payload = {
    ...formData,
    signature,
  };

  const res = await axios.post(`${SEPAY_BASE_URL}/v1/checkout/init`, payload, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  const { checkout_url, qr_code, order_code } = res.data?.data || res.data || {};

  return {
    checkoutUrl: checkout_url || res.data?.checkout_url,
    qrCode: qr_code,
    orderCode: order_code || invoiceNumber,
  };
}

/**
 * Verify SePay webhook/IPN notification
 * SePay sends HTTP POST with transaction data when payment is confirmed
 *
 * Webhook payload fields:
 * - id: SePay transaction ID (use as dedup key)
 * - gateway: Bank name (e.g. "Vietcombank", "BIDV")
 * - transactionDate: Format YYYY-MM-DD HH:mm:ss
 * - accountNumber: Bank account number
 * - code: Payment code extracted from content (can be null)
 * - content: Original transfer memo
 * - transferType: "in" (incoming) or "out" (outgoing)
 * - transferAmount: Amount in VND
 * - referenceCode: Reference code from bank
 */
export function verifySepayWebhook(
  body: any,
  secretKey?: string
): { valid: boolean; orderId: string; success: boolean; transId: string; amount: number } {
  // Payment Gateway IPN format (notification_type present)
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

  // Only process incoming transfers
  if (body.transferType !== 'in') {
    return { valid: false, orderId: '', success: false, transId: '', amount: 0 };
  }

  return {
    valid: true,
    orderId: body.code || '', // Payment code extracted from transfer content
    success: true,
    transId: body.id.toString(),
    amount: body.transferAmount || 0,
  };
}

/**
 * Verify HMAC-SHA256 signature from SePay webhook
 * Use this for production to ensure webhook authenticity
 */
export function verifySepaySignature(body: any, signature: string, secret?: string): boolean {
  const key = secret || SEPAY_SECRET_KEY;
  if (!key || !signature) return false;

  const payload = JSON.stringify(body);
  const computed = crypto.createHmac('sha256', key).update(payload).digest('hex');

  return crypto.timingSafeEqual(Buffer.from(computed), Buffer.from(signature));
}
