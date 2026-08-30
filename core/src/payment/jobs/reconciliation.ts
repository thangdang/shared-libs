/**
 * Payment Reconciliation — Poll providers for stuck pending payments
 */
import crypto from 'crypto';
import axios from 'axios';
import type { Model } from 'mongoose';
import type { IPayment, PaymentConfig, ProviderStatusResult, ReconciliationResult } from '../types.js';

const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
const ADMIN_ALERT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours
const RECONCILIATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

export interface ReconciliationConfig {
  /** Payment model from the app */
  paymentModel: Model<IPayment>;
  /** Payment provider configuration */
  config: PaymentConfig;
  /** Callback when payment is reconciled */
  onReconciled?: (payment: IPayment, newStatus: string) => Promise<void>;
  /** Callback when payment is stuck too long */
  onAlert?: (payment: IPayment, ageMinutes: number) => void;
}

// ─── Provider Status Check Functions ───

async function checkSepayStatus(
  payment: IPayment,
  config: NonNullable<PaymentConfig['sepay']>
): Promise<ProviderStatusResult> {
  try {
    const baseUrl =
      config.env === 'production'
        ? 'https://pay.sepay.vn'
        : 'https://pay.dev.sepay.vn';

    const signData = `${config.merchantId}${payment.order_id}`;
    const signature = crypto
      .createHmac('sha256', config.secretKey)
      .update(signData)
      .digest('hex');

    const res = await axios.get(`${baseUrl}/v1/orders/${payment.order_id}/status`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': config.merchantId,
        'X-Signature': signature,
      },
    });

    const data = res.data?.data || res.data || {};
    const providerStatus = (data.status || '').toLowerCase();

    if (['paid', 'completed', 'success'].includes(providerStatus)) {
      return { status: 'completed', transactionId: data.transaction_id || data.id?.toString() };
    }
    if (['failed', 'cancelled', 'expired'].includes(providerStatus)) {
      return { status: 'failed', error: data.message || providerStatus };
    }
    return { status: 'pending' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'SePay status check failed' };
  }
}

async function checkMoMoStatus(
  payment: IPayment,
  config: NonNullable<PaymentConfig['momo']>
): Promise<ProviderStatusResult> {
  try {
    const endpoint = config.endpoint || 'https://payment.momo.vn/v2/gateway/api';
    const requestId = `${payment.order_id}_status_${Date.now()}`;

    const rawSignature = [
      `accessKey=${config.accessKey}`,
      `orderId=${payment.order_id}`,
      `partnerCode=${config.partnerCode}`,
      `requestId=${requestId}`,
    ].join('&');

    const signature = crypto
      .createHmac('sha256', config.secretKey)
      .update(rawSignature)
      .digest('hex');

    const res = await axios.post(`${endpoint}/query`, {
      partnerCode: config.partnerCode,
      requestId,
      orderId: payment.order_id,
      signature,
      lang: 'vi',
    });

    const resultCode = res.data?.resultCode;

    if (resultCode === 0) {
      return { status: 'completed', transactionId: res.data.transId?.toString() };
    }
    if ([1000, 1001, 1002].includes(resultCode)) {
      return { status: 'pending' };
    }
    return { status: 'failed', error: res.data?.message || `resultCode: ${resultCode}` };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'MoMo status check failed' };
  }
}

async function checkZaloPayStatus(
  payment: IPayment,
  config: NonNullable<PaymentConfig['zalopay']>
): Promise<ProviderStatusResult> {
  try {
    const endpoint = config.endpoint || 'https://sb-openapi.zalopay.vn/v2';
    const appTransId = payment.provider_transaction_id || payment.order_id;
    const macData = `${config.appId}|${appTransId}|${config.key1}`;
    const mac = crypto.createHmac('sha256', config.key1).update(macData).digest('hex');

    const res = await axios.post(`${endpoint}/query`, {
      app_id: parseInt(config.appId),
      app_trans_id: appTransId,
      mac,
    });

    const returnCode = res.data?.return_code;

    if (returnCode === 1) {
      return { status: 'completed', transactionId: res.data.zp_trans_id?.toString() };
    }
    if (returnCode === 3) {
      return { status: 'pending' };
    }
    return { status: 'failed', error: res.data?.return_message || `return_code: ${returnCode}` };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'ZaloPay status check failed' };
  }
}

