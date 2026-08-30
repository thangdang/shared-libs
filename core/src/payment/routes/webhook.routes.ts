/**
 * Webhook Routes Factory — Receive payment confirmations from providers
 */
import { Router, Request, Response } from 'express';
import express from 'express';
import type { Model } from 'mongoose';
import type { IPayment, PaymentConfig } from '../types.js';
import { verifySepayWebhook, verifySepaySignature } from '../providers/sepay.js';
import { verifyMoMoWebhook } from '../providers/momo.js';
import { verifyZaloPayCallback } from '../providers/zalopay.js';
import { verifyPayOSWebhook } from '../providers/payos.js';
import { verifyStripeWebhook } from '../providers/stripe.js';
import { WebhookTracker } from '../webhook-tracker.js';
import axios from 'axios';

export interface WebhookRoutesConfig {
  /** Payment model from the app */
  paymentModel: Model<IPayment>;
  /** Payment provider configuration */
  config: PaymentConfig;
  /** Webhook tracker instance (optional) */
  webhookTracker?: WebhookTracker;
  /** Callback to execute after payment completion */
  onPaymentCompleted?: (payment: IPayment) => Promise<void>;
}

/**
 * Create webhook routes with the provided configuration.
 */
export function createWebhookRoutes(routeConfig: WebhookRoutesConfig): Router {
  const router = Router();
  const { paymentModel, config } = routeConfig;
  const tracker = routeConfig.webhookTracker || new WebhookTracker();

  async function notifyProductService(payment: IPayment): Promise<void> {
    // Custom callback
    if (routeConfig.onPaymentCompleted) {
      await routeConfig.onPaymentCompleted(payment);
      return;
    }

    // Default: call product internal URL
    const url = config.productUrls?.[payment.product];
    if (!url) return;

    try {
      await axios.post(
        `${url}/internal/payment-completed`,
        {
          userId: payment.user_id,
          plan: payment.plan,
          orderId: payment.order_id,
          method: payment.method,
          amount: payment.amount,
        },
        { timeout: 5000 }
      );
    } catch (err: any) {
      console.error(`[Webhook] Failed to notify ${payment.product}:`, err.message);
    }
  }

  /**
   * POST /sepay — SePay IPN/Webhook callback
   */
  router.post('/sepay', async (req: Request, res: Response) => {
    try {
      const signature = req.headers['x-sepay-signature'] as string;
      if (signature && config.sepay && !verifySepaySignature(req.body, signature, config.sepay.secretKey)) {
        tracker.recordFailure('sepay', 'Invalid HMAC signature');
        res.status(400).json({ success: false });
        return;
      }

      const { valid, orderId, success, transId } = verifySepayWebhook(req.body);
      if (!valid) {
        tracker.recordFailure('sepay', 'Invalid webhook payload');
        res.json({ success: true });
        return;
      }

      let payment = await paymentModel.findOne({ order_id: orderId, status: 'pending' });
      if (!payment) {
        payment = await paymentModel.findOne({ 'metadata.order_code': orderId, status: 'pending' });
      }
      if (!payment) {
        res.json({ success: true });
        return;
      }

      if (success) {
        payment.status = 'completed';
        payment.provider_transaction_id = transId;
        await payment.save();
        await notifyProductService(payment);
      } else {
        payment.status = 'failed';
        await payment.save();
      }

      tracker.recordSuccess('sepay');
      res.json({ success: true });
    } catch (error: any) {
      tracker.recordFailure('sepay', error?.message || 'Unknown error');
      res.json({ success: true });
    }
  });

  /**
   * POST /momo — MoMo IPN callback
   */
  router.post('/momo', async (req: Request, res: Response) => {
    try {
      if (!config.momo) {
        res.status(500).json({ error: 'MoMo not configured' });
        return;
      }

      const { valid, orderId, success, transId } = verifyMoMoWebhook(req.body, config.momo);
      if (!valid) {
        tracker.recordFailure('momo', 'Invalid signature');
        res.status(400).json({ error: 'Invalid signature' });
        return;
      }

      const payment = await paymentModel.findOne({ order_id: orderId });
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      if (success) {
        payment.status = 'completed';
        payment.provider_transaction_id = transId;
        await payment.save();
        await notifyProductService(payment);
      } else {
        payment.status = 'failed';
        await payment.save();
      }

      tracker.recordSuccess('momo');
      res.json({ success: true });
    } catch (error: any) {
      tracker.recordFailure('momo', error?.message || 'Unknown error');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /zalopay — ZaloPay callback
   */
  router.post('/zalopay', async (req: Request, res: Response) => {
    try {
      if (!config.zalopay) {
        res.json({ return_code: 2, return_message: 'ZaloPay not configured' });
        return;
      }

      const { valid, orderId, success, transId } = verifyZaloPayCallback(req.body, config.zalopay);
      if (!valid) {
        tracker.recordFailure('zalopay', 'Invalid mac');
        res.json({ return_code: 2, return_message: 'Invalid mac' });
        return;
      }

      const payment = await paymentModel.findOne({ 'metadata.app_trans_id': orderId });
      if (!payment) {
        res.json({ return_code: 2, return_message: 'Order not found' });
        return;
      }

      if (success) {
        payment.status = 'completed';
        payment.provider_transaction_id = transId;
        await payment.save();
        await notifyProductService(payment);
      }

      tracker.recordSuccess('zalopay');
      res.json({ return_code: 1, return_message: 'success' });
    } catch (error: any) {
      tracker.recordFailure('zalopay', error?.message || 'Unknown error');
      res.json({ return_code: 0, return_message: 'Error' });
    }
  });

  /**
   * POST /payos — payOS webhook
   */
  router.post('/payos', async (req: Request, res: Response) => {
    try {
      const { valid, orderId, success, transId } = verifyPayOSWebhook(req.body);
      if (!valid) {
        tracker.recordFailure('payos', 'Invalid webhook');
        res.status(400).json({ error: 'Invalid webhook' });
        return;
      }

      const payment = await paymentModel.findOne({
        'metadata.order_code': parseInt(orderId),
        status: 'pending',
      });
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      if (success) {
        payment.status = 'completed';
        payment.provider_transaction_id = transId;
        await payment.save();
        await notifyProductService(payment);
      }

      tracker.recordSuccess('payos');
      res.json({ success: true });
    } catch (error: any) {
      tracker.recordFailure('payos', error?.message || 'Unknown error');
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  /**
   * POST /stripe — Stripe webhook
   */
  router.post(
    '/stripe',
    express.raw({ type: 'application/json' }),
    async (req: Request, res: Response) => {
      try {
        if (!config.stripe) {
          res.status(500).json({ error: 'Stripe not configured' });
          return;
        }

        const signature = req.headers['stripe-signature'] as string;
        const { valid, orderId, success, transId } = await verifyStripeWebhook(
          req.body,
          signature,
          config.stripe
        );

        if (!valid) {
          tracker.recordFailure('stripe', 'Invalid signature');
          res.status(400).json({ error: 'Invalid signature' });
          return;
        }

        const payment = await paymentModel.findOne({ order_id: orderId });
        if (!payment) {
          res.status(404).json({ error: 'Payment not found' });
          return;
        }

        if (success) {
          payment.status = 'completed';
          payment.provider_transaction_id = transId;
          await payment.save();
          await notifyProductService(payment);
        }

        tracker.recordSuccess('stripe');
        res.json({ received: true });
      } catch (error: any) {
        tracker.recordFailure('stripe', error?.message || 'Unknown error');
        res.status(500).json({ error: 'Webhook processing failed' });
      }
    }
  );

  /**
   * GET /health — Webhook health status
   */
  router.get('/health', (_req: Request, res: Response) => {
    const status = tracker.getHealthStatus();
    const httpStatus = status.overall === 'healthy' ? 200 : 503;
    res.status(httpStatus).json(status);
  });

  return router;
}
