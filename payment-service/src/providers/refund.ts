/**
 * Refund Provider Interface
 * ─────────────────────────
 * Generic refund interface for all payment providers.
 * Each provider (sepay, momo, zalopay, payos, stripe) implements
 * the actual refund API call.
 *
 * This module dispatches refund requests to the appropriate provider.
 */
import crypto from 'crypto';
import axios from 'axios';

// ─── Environment Variables ────────────────────────────────────────────────────

// SePay
const SEPAY_MERCHANT_ID = process.env.SEPAY_MERCHANT_ID || '';
const SEPAY_SECRET_KEY = process.env.SEPAY_SECRET_KEY || '';
const SEPAY_ENV = process.env.SEPAY_ENV || 'sandbox';
const SEPAY_BASE_URL = SEPAY_ENV === 'production'
  ? 'https://pay.sepay.vn'
  : 'https://pay.dev.sepay.vn';

// MoMo
const MOMO_ENDPOINT = process.env.MOMO_ENDPOINT || 'https://payment.momo.vn/v2/gateway/api';
const MOMO_PARTNER_CODE = process.env.MOMO_PARTNER_CODE || '';
const MOMO_ACCESS_KEY = process.env.MOMO_ACCESS_KEY || '';
const MOMO_SECRET_KEY = process.env.MOMO_SECRET_KEY || '';

// ZaloPay
const ZALOPAY_APP_ID = process.env.ZALOPAY_APP_ID || '';
const ZALOPAY_KEY1 = process.env.ZALOPAY_KEY1 || '';
const ZALOPAY_ENDPOINT = process.env.ZALOPAY_ENDPOINT || 'https://sb-openapi.zalopay.vn/v2';

// payOS
const PAYOS_CLIENT_ID = process.env.PAYOS_CLIENT_ID || '';
const PAYOS_API_KEY = process.env.PAYOS_API_KEY || '';
const PAYOS_CHECKSUM_KEY = process.env.PAYOS_CHECKSUM_KEY || '';

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface RefundResult {
  success: boolean;
  refundId?: string;
  provider: string;
  amount: number;
  error?: string;
}

