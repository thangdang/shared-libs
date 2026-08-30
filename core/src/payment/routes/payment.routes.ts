/**
 * Payment Routes Factory — Create payments for any product
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import type { Model } from 'mongoose';
import type { IPayment, PaymentConfig, CreatePaymentInput } from '../types.js';
import { createSepayPayment } from '../providers/sepay.js';
import { createMoMoPayment } from '../providers/momo.js';
import { createZaloPayPayment } from '../providers/zalopay.js';
import { createPayOSPayment } from '../providers/payos.js';
import { createStripeCheckout } from '../providers/stripe.js';
import { processProviderRefund } from '../providers/refund.js';
import { PRODUCT_PLANS } from '../plans.js';
import axios from 'axios';

export interface PaymentRoutesConfig {
  /** Payment model from the app */
  paymentModel: Model<IPayment>;
  /** Payment provider configuration */
  config: PaymentConfig;
  /** Product identifier for this app */
  product?: string;
}

function generateOrderId(product: string): string {
  const prefix: Record<string, string> = {
    trendbriefai: 'TB',
    smartbuy: 'SB',
    fintax: 'FT',
    caremate: 'CM',
    doctorcar: 'DC',
    childhood: 'CH',
  };
  return `${prefix[product] || 'TX'}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create payment routes with the provided configuration.
 */
export function createPaymentRoutes(routeConfig: PaymentRoutesConfig): Router {
  const router = Router();
  const { paymentModel, config } = routeConfig;

  /**
   * POST /create — Create a payment
   */
  router.post('/create', async (req: Request, res: Response) => {
    try {
      const {
        product,
        userId,
        plan,
        method,
        amount,
        description,
        email,
      }: CreatePaymentInput = req.body;

      if (!product || !userId || !plan || !method || !amount) {
        res.status(400).json({
          error: 'Missing required fields: product, userId, plan, method, amount',
        });
        return;
      }

      const orderId = generateOrderId(product);
      let paymentResult: any = {};

      switch (method) {
        case 'sepay':
          if (!config.sepay) throw new Error('SePay not configured');
          const sepayResult = await createSepayPayment(
            orderId,
            amount,
            description || `${product} - ${plan}`,
            config.sepay
          );
          paymentResult = {
            payUrl: sepayResult.checkoutUrl,
            qrCode: sepayResult.qrCode,
          };
          paymentResult.metadata = { order_code: sepayResult.orderCode };
          break;

        case 'momo':
          if (!config.momo) throw new Error('MoMo not configured');
          paymentResult = await createMoMoPayment(
            orderId,
            amount,
            description || `${product} - ${plan}`,
            config.momo
          );
          break;

        case 'zalopay':
          if (!config.zalopay) throw new Error('ZaloPay not configured');
          const zaloResult = await createZaloPayPayment(
            orderId,
            amount,
            userId,
            description || `${product} - ${plan}`,
            config.zalopay
          );
          paymentResult = { payUrl: zaloResult.payUrl };
          paymentResult.metadata = { app_trans_id: zaloResult.appTransId };
          break;

        case 'payos':
          if (!config.payos) throw new Error('payOS not configured');
          const payosResult = await createPayOSPayment(
            orderId,
            amount,
            description || `${product} - ${plan}`,
            config.payos
          );
          paymentResult = {
            payUrl: payosResult.checkoutUrl,
            qrCode: payosResult.qrCode,
          };
          paymentResult.metadata = { order_code: payosResult.orderCode };
          break;

        case 'stripe':
          if (!config.stripe) throw new Error('Stripe not configured');
          if (!email) {
            res.status(400).json({ error: 'Email required for Stripe' });
            return;
          }
          const stripeResult = await createStripeCheckout(
            orderId,
            amount,
            description || `${product} - ${plan}`,
            email,
            { product, userId, plan },
            config.stripe
          );
          paymentResult = {
            payUrl: stripeResult.url,
            sessionId: stripeResult.sessionId,
          };
          paymentResult.metadata = { stripe_session_id: stripeResult.sessionId };
          break;

        default:
          res.status(400).json({
            error: `Invalid method: ${method}. Use: sepay, momo, zalopay, payos, stripe`,
          });
          return;
      }

      await paymentModel.create({
        product,
        user_id: userId,
        order_id: orderId,
        amount,
        method,
        plan,
        status: 'pending',
        metadata: paymentResult.metadata || {},
      });

      res.json({
        success: true,
        orderId,
        payUrl: paymentResult.payUrl,
        qrCode: paymentResult.qrCode,
      });
    } catch (error: any) {
      console.error('[Payment] Create failed:', error.message);
      res.status(500).json({ error: 'Payment creation failed', detail: error.message });
    }
  });

  /**
   * GET /status/:orderId — Check payment status
   */
  router.get('/status/:orderId', async (req: Request, res: Response) => {
    try {
      const payment = await paymentModel
        .findOne({ order_id: req.params.orderId })
        .lean();
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }
      res.json({ payment });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payment' });
    }
  });

  /**
   * GET /user/:userId — Get user's payment history
   */
  router.get('/user/:userId', async (req: Request, res: Response) => {
    try {
      const payments = await paymentModel
        .find({ user_id: req.params.userId })
        .sort({ created_at: -1 })
        .limit(20)
        .lean();
      res.json({ payments });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  /**
   * GET /plans/:product — Get available plans for a product
   */
  router.get('/plans/:product', (req: Request, res: Response) => {
    const plans = PRODUCT_PLANS[req.params.product];
    if (!plans) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }
    res.json({ plans, currency: 'VND', methods: ['sepay', 'momo', 'stripe'] });
  });

  /**
   * POST /refund/:orderId — Refund a completed payment
   */
  router.post('/refund/:orderId', async (req: Request, res: Response) => {
    try {
      const { orderId } = req.params;
      const { amount, reason } = req.body;

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        res.status(400).json({ error: 'Missing required field: reason' });
        return;
      }

      const payment = await paymentModel.findOne({ order_id: orderId });
      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      if (payment.status !== 'completed') {
        res.status(400).json({
          error: `Cannot refund payment with status '${payment.status}'`,
        });
        return;
      }

      const refundAmount = amount && amount > 0 ? amount : payment.amount;

      if (refundAmount > payment.amount) {
        res.status(400).json({
          error: `Refund amount (${refundAmount}) exceeds original payment amount (${payment.amount})`,
        });
        return;
      }

      const refundResult = await processProviderRefund(
        payment.method,
        {
          orderId,
          amount: refundAmount,
          reason: reason.trim(),
          providerTransactionId: payment.provider_transaction_id,
          metadata: payment.metadata,
        },
        config
      );

      if (!refundResult.success) {
        res.status(502).json({
          error: 'Refund failed at provider',
          detail: refundResult.error,
          provider: refundResult.provider,
        });
        return;
      }

      const isFullRefund = refundAmount >= payment.amount;
      const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

      await paymentModel.updateOne(
        { order_id: orderId },
        {
          $set: {
            status: newStatus,
            'metadata.refund_id': refundResult.refundId,
            'metadata.refund_amount': refundAmount,
            'metadata.refund_reason': reason.trim(),
            'metadata.refunded_at': new Date().toISOString(),
          },
        }
      );

      // Notify product service (fire-and-forget)
      const productUrl = config.productUrls?.[payment.product];
      if (productUrl) {
        axios
          .post(
            `${productUrl}/internal/payment-refunded`,
            {
              orderId,
              userId: payment.user_id,
              product: payment.product,
              refundAmount,
              originalAmount: payment.amount,
              status: newStatus,
              reason: reason.trim(),
            },
            { timeout: 5000 }
          )
          .catch(() => {});
      }

      res.json({
        success: true,
        orderId,
        refundId: refundResult.refundId,
        refundAmount,
        status: newStatus,
      });
    } catch (error: any) {
      console.error('[Payment] Refund failed:', error.message);
      res.status(500).json({ error: 'Refund processing failed', detail: error.message });
    }
  });

  return router;
}
