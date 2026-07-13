/**
 * Payment Routes — Create payments for any product
 * Called by product services internally (localhost:4101)
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { Payment } from '../models/Payment';
import { createMoMoPayment } from '../providers/momo';
import { createZaloPayPayment } from '../providers/zalopay';
import { createPayOSPayment } from '../providers/payos';
import { createSepayPayment } from '../providers/sepay';
import { createStripeCheckout } from '../providers/stripe';
import { processProviderRefund } from '../providers/refund';

const router = Router();

function generateOrderId(product: string): string {
  const prefix = { trendbriefai: 'TB', smartbuy: 'SB', fintax: 'FT', caremate: 'CM' }[product] || 'TX';
  return `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * POST /api/payment/create — Create a payment
 * Body: { product, userId, plan, method, amount, description, email? }
 */
router.post('/create', async (req: Request, res: Response) => {
  try {
    const { product, userId, plan, method, amount, description, email } = req.body;

    if (!product || !userId || !plan || !method || !amount) {
      res.status(400).json({ error: 'Missing required fields: product, userId, plan, method, amount' });
      return;
    }

    const orderId = generateOrderId(product);
    let paymentResult: any = {};

    switch (method) {
      case 'sepay':
        const sepayResult = await createSepayPayment(orderId, amount, description || `${product} - ${plan}`);
        paymentResult = { payUrl: sepayResult.checkoutUrl, qrCode: sepayResult.qrCode };
        paymentResult.metadata = { order_code: sepayResult.orderCode };
        break;

      case 'momo':
        paymentResult = await createMoMoPayment(orderId, amount, description || `${product} - ${plan}`);
        break;

      case 'zalopay':
        const zaloResult = await createZaloPayPayment(orderId, amount, userId, description || `${product} - ${plan}`);
        paymentResult = { payUrl: zaloResult.payUrl };
        // Store appTransId for webhook matching
        paymentResult.metadata = { app_trans_id: zaloResult.appTransId };
        break;

      case 'payos':
        const payosResult = await createPayOSPayment(orderId, amount, description || `${product} - ${plan}`);
        paymentResult = { payUrl: payosResult.checkoutUrl, qrCode: payosResult.qrCode };
        paymentResult.metadata = { order_code: payosResult.orderCode };
        break;

      case 'stripe':
        if (!email) { res.status(400).json({ error: 'Email required for Stripe' }); return; }
        const stripeResult = await createStripeCheckout(orderId, amount, description || `${product} - ${plan}`, email, { product, userId, plan });
        paymentResult = { payUrl: stripeResult.url, sessionId: stripeResult.sessionId };
        paymentResult.metadata = { stripe_session_id: stripeResult.sessionId };
        break;

      default:
        res.status(400).json({ error: `Invalid method: ${method}. Use: sepay, momo, zalopay, payos, stripe` });
        return;
    }

    // Store payment record
    await Payment.create({
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
 * GET /api/payment/status/:orderId — Check payment status
 */
router.get('/status/:orderId', async (req: Request, res: Response) => {
  try {
    const payment = await Payment.findOne({ order_id: req.params.orderId }).lean();
    if (!payment) { res.status(404).json({ error: 'Payment not found' }); return; }
    res.json({ payment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payment' });
  }
});

/**
 * GET /api/payment/user/:userId — Get user's payment history
 */
router.get('/user/:userId', async (req: Request, res: Response) => {
  try {
    const payments = await Payment.find({ user_id: req.params.userId })
      .sort({ created_at: -1 })
      .limit(20)
      .lean();
    res.json({ payments });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

/**
 * GET /api/payment/plans/:product — Get available plans for a product
 */
router.get('/plans/:product', (req: Request, res: Response) => {
  const PRODUCT_PLANS: Record<string, any[]> = {
    trendbriefai: [
      { id: 'pro_monthly', price: 49000, durationDays: 30, label: 'Pro Monthly' },
      { id: 'pro_yearly', price: 399000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
    ],
    smartbuy: [
      { id: 'pro_monthly', price: 79000, durationDays: 30, label: 'Pro Monthly' },
      { id: 'pro_yearly', price: 649000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
    ],
    fintax: [
      { id: 'pro_monthly', price: 99000, durationDays: 30, label: 'Pro Monthly' },
      { id: 'pro_yearly', price: 950000, durationDays: 365, label: 'Pro Yearly (save 20%)' },
      { id: 'seller_pro_monthly', price: 199000, durationDays: 30, label: 'Seller Pro Monthly' },
      { id: 'seller_pro_yearly', price: 1900000, durationDays: 365, label: 'Seller Pro Yearly (save 20%)' },
    ],
    caremate: [
      { id: 'pro_monthly', price: 49000, durationDays: 30, label: 'Pro Monthly' },
      { id: 'pro_yearly', price: 399000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
    ],
    bundle: [
      { id: 'bundle_monthly', price: 149000, durationDays: 30, label: 'All Products Pro Monthly (save 40%)' },
      { id: 'bundle_yearly', price: 1290000, durationDays: 365, label: 'All Products Pro Yearly (save 55%)' },
    ],
  };

  const plans = PRODUCT_PLANS[req.params.product];
  if (!plans) { res.status(404).json({ error: 'Product not found' }); return; }
  res.json({ plans, currency: 'VND', methods: ['sepay', 'momo', 'stripe'] });
});

/**
 * POST /api/payment/refund/:orderId — Refund a completed payment (full or partial)
 * Body: { amount?: number, reason: string }
 *
 * Flow:
 * 1. Validate order exists, status == 'completed'
 * 2. If amount not specified → full refund
 * 3. Call provider refund API (sepay/momo/stripe/payos/zalopay)
 * 4. Update payment status → 'refunded' or 'partially_refunded'
 * 5. Notify product service → POST /internal/payment-refunded
 */
router.post('/refund/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const { amount, reason } = req.body;

    // Validate reason is provided
    if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
      res.status(400).json({ error: 'Missing required field: reason' });
      return;
    }

    // Find payment by orderId
    const payment = await Payment.findOne({ order_id: orderId });
    if (!payment) {
      res.status(404).json({ error: 'Payment not found' });
      return;
    }

    // Validate payment status — only completed payments can be refunded
    if (payment.status !== 'completed') {
      res.status(400).json({
        error: `Cannot refund payment with status '${payment.status}'. Only completed payments can be refunded.`,
      });
      return;
    }

    // Determine refund amount (full or partial)
    const refundAmount = amount && amount > 0 ? amount : payment.amount;

    // Validate refund amount doesn't exceed original payment
    if (refundAmount > payment.amount) {
      res.status(400).json({
        error: `Refund amount (${refundAmount}) exceeds original payment amount (${payment.amount})`,
      });
      return;
    }

    // Validate partial amount is positive
    if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
      res.status(400).json({ error: 'Refund amount must be a positive number' });
      return;
    }

    // Call provider refund API
    const refundResult = await processProviderRefund(payment.method, {
      orderId,
      amount: refundAmount,
      reason: reason.trim(),
      providerTransactionId: payment.provider_transaction_id,
      metadata: payment.metadata,
    });

    if (!refundResult.success) {
      res.status(502).json({
        error: 'Refund failed at provider',
        detail: refundResult.error,
        provider: refundResult.provider,
      });
      return;
    }

    // Determine new status: full refund or partial refund
    const isFullRefund = refundAmount >= payment.amount;
    const newStatus = isFullRefund ? 'refunded' : 'partially_refunded';

    // Update payment record
    await Payment.updateOne(
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

    // Notify product service about the refund (fire-and-forget)
    notifyProductServiceRefund(payment.product, {
      orderId,
      userId: payment.user_id,
      product: payment.product,
      refundAmount,
      originalAmount: payment.amount,
      status: newStatus,
      reason: reason.trim(),
    }).catch((err) => {
      console.warn('[Payment] Failed to notify product service about refund:', err.message);
    });

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

/**
 * Notify product service about a refund event.
 * Each product has an internal endpoint to handle refund notifications.
 */
async function notifyProductServiceRefund(
  product: string,
  payload: {
    orderId: string;
    userId: string;
    product: string;
    refundAmount: number;
    originalAmount: number;
    status: string;
    reason: string;
  }
): Promise<void> {
  const PRODUCT_INTERNAL_URLS: Record<string, string> = {
    trendbriefai: process.env.TRENDBRIEFAI_INTERNAL_URL || 'http://localhost:4001',
    smartbuy: process.env.SMARTBUY_INTERNAL_URL || 'http://localhost:4002',
    fintax: process.env.FINTAX_INTERNAL_URL || 'http://localhost:4003',
    caremate: process.env.CAREMATE_INTERNAL_URL || 'http://localhost:4004',
  };

  const baseUrl = PRODUCT_INTERNAL_URLS[product];
  if (!baseUrl) {
    console.warn(`[Payment] No internal URL configured for product: ${product}`);
    return;
  }

  await axios.post(`${baseUrl}/internal/payment-refunded`, payload, {
    timeout: 5000,
  });
}

export { router as paymentRoutes };