export interface RefundRequest {
  orderId: string;
  amount: number;
  reason: string;
  providerTransactionId?: string;
  metadata?: Record<string, any>;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

/**
 * Dispatch refund to the appropriate payment provider.
 */
export async function processProviderRefund(
  method: string,
  request: RefundRequest
): Promise<RefundResult> {
  switch (method) {
    case 'sepay':
      return refundSepay(request);
    case 'momo':
      return refundMoMo(request);
    case 'zalopay':
      return refundZaloPay(request);
    case 'payos':
      return refundPayOS(request);
    case 'stripe':
      return refundStripe(request);
    default:
      return {
        success: false,
        provider: method,
        amount: request.amount,
        error: `Unsupported refund provider: ${method}`,
      };
  }
}

// ─── SePay Refund ─────────────────────────────────────────────────────────────

/**
 * SePay refund — POST to SePay refund endpoint
 * Uses HMAC-SHA256 signature consistent with createSepayPayment pattern.
 */
async function refundSepay(request: RefundRequest): Promise<RefundResult> {
  try {
    const refundData: Record<string, string> = {
      merchant_id: SEPAY_MERCHANT_ID,
      operation: 'REFUND',
      order_invoice_number: request.orderId,
      refund_amount: request.amount.toString(),
      currency: 'VND',
      refund_reason: request.reason.slice(0, 255),
      transaction_id: request.providerTransactionId || '',
    };

    // Generate HMAC-SHA256 signature (same pattern as createSepayPayment)
    const signFields = [
      'operation',
      'order_invoice_number',
      'refund_amount',
      'currency',
      'refund_reason',
      'transaction_id',
    ];
    const signData = signFields.map(field => refundData[field] || '').join('');
    const signature = crypto.createHmac('sha256', SEPAY_SECRET_KEY).update(signData).digest('hex');

    const payload = { ...refundData, signature };

    const res = await axios.post(`${SEPAY_BASE_URL}/v1/refund`, payload, {
      headers: { 'Content-Type': 'application/json' },
    });

    const data = res.data?.data || res.data || {};

    return {
      success: true,
      refundId: data.refund_id || data.transaction_id || `SEPAY_RF_${request.orderId}_${Date.now()}`,
      provider: 'sepay',
      amount: request.amount,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'sepay',
      amount: request.amount,
      error: err.response?.data?.message || err.message || 'SePay refund failed',
    };
  }
}

// ─── MoMo Refund ──────────────────────────────────────────────────────────────

/**
 * MoMo refund — POST to /v2/gateway/api/refund with HMAC signature
 * Signature format follows MoMo refund API documentation.
 */
async function refundMoMo(request: RefundRequest): Promise<RefundResult> {
  try {
    const requestId = `${request.orderId}_refund_${Date.now()}`;
    const orderId = request.orderId;
    const transId = request.providerTransactionId ? parseInt(request.providerTransactionId, 10) : 0;

    // MoMo refund signature:  accessKey, amount, description, orderId, partnerCode, requestId, transId
    const rawSignature = [
      `accessKey=${MOMO_ACCESS_KEY}`,
      `amount=${request.amount}`,
      `description=${request.reason}`,
      `orderId=${orderId}`,
      `partnerCode=${MOMO_PARTNER_CODE}`,
      `requestId=${requestId}`,
      `transId=${transId}`,
    ].join('&');

    const signature = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(rawSignature).digest('hex');

    const body = {
      partnerCode: MOMO_PARTNER_CODE,
      orderId,
      requestId,
      amount: request.amount,
      transId,
      lang: 'vi',
      description: request.reason,
      signature,
    };

    const res = await axios.post(`${MOMO_ENDPOINT}/refund`, body);

    const success = res.data.resultCode === 0;
    return {
      success,
      refundId: res.data.transId?.toString() || requestId,
      provider: 'momo',
      amount: request.amount,
      error: success ? undefined : (res.data.message || 'MoMo refund failed'),
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'momo',
      amount: request.amount,
      error: err.response?.data?.message || err.message || 'MoMo refund failed',
    };
  }
}

// ─── ZaloPay Refund ───────────────────────────────────────────────────────────

/**
 * ZaloPay refund — POST to /v2/refund with MAC signature
 * MAC format:  app_id|zp_trans_id|amount|description|timestamp
 */
async function refundZaloPay(request: RefundRequest): Promise<RefundResult> {
  try {
    const timestamp = Date.now();
    const mRefundId = `${new Date().toISOString().slice(2, 10).replace(/-/g, '')}_${request.orderId}_${timestamp}`;
    const zpTransId = request.providerTransactionId || '';
    const description = request.reason;

    // ZaloPay refund MAC:  app_id|zp_trans_id|amount|description|timestamp
    const macData = `${ZALOPAY_APP_ID}|${zpTransId}|${request.amount}|${description}|${timestamp}`;
    const mac = crypto.createHmac('sha256', ZALOPAY_KEY1).update(macData).digest('hex');

    const body = {
      app_id: parseInt(ZALOPAY_APP_ID),
      zp_trans_id: zpTransId,
      m_refund_id: mRefundId,
      amount: request.amount,
      description,
      timestamp,
      mac,
    };

    const res = await axios.post(`${ZALOPAY_ENDPOINT}/refund`, body);

    const success = res.data.return_code === 1;
    return {
      success,
      refundId: res.data.refund_id?.toString() || mRefundId,
      provider: 'zalopay',
      amount: request.amount,
      error: success ? undefined : (res.data.return_message || 'ZaloPay refund failed'),
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'zalopay',
      amount: request.amount,
      error: err.response?.data?.return_message || err.message || 'ZaloPay refund failed',
    };
  }
}

// ─── payOS Refund ─────────────────────────────────────────────────────────────

/**
 * payOS refund — POST to payOS cancel/refund endpoint
 * Uses the same auth headers as createPayOSPayment (x-client-id, x-api-key).
 */
async function refundPayOS(request: RefundRequest): Promise<RefundResult> {
  try {
    const orderCode = request.providerTransactionId || request.orderId;

    // payOS uses cancel with reason for refund
    const cancelData = {
      cancellationReason: request.reason,
    };

    // Signature for cancel:  orderCode + cancellationReason
    const checksumData = `orderCode=${orderCode}&cancellationReason=${request.reason}`;
    const signature = crypto.createHmac('sha256', PAYOS_CHECKSUM_KEY).update(checksumData).digest('hex');

    const res = await axios.post(
      `https://api-merchant.payos.vn/v2/payment-requests/${orderCode}/cancel`,
      { ...cancelData, signature },
      {
        headers: {
          'x-client-id': PAYOS_CLIENT_ID,
          'x-api-key': PAYOS_API_KEY,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = res.data?.data || res.data || {};
    const success = res.data?.code === '00' || res.status === 200;

    return {
      success,
      refundId: data.id?.toString() || data.orderCode?.toString() || `PAYOS_RF_${request.orderId}_${Date.now()}`,
      provider: 'payos',
      amount: request.amount,
      error: success ? undefined : (res.data?.desc || 'payOS refund failed'),
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'payos',
      amount: request.amount,
      error: err.response?.data?.desc || err.response?.data?.message || err.message || 'payOS refund failed',
    };
  }
}

// ─── Stripe Refund ────────────────────────────────────────────────────────────

/**
 * Stripe refund — Use stripe.refunds.create()
 * Follows the same Stripe instantiation pattern as createStripeCheckout.
 */
async function refundStripe(request: RefundRequest): Promise<RefundResult> {
  try {
    if (!STRIPE_SECRET_KEY) throw new Error('Stripe not configured');

    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    const refundParams: Record<string, any> = {
      amount: request.amount,
      reason: request.reason === 'duplicate' ? 'duplicate'
        : request.reason === 'fraudulent' ? 'fraudulent'
        : 'requested_by_customer',
    };

    // Use payment_intent if provided, otherwise use the orderId as a lookup key
    if (request.providerTransactionId) {
      refundParams.payment_intent = request.providerTransactionId;
    }

    if (request.metadata) {
      refundParams.metadata = request.metadata;
    }

    const refund = await stripe.refunds.create(refundParams);

    return {
      success: refund.status === 'succeeded' || refund.status === 'pending',
      refundId: refund.id,
      provider: 'stripe',
      amount: request.amount,
      error: refund.status === 'failed' ? (refund.failure_reason || 'Stripe refund failed') : undefined,
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'stripe',
      amount: request.amount,
      error: err.message || 'Stripe refund failed',
    };
  }
}
