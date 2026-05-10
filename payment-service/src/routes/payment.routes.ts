/**
 * Payment Routes — Create payments for any product
 * Called by product services internally (localhost:3006)
 */
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { Payment } from '../models/Payment';
import { createMoMoPayment } from '../providers/momo';
import { createZaloPayPayment } from '../providers/zalopay';
import { createPayOSPayment } from '../providers/payos';
import { createStripeCheckout } from '../providers/stripe';

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
        res.status(400).json({ error: `Invalid method: ${method}. Use: momo, zalopay, payos, stripe` });
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
  res.json({ plans, currency: 'VND', methods: ['payos', 'momo', 'zalopay', 'stripe'] });
});

export { router as paymentRoutes };
