/**
 * Payment Reconciliation Job
 * ──────────────────────────
 * Polls payment providers for payments stuck in "pending" status.
 *
 * Schedule:  Every 30 minutes
 * Logic:
 *   1. Find payments with status='pending' AND created_at < 30 min ago
 *   2. For each:  query provider API for actual status
 *   3. If provider says completed → mark completed + trigger webhook
 *   4. If provider says failed → mark failed
 *   5. If provider says still pending AND > 2 hours → alert admin
 *
 * Requirement:  Req 7.3
 */

import axios from 'axios';
import crypto from 'crypto';
import { Payment, IPayment } from '../models/Payment';

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

// Stripe
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';

// Reconciliation config
const RECONCILIATION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes
const STUCK_THRESHOLD_MS = 30 * 60 * 1000;          // 30 minutes — minimum age for reconciliation
const ADMIN_ALERT_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours — triggers admin alert

// Webhook URL for product services (internal)
const WEBHOOK_INTERNAL_URL = process.env.PAYMENT_WEBHOOK_INTERNAL_URL || '';

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface ProviderStatusResult {
  status: 'completed' | 'failed' | 'pending' | 'unknown';
  transactionId?: string;
  error?: string;
}

export interface ReconciliationResult {
  processed: number;
  updated: number;
  alerts: number;
  errors: string[];
}

// ─── Provider Status Check Functions ──────────────────────────────────────────

/**
 * Query SePay for a payment's actual status.
 */
async function checkSepayStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  try {
    const signData = `${SEPAY_MERCHANT_ID}${payment.order_id}`;
    const signature = crypto.createHmac('sha256', SEPAY_SECRET_KEY).update(signData).digest('hex');

    const res = await axios.get(`${SEPAY_BASE_URL}/v1/orders/${payment.order_id}/status`, {
      headers: {
        'Content-Type': 'application/json',
        'X-Merchant-Id': SEPAY_MERCHANT_ID,
        'X-Signature': signature,
      },
    });

    const data = res.data?.data || res.data || {};
    const providerStatus = (data.status || '').toLowerCase();

    if (providerStatus === 'paid' || providerStatus === 'completed' || providerStatus === 'success') {
      return { status: 'completed', transactionId: data.transaction_id || data.id?.toString() };
    }
    if (providerStatus === 'failed' || providerStatus === 'cancelled' || providerStatus === 'expired') {
      return { status: 'failed', error: data.message || providerStatus };
    }
    return { status: 'pending' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'SePay status check failed' };
  }
}

/**
 * Query MoMo for a payment's actual status.
 */
async function checkMoMoStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  try {
    const requestId = `${payment.order_id}_status_${Date.now()}`;

    const rawSignature = [
      `accessKey=${MOMO_ACCESS_KEY}`,
      `orderId=${payment.order_id}`,
      `partnerCode=${MOMO_PARTNER_CODE}`,
      `requestId=${requestId}`,
    ].join('&');

    const signature = crypto.createHmac('sha256', MOMO_SECRET_KEY).update(rawSignature).digest('hex');

    const body = {
      partnerCode: MOMO_PARTNER_CODE,
      requestId,
      orderId: payment.order_id,
      signature,
      lang: 'vi',
    };

    const res = await axios.post(`${MOMO_ENDPOINT}/query`, body);
    const resultCode = res.data?.resultCode;

    if (resultCode === 0) {
      return { status: 'completed', transactionId: res.data.transId?.toString() };
    }
    if (resultCode === 1000 || resultCode === 1001 || resultCode === 1002) {
      return { status: 'pending' };
    }
    return { status: 'failed', error: res.data?.message || `resultCode: ${resultCode}` };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'MoMo status check failed' };
  }
}

/**
 * Query ZaloPay for a payment's actual status.
 */
