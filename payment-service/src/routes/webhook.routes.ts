/**
 * Webhook Routes — Receive payment confirmations from providers
 * These are called by MoMo/ZaloPay/payOS/Stripe servers
 */
import { Router, Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { verifyMoMoWebhook } from '../providers/momo';
import { verifyZaloPayCallback } from '../providers/zalopay';
import { verifyPayOSWebhook } from '../providers/payos';
import { verifySepayWebhook, verifySepaySignature } from '../providers/sepay';
import { verifyStripeWebhook } from '../providers/stripe';
import { webhookTracker } from '../webhook-tracker';
import axios from 'axios';

const router = Router();

// Callback URLs for product services (to notify subscription activation)
const PRODUCT_CALLBACK_URLS: Record<string, string> = {
  trendbriefai: 'http://localhost:4002/internal/payment-completed',
  smartbuy: 'http://localhost:4001/internal/payment-completed',
  caremate: 'http://localhost:4003/internal/payment-completed',
  fintax: 'http://localhost:4004/internal/payment-completed',
};

async function notifyProductService(payment: any): Promise<void> {
  const url = PRODUCT_CALLBACK_URLS[payment.product];
  if (!url) return;

  try {
    await axios.post(url, {
      userId: payment.user_id,
      plan: payment.plan,
      orderId: payment.order_id,
      method: payment.method,
      amount: payment.amount,
    }, { timeout: 5000 });
  } catch (err: any) {
    console.error(`[Webhook] Failed to notify ${payment.product}:`, err.message);
  }
}

/**
 * POST /api/payment/webhook/sepay — SePay IPN/Webhook callback
 */
router.post('/sepay', async (req: Request, res: Response) => {
  try {
    // Verify HMAC signature if provided
    const signature = req.headers['x-sepay-signature'] as string;
    if (signature && !verifySepaySignature(req.body, signature)) {
      webhookTracker.recordFailure('sepay', 'Invalid HMAC signature');
      res.status(400).json({ success: false });
      return;
    }

    const { valid, orderId, success, transId, amount } = verifySepayWebhook(req.body);
    if (!valid) {
      webhookTracker.recordFailure('sepay', 'Invalid webhook payload');
      res.json({ success: true }); // Return 200 to avoid retries
      return;
    }

    // Try to find payment by order_id or by metadata.order_code
    let payment = await Payment.findOne({ order_id: orderId, status: 'pending' });
    if (!payment) {
      payment = await Payment.findOne({ 'metadata.order_code': orderId, status: 'pending' });
    }
    if (!payment) {
      // Payment code from bank transfer content
      payment = await Payment.findOne({ order_id: { $regex: orderId }, status: 'pending' });
    }
    if (!payment) { res.json({ success: true }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    } else {
      payment.status = 'failed';
      await payment.save();
    }

    webhookTracker.recordSuccess('sepay');
    res.json({ success: true });
  } catch (error: any) {
    webhookTracker.recordFailure('sepay', error?.message || 'Unknown error');
    console.error('[Webhook] SePay error:', error);
    res.json({ success: true }); // Always return 200 to SePay
  }
});

/**
 * POST /api/payment/webhook/momo — MoMo IPN callback
 */
router.post('/momo', async (req: Request, res: Response) => {
  try {
    const { valid, orderId, success, transId } = verifyMoMoWebhook(req.body);
    if (!valid) {
      webhookTracker.recordFailure('momo', 'Invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    } else {
      payment.status = 'failed';
      await payment.save();
    }

    webhookTracker.recordSuccess('momo');
    res.json({ success: true });
  } catch (error: any) {
    webhookTracker.recordFailure('momo', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payment/webhook/zalopay — ZaloPay callback
 */
router.post('/zalopay', async (req: Request, res: Response) => {
  try {
    const { valid, appTransId, success, transId } = verifyZaloPayCallback(req.body);
    if (!valid) {
      webhookTracker.recordFailure('zalopay', 'Invalid mac');
      res.json({ return_code: 2, return_message: 'Invalid mac' });
      return;
    }

    const payment = await Payment.findOne({ 'metadata.app_trans_id': appTransId });
    if (!payment) { res.json({ return_code: 2, return_message: 'Order not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    webhookTracker.recordSuccess('zalopay');
    res.json({ return_code: 1, return_message: 'success' });
  } catch (error: any) {
    webhookTracker.recordFailure('zalopay', error?.message || 'Unknown error');
    res.json({ return_code: 0, return_message: 'Error' });
  }
});

/**
 * POST /api/payment/webhook/payos — payOS webhook
 */
router.post('/payos', async (req: Request, res: Response) => {
  try {
    const { valid, orderCode, success, transId } = verifyPayOSWebhook(req.body);
    if (!valid) {
      webhookTracker.recordFailure('payos', 'Invalid webhook');
      res.status(400).json({ error: 'Invalid webhook' });
      return;
    }

    const payment = await Payment.findOne({ 'metadata.order_code': orderCode, status: 'pending' });
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    webhookTracker.recordSuccess('payos');
    res.json({ success: true });
  } catch (error: any) {
    webhookTracker.recordFailure('payos', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payment/webhook/stripe — Stripe webhook
 */
router.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  try {
    const signature = req.headers['stripe-signature'] as string;
    const { valid, orderId, success, transId, metadata } = verifyStripeWebhook(req.body, signature);
    if (!valid) {
      webhookTracker.recordFailure('stripe', 'Invalid signature');
      res.status(400).json({ error: 'Invalid signature' });
      return;
    }

    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    webhookTracker.recordSuccess('stripe');
    res.json({ received: true });
  } catch (error: any) {
    webhookTracker.recordFailure('stripe', error?.message || 'Unknown error');
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Need to import express for raw body parser
import express from 'express';

/**
 * GET /api/payment/webhook/health — Webhook health status dashboard
 * Returns consecutive failure counts and health status per provider
 */
router.get('/health', (req: Request, res: Response) => {
  const status = webhookTracker.getHealthStatus();
  const httpStatus = status.overall === 'healthy' ? 200 : 503;
  res.status(httpStatus).json(status);
});

export { router as webhookRoutes };
