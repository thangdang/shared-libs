/**
 * Webhook Routes — Receive payment confirmations from providers
 * These are called by MoMo/ZaloPay/payOS/Stripe servers
 */
import { Router, Request, Response } from 'express';
import { Payment } from '../models/Payment';
import { verifyMoMoWebhook } from '../providers/momo';
import { verifyZaloPayCallback } from '../providers/zalopay';
import { verifyPayOSWebhook } from '../providers/payos';
import { verifyStripeWebhook } from '../providers/stripe';
import axios from 'axios';

const router = Router();

// Callback URLs for product services (to notify subscription activation)
const PRODUCT_CALLBACK_URLS: Record<string, string> = {
  trendbriefai: 'http://localhost:3000/internal/payment-completed',
  smartbuy: 'http://localhost:3001/internal/payment-completed',
  caremate: 'http://localhost:3002/internal/payment-completed',
  fintax: 'http://localhost:3003/internal/payment-completed',
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
 * POST /api/payment/webhook/momo — MoMo IPN callback
 */
router.post('/momo', async (req: Request, res: Response) => {
  try {
    const { valid, orderId, success, transId } = verifyMoMoWebhook(req.body);
    if (!valid) { res.status(400).json({ error: 'Invalid signature' }); return; }

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

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

/**
 * POST /api/payment/webhook/zalopay — ZaloPay callback
 */
router.post('/zalopay', async (req: Request, res: Response) => {
  try {
    const { valid, appTransId, success, transId } = verifyZaloPayCallback(req.body);
    if (!valid) { res.json({ return_code: 2, return_message: 'Invalid mac' }); return; }

    const payment = await Payment.findOne({ 'metadata.app_trans_id': appTransId });
    if (!payment) { res.json({ return_code: 2, return_message: 'Order not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    res.json({ return_code: 1, return_message: 'success' });
  } catch (error) {
    res.json({ return_code: 0, return_message: 'Error' });
  }
});

/**
 * POST /api/payment/webhook/payos — payOS webhook
 */
router.post('/payos', async (req: Request, res: Response) => {
  try {
    const { valid, orderCode, success, transId } = verifyPayOSWebhook(req.body);
    if (!valid) { res.status(400).json({ error: 'Invalid webhook' }); return; }

    const payment = await Payment.findOne({ 'metadata.order_code': orderCode, status: 'pending' });
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    res.json({ success: true });
  } catch (error) {
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
    if (!valid) { res.status(400).json({ error: 'Invalid signature' }); return; }

    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }

    if (success) {
      payment.status = 'completed';
      payment.provider_transaction_id = transId;
      await payment.save();
      await notifyProductService(payment);
    }

    res.json({ received: true });
  } catch (error) {
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

// Need to import express for raw body parser
import express from 'express';

export { router as webhookRoutes };
