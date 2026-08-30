/**
 * Refund Provider — Dispatch refunds to appropriate payment provider
 */
import crypto from 'crypto';
import axios from 'axios';
import type { RefundRequest, RefundResult, PaymentConfig } from '../types.js';

/**
 * Dispatch refund to the appropriate payment provider.
 */
export async function processProviderRefund(
  method: string,
  request: RefundRequest,
  config: PaymentConfig
): Promise<RefundResult> {
  switch (method) {
    case 'sepay':
      return refundSepay(request, config.sepay!);
    case 'momo':
      return refundMoMo(request, config.momo!);
    case 'zalopay':
      return refundZaloPay(request, config.zalopay!);
    case 'payos':
      return refundPayOS(request, config.payos!);
    case 'stripe':
      return refundStripe(request, config.stripe!);
    default:
      return {
        success: false,
        provider: method,
        amount: request.amount,
        error: `Unsupported refund provider: ${method}`,
      };
  }
}

// ─── SePay Refund ───

async function refundSepay(
  request: RefundRequest,
  config: NonNullable<PaymentConfig['sepay']>
): Promise<RefundResult> {
  try {
    const baseUrl =
      config.env === 'production'
        ? 'https://pay.sepay.vn'
        : 'https://pay.dev.sepay.vn';

    const refundData: Record<string, string> = {
      merchant_id: config.merchantId,
      operation: 'REFUND',
      order_invoice_number: request.orderId,
      refund_amount: request.amount.toString(),
      currency: 'VND',
      refund_reason: request.reason.slice(0, 255),
      transaction_id: request.providerTransactionId || '',
    };

    const signFields = [
      'operation',
      'order_invoice_number',
      'refund_amount',
      'currency',
      'refund_reason',
      'transaction_id',
    ];
    const signData = signFields.map((field) => refundData[field] || '').join('');
    const signature = crypto
      .createHmac('sha256', config.secretKey)
      .update(signData)
      .digest('hex');

    const res = await axios.post(
      `${baseUrl}/v1/refund`,
      { ...refundData, signature },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const data = res.data?.data || res.data || {};

    return {
      success: true,
      refundId:
        data.refund_id ||
        data.transaction_id ||
        `SEPAY_RF_${request.orderId}_${Date.now()}`,
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

// ─── MoMo Refund ───

async function refundMoMo(
  request: RefundRequest,
  config: NonNullable<PaymentConfig['momo']>
): Promise<RefundResult> {
  try {
    const endpoint = config.endpoint || 'https://payment.momo.vn/v2/gateway/api';
    const requestId = `${request.orderId}_refund_${Date.now()}`;
    const transId = request.providerTransactionId
      ? parseInt(request.providerTransactionId, 10)
      : 0;

    const rawSignature = [
      `accessKey=${config.accessKey}`,
      `amount=${request.amount}`,
      `description=${request.reason}`,
      `orderId=${request.orderId}`,
      `partnerCode=${config.partnerCode}`,
      `requestId=${requestId}`,
      `transId=${transId}`,
    ].join('&');

    const signature = crypto
      .createHmac('sha256', config.secretKey)
      .update(rawSignature)
      .digest('hex');

    const body = {
      partnerCode: config.partnerCode,
      orderId: request.orderId,
      requestId,
      amount: request.amount,
      transId,
      lang: 'vi',
      description: request.reason,
      signature,
    };

    const res = await axios.post(`${endpoint}/refund`, body);
    const success = res.data.resultCode === 0;

    return {
      success,
      refundId: res.data.transId?.toString() || requestId,
      provider: 'momo',
      amount: request.amount,
      error: success ? undefined : res.data.message || 'MoMo refund failed',
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

// ─── ZaloPay Refund ───

async function refundZaloPay(
  request: RefundRequest,
  config: NonNullable<PaymentConfig['zalopay']>
): Promise<RefundResult> {
  try {
    const endpoint = config.endpoint || 'https://sb-openapi.zalopay.vn/v2';
    const timestamp = Date.now();
    const mRefundId = `${new Date()
      .toISOString()
      .slice(2, 10)
      .replace(/-/g, '')}_${request.orderId}_${timestamp}`;
    const zpTransId = request.providerTransactionId || '';

    const macData = `${config.appId}|${zpTransId}|${request.amount}|${request.reason}|${timestamp}`;
    const mac = crypto.createHmac('sha256', config.key1).update(macData).digest('hex');

    const body = {
      app_id: parseInt(config.appId),
      zp_trans_id: zpTransId,
      m_refund_id: mRefundId,
      amount: request.amount,
      description: request.reason,
      timestamp,
      mac,
    };

    const res = await axios.post(`${endpoint}/refund`, body);
    const success = res.data.return_code === 1;

    return {
      success,
      refundId: res.data.refund_id?.toString() || mRefundId,
      provider: 'zalopay',
      amount: request.amount,
      error: success ? undefined : res.data.return_message || 'ZaloPay refund failed',
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'zalopay',
      amount: request.amount,
      error:
        err.response?.data?.return_message || err.message || 'ZaloPay refund failed',
    };
  }
}

// ─── payOS Refund ───

async function refundPayOS(
  request: RefundRequest,
  config: NonNullable<PaymentConfig['payos']>
): Promise<RefundResult> {
  try {
    const orderCode = request.providerTransactionId || request.orderId;

    const checksumData = `orderCode=${orderCode}&cancellationReason=${request.reason}`;
    const signature = crypto
      .createHmac('sha256', config.checksumKey)
      .update(checksumData)
      .digest('hex');

    const res = await axios.post(
      `https://api-merchant.payos.vn/v2/payment-requests/${orderCode}/cancel`,
      { cancellationReason: request.reason, signature },
      {
        headers: {
          'x-client-id': config.clientId,
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = res.data?.data || res.data || {};
    const success = res.data?.code === '00' || res.status === 200;

    return {
      success,
      refundId:
        data.id?.toString() ||
        data.orderCode?.toString() ||
        `PAYOS_RF_${request.orderId}_${Date.now()}`,
      provider: 'payos',
      amount: request.amount,
      error: success ? undefined : res.data?.desc || 'payOS refund failed',
    };
  } catch (err: any) {
    return {
      success: false,
      provider: 'payos',
      amount: request.amount,
      error:
        err.response?.data?.desc ||
        err.response?.data?.message ||
        err.message ||
        'payOS refund failed',
    };
  }
}

// ─── Stripe Refund ───

async function refundStripe(
  request: RefundRequest,
  config: NonNullable<PaymentConfig['stripe']>
): Promise<RefundResult> {
  try {
    if (!config.secretKey) throw new Error('Stripe not configured');

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(config.secretKey);

    const refundParams: Record<string, any> = {
      amount: request.amount,
      reason:
        request.reason === 'duplicate'
          ? 'duplicate'
          : request.reason === 'fraudulent'
          ? 'fraudulent'
          : 'requested_by_customer',
    };

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
      error:
        refund.status === 'failed'
          ? refund.failure_reason || 'Stripe refund failed'
          : undefined,
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

/**
 * Refund Service class for object-oriented usage.
 */
export class RefundService {
  private config: PaymentConfig;

  constructor(config: PaymentConfig) {
    this.config = config;
  }

  async process(method: string, request: RefundRequest): Promise<RefundResult> {
    return processProviderRefund(method, request, this.config);
  }
}