async function checkZaloPayStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  try {
    const appTransId = payment.provider_transaction_id || payment.order_id;
    const macData = `${ZALOPAY_APP_ID}|${appTransId}|${ZALOPAY_KEY1}`;
    const mac = crypto.createHmac('sha256', ZALOPAY_KEY1).update(macData).digest('hex');

    const res = await axios.post(`${ZALOPAY_ENDPOINT}/query`, {
      app_id: parseInt(ZALOPAY_APP_ID),
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

/**
 * Query payOS for a payment's actual status.
 */
async function checkPayOSStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  try {
    const orderCode = payment.provider_transaction_id || payment.order_id;

    const res = await axios.get(`https://api-merchant.payos.vn/v2/payment-requests/${orderCode}`, {
      headers: {
        'x-client-id': PAYOS_CLIENT_ID,
        'x-api-key': PAYOS_API_KEY,
        'Content-Type': 'application/json',
      },
    });

    const data = res.data?.data || res.data || {};
    const providerStatus = (data.status || '').toUpperCase();

    if (providerStatus === 'PAID' || providerStatus === 'COMPLETED') {
      return { status: 'completed', transactionId: data.id?.toString() || data.orderCode?.toString() };
    }
    if (providerStatus === 'CANCELLED' || providerStatus === 'EXPIRED') {
      return { status: 'failed', error: providerStatus };
    }
    return { status: 'pending' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'payOS status check failed' };
  }
}

/**
 * Query Stripe for a payment's actual status.
 */
async function checkStripeStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  try {
    if (!STRIPE_SECRET_KEY) return { status: 'unknown', error: 'Stripe not configured' };

    const Stripe = require('stripe');
    const stripe = new Stripe(STRIPE_SECRET_KEY);

    // If we have a payment intent ID, check it directly
    if (payment.provider_transaction_id) {
      const intent = await stripe.paymentIntents.retrieve(payment.provider_transaction_id);

      if (intent.status === 'succeeded') {
        return { status: 'completed', transactionId: intent.id };
      }
      if (intent.status === 'canceled' || intent.status === 'requires_payment_method') {
        return { status: 'failed', error: intent.status };
      }
      return { status: 'pending' };
    }

    // Otherwise try to find by metadata.orderId via checkout sessions
    const sessions = await stripe.checkout.sessions.list({
      limit: 1,
      expand: ['data.payment_intent'],
    });

    // If no provider transaction ID and no session found, status unknown
    return { status: 'unknown', error: 'No provider_transaction_id to query' };
  } catch (err: any) {
    return { status: 'unknown', error: err.message || 'Stripe status check failed' };
  }
}

// ─── Provider Dispatch ────────────────────────────────────────────────────────

/**
 * Route status check to the appropriate provider.
 */
async function checkProviderStatus(payment: IPayment & { _id: any }): Promise<ProviderStatusResult> {
  switch (payment.method) {
    case 'sepay':
      return checkSepayStatus(payment);
    case 'momo':
      return checkMoMoStatus(payment);
    case 'zalopay':
      return checkZaloPayStatus(payment);
    case 'payos':
      return checkPayOSStatus(payment);
    case 'stripe':
      return checkStripeStatus(payment);
    default:
      return { status: 'unknown', error: `Unsupported provider: ${payment.method}` };
  }
}

// ─── Webhook Trigger ──────────────────────────────────────────────────────────

/**
 * Notify the product service that a payment has been reconciled.
 */
async function triggerWebhook(payment: IPayment & { _id: any }, newStatus: string): Promise<void> {
  if (!WEBHOOK_INTERNAL_URL) return;

  try {
    await axios.post(WEBHOOK_INTERNAL_URL, {
      event: 'payment.reconciled',
      order_id: payment.order_id,
      product: payment.product,
      user_id: payment.user_id,
      status: newStatus,
      amount: payment.amount,
      method: payment.method,
      reconciled_at: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error(`[Reconciliation] Webhook failed for ${payment.order_id}:`, err.message);
  }
}

// ─── Admin Alert ──────────────────────────────────────────────────────────────

/**
 * Alert admin when a payment has been pending for too long (> 2 hours).
 */
function alertAdmin(payment: IPayment & { _id: any }): void {
  const ageMinutes = Math.round((Date.now() - new Date(payment.created_at).getTime()) / 60000);
  console.warn(
    `[Reconciliation] ⚠️ ADMIN ALERT — Payment ${payment.order_id} stuck pending for ${ageMinutes} minutes.` +
    `  Method: ${payment.method}, Amount: ${payment.amount} ${payment.currency}, Product: ${payment.product}`
  );
  // In production:  send to Slack/Telegram/Email via notification-service
}

// ─── Core Reconciliation Logic ────────────────────────────────────────────────

/**
 * Run a single reconciliation pass:
 * Find stuck pending payments and check their actual status with providers.
 */
export async function reconcile(): Promise<ReconciliationResult> {
  const result: ReconciliationResult = {
    processed: 0,
    updated: 0,
    alerts: 0,
    errors: [],
  };

  const cutoffTime = new Date(Date.now() - STUCK_THRESHOLD_MS);

  // Find payments that are pending and older than 30 minutes
  const stuckPayments = await Payment.find({
    status: 'pending',
    created_at: { $lt: cutoffTime },
  }).lean();

  result.processed = stuckPayments.length;

  if (stuckPayments.length === 0) {
    console.log('[Reconciliation] No stuck payments found.');
    return result;
  }

  console.log(`[Reconciliation] Found ${stuckPayments.length} stuck payment(s). Checking providers...`);

  for (const payment of stuckPayments) {
    try {
      const providerResult = await checkProviderStatus(payment as any);

      if (providerResult.status === 'completed') {
        // Provider confirms payment completed — update our record
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: 'completed',
              confirmed_by: 'reconciliation',
              confirmed_at: new Date(),
              provider_transaction_id: providerResult.transactionId || payment.provider_transaction_id,
            },
          }
        );
        result.updated++;
        console.log(`[Reconciliation] ✅ ${payment.order_id} marked completed (confirmed by ${payment.method})`);

        // Trigger webhook to notify product service
        await triggerWebhook(payment as any, 'completed');

      } else if (providerResult.status === 'failed') {
        // Provider confirms payment failed — update our record
        await Payment.updateOne(
          { _id: payment._id },
          {
            $set: {
              status: 'failed',
              metadata: {
                ...(payment.metadata || {}),
                reconciliation_failure_reason: providerResult.error,
                reconciled_at: new Date().toISOString(),
              },
            },
          }
        );
        result.updated++;
        console.log(`[Reconciliation] ❌ ${payment.order_id} marked failed (reason: ${providerResult.error})`);

      } else if (providerResult.status === 'pending') {
        // Still pending — check if > 2 hours (admin alert threshold)
        const paymentAge = Date.now() - new Date(payment.created_at).getTime();
        if (paymentAge > ADMIN_ALERT_THRESHOLD_MS) {
          alertAdmin(payment as any);
          result.alerts++;
        }

      } else {
        // Unknown status — log error but don't change payment
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

// ─── Scheduler ────────────────────────────────────────────────────────────────

let reconciliationTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start the reconciliation job on a 30-minute interval.
 * Safe to call multiple times — will not create duplicate timers.
 */
export function startReconciliation(): void {
  if (reconciliationTimer) {
    console.log('[Reconciliation] Already running.');
    return;
  }

  console.log('[Reconciliation] Starting scheduled job (every 30 minutes)...');

  // Run immediately on start
  reconcile().catch((err) => {
    console.error('[Reconciliation] Initial run failed:', err.message);
  });

  // Then run every 30 minutes
  reconciliationTimer = setInterval(() => {
    reconcile().catch((err) => {
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