async function checkPayOSStatus(
  payment: IPayment,
  config: NonNullable<PaymentConfig['payos']>
): Promise<ProviderStatusResult> {
  try {
    const orderCode = payment.provider_transaction_id || payment.order_id;

    const res = await axios.get(
      `https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`,
      {
        headers: {
          'x-client-id': config.clientId,
          'x-api-key': config.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    const data = res.data?.data || res.data || {};
    const providerStatus = (data.status || '').toUpperCase();

    if (['PAID', 'COMPLETED'].includes(providerStatus)) {
      return { status: 'completed', transactionId: data.id?.toString() || data.orderCode?.toString() };
    }
    if (['CANCELLED', 'EXPIRED'].includes(providerStatus)) {
      return { status: 'failed', error: providerStatus };
    }
    return { status: 'pending' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'payOS status check failed' };
  }
}

async function checkStripeStatus(
  payment: IPayment,
  config: NonNullable<PaymentConfig['stripe']>
): Promise<ProviderStatusResult> {
  try {
    if (!config.secretKey) return { status: 'unknown', error: 'Stripe not configured' };

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(config.secretKey);

    if (payment.provider_transaction_id) {
      const intent = await stripe.paymentIntents.retrieve(payment.provider_transaction_id);

      if (intent.status === 'succeeded') {
        return { status: 'completed', transactionId: intent.id };
      }
      if (['canceled', 'requires_payment_method'].includes(intent.status)) {
        return { status: 'failed', error: intent.status };
      }
      return { status: 'pending' };
    }

    return { status: 'unknown', error: 'No provider_transaction_id to query' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'Stripe status check failed' };
  }
}

async function checkProviderStatus(
  payment: IPayment,
  config: PaymentConfig
): Promise<ProviderStatusResult> {
  switch (payment.method) {
    case 'sepay':
      return config.sepay ? checkSepayStatus(payment, config.sepay) : { status: 'unknown', error: 'SePay not configured' };
    case 'momo':
      return config.momo ? checkMoMoStatus(payment, config.momo) : { status: 'unknown', error: 'MoMo not configured' };
    case 'zalopay':
      return config.zalopay ? checkZaloPayStatus(payment, config.zalopay) : { status: 'unknown', error: 'ZaloPay not configured' };
    case 'payos':
      return config.payos ? checkPayOSStatus(payment, config.payos) : { status: 'unknown', error: 'payOS not configured' };
    case 'stripe':
      return config.stripe ? checkStripeStatus(payment, config.stripe) : { status: 'unknown', error: 'Stripe not configured' };
    default:
      return { status: 'unknown', error: `Unsupported provider: ${payment.method}` };
  }
}

// ─── Core Reconciliation Logic ───

/**
 * Run a single reconciliation pass.
 */
export async function reconcile(reconcileConfig: ReconciliationConfig): Promise<ReconciliationResult> {
  const { paymentModel, config, onReconciled, onAlert } = reconcileConfig;
  const result: ReconciliationResult = {
    processed: 0,
    updated: 0,
    alerts: 0,
    errors: [],
  };

  const cutoffTime = new Date(Date.now() - STUCK_THRESHOLD_MS);

  const stuckPayments = await paymentModel
    .find({
      status: 'pending',
      created_at: { $lt: cutoffTime },
    })
    .lean();

  result.processed = stuckPayments.length;

  if (stuckPayments.length === 0) {
    console.log('[Reconciliation] No stuck payments found.');
    return result;
  }

  console.log(`[Reconciliation] Found ${stuckPayments.length} stuck payment(s). Checking providers...`);

  for (const payment of stuckPayments) {
    try {
      const providerResult = await checkProviderStatus(payment as IPayment, config);

      if (providerResult.status === 'completed') {
        await paymentModel.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: 'completed',
              confirmed_by: 'reconciliation',
              confirmed_at: new Date(),
              provider_transaction_id:
                providerResult.transactionId || payment.provider_transaction_id,
            },
          }
        );
        result.updated++;
        console.log(`[Reconciliation] ✅ ${payment.order_id} marked completed`);

        if (onReconciled) {
          await onReconciled(payment as IPayment, 'completed');
        }
      } else if (providerResult.status === 'failed') {
        await paymentModel.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: 'failed',
              'metadata.reconciliation_failure_reason': providerResult.error,
              'metadata.reconciled_at': new Date().toISOString(),
            },
          }
        );
        result.updated++;
        console.log(`[Reconciliation] ❌ ${payment.order_id} marked failed`);
      } else if (providerResult.status === 'pending') {
        const paymentAge = Date.now() - new Date(payment.created_at).getTime();
        if (paymentAge > ADMIN_ALERT_THRESHOLD_MS) {
          const ageMinutes = Math.round(paymentAge / 60000);
          if (onAlert) {
            onAlert(payment as IPayment, ageMinutes);
          } else {
            console.warn(
              `[Reconciliation] ⚠️ Payment ${payment.order_id} stuck pending for ${ageMinutes} minutes`
            );
          }
          result.alerts++;
        }
      } else {
        const errorMsg = `${payment.order_id}: provider returned unknown status (${providerResult.error})`;
        result.errors.push(errorMsg);
        console.warn(`[Reconciliation] ⚠️ ${errorMsg}`);
      }
    } catch (err: any) {
      const errorMsg = `${payment.order_id}: ${err.message}`;
      result.errors.push(errorMsg);
      console.error(`[Reconciliation] Error processing ${payment.order_id}:`, err.message);
    }
  }

  console.log(
    `[Reconciliation] Complete — Processed: ${result.processed}, Updated: ${result.updated}, Alerts: ${result.alerts}, Errors: ${result.errors.length}`
  );

  return result;
}

// ─── Scheduler ───

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reconciliation job on a 30-minute interval.
 */
export function startReconciliation(reconcileConfig: ReconciliationConfig): void {
  if (reconciliationTimer) {
    console.log('[Reconciliation] Already running.');
    return;
  }

  console.log('[Reconciliation] Starting scheduled job (every 30 minutes)...');

  reconcile(reconcileConfig).catch((err) => {
    console.error('[Reconciliation] Initial run failed:', err.message);
  });

  reconciliationTimer = setInterval(() => {
    reconcile(reconcileConfig).catch((err) => {
      console.error('[Reconciliation] Scheduled run failed:', err.message);
    });
  }, RECONCILIATION_INTERVAL_MS);
}

/**
 * Stop the reconciliation job.
 */
export function stopReconciliation(): void {
  if (reconciliationTimer) {
    clearInterval(reconciliationTimer);
    reconciliationTimer = null;
    console.log('[Reconciliation] Stopped.');
  }
}

/**
 * Reconciliation Service class for object-oriented usage.
 */
export class ReconciliationService {
  private config: ReconciliationConfig;

  constructor(config: ReconciliationConfig) {
    this.config = config;
  }

  async runOnce(): Promise<ReconciliationResult> {
    return reconcile(this.config);
  }

  start(): void {
    startReconciliation(this.config);
  }

  stop(): void {
    stopReconciliation();
  }
}
