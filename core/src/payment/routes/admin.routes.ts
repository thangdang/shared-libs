/**
 * Admin Routes Factory — Payment tracking dashboard
 */
import { Router, Request, Response } from 'express';
import type { Model } from 'mongoose';
import type { IPayment, PaymentConfig } from '../types.js';
import axios from 'axios';

export interface AdminRoutesConfig {
  /** Payment model from the app */
  paymentModel: Model<IPayment>;
  /** Payment provider configuration (for notifications) */
  config?: PaymentConfig;
}

/**
 * Create admin routes with the provided configuration.
 */
export function createAdminRoutes(routeConfig: AdminRoutesConfig): Router {
  const router = Router();
  const { paymentModel, config } = routeConfig;

  /**
   * GET /stats — Quick dashboard stats
   */
  router.get('/stats', async (_req: Request, res: Response) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);

      const [todayData, monthData, pendingCount, byMethod, byProduct] =
        await Promise.all([
          paymentModel.aggregate([
            { $match: { status: 'completed', created_at: { $gte: today } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
          paymentModel.aggregate([
            { $match: { status: 'completed', created_at: { $gte: thisMonth } } },
            { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
          paymentModel.countDocuments({ status: 'pending' }),
          paymentModel.aggregate([
            { $match: { status: 'completed', created_at: { $gte: thisMonth } } },
            { $group: { _id: '$method', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
          paymentModel.aggregate([
            { $match: { status: 'completed', created_at: { $gte: thisMonth } } },
            { $group: { _id: '$product', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
        ]);

      res.json({
        today: {
          revenue: todayData[0]?.total || 0,
          transactions: todayData[0]?.count || 0,
        },
        this_month: {
          revenue: monthData[0]?.total || 0,
          transactions: monthData[0]?.count || 0,
        },
        pending: pendingCount,
        by_method: Object.fromEntries(
          byMethod.map((m) => [m._id, { total: m.total, count: m.count }])
        ),
        by_product: Object.fromEntries(
          byProduct.map((p) => [p._id, { total: p.total, count: p.count }])
        ),
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch stats' });
    }
  });

  /**
   * GET /list — List all payments (paginated, filterable)
   */
  router.get('/list', async (req: Request, res: Response) => {
    try {
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, parseInt(req.query.limit as string) || 20);
      const { status, method, product } = req.query;
      const skip = (page - 1) * limit;

      const query: Record<string, any> = {};
      if (status) query.status = status;
      if (method) query.method = method;
      if (product) query.product = product;

      const [payments, total] = await Promise.all([
        paymentModel.find(query).sort({ created_at: -1 }).skip(skip).limit(limit).lean(),
        paymentModel.countDocuments(query),
      ]);

      res.json({ payments, total, page, pages: Math.ceil(total / limit) });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch payments' });
    }
  });

  /**
   * POST /confirm/:orderId — Manual confirm (fallback)
   */
  router.post('/confirm/:orderId', async (req: Request, res: Response) => {
    try {
      const payment = await paymentModel.findOne({
        order_id: req.params.orderId,
        status: 'pending',
      });

      if (!payment) {
        res.status(404).json({ error: 'Payment not found' });
        return;
      }

      payment.status = 'completed';
      payment.confirmed_by = req.body.adminId || 'admin';
      payment.confirmed_at = new Date();
      payment.provider_transaction_id =
        req.body.transactionRef || `manual-${Date.now()}`;
      await payment.save();

      // Notify product service
      const url = config?.productUrls?.[payment.product];
      if (url) {
        await axios
          .post(
            `${url}/internal/payment-completed`,
            {
              userId: payment.user_id,
              plan: payment.plan,
              orderId: payment.order_id,
            },
            { timeout: 5000 }
          )
          .catch(() => {});
      }

      res.json({ success: true, message: 'Payment confirmed' });
    } catch (error) {
      res.status(500).json({ error: 'Failed to confirm' });
    }
  });

  /**
   * GET /revenue — Revenue chart data
   */
  router.get('/revenue', async (req: Request, res: Response) => {
    try {
      const days = parseInt(req.query.days as string) || 30;
      const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const data = await paymentModel.aggregate([
        { $match: { status: 'completed', created_at: { $gte: startDate } } },
        {
          $group: {
            _id: {
              date: { $dateToString: { format: '%Y-%m-%d', date: '$created_at' } },
              product: '$product',
            },
            total: { $sum: '$amount' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.date': 1 } },
      ]);

      res.json({ data, days });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch revenue' });
    }
  });

  return router;
}
