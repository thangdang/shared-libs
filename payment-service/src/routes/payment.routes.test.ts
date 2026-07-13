/**
 * Unit tests for POST /api/payment/refund/:orderId
 * Tests the refund route logic: validation, provider dispatch, status update, notification
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock Payment model
vi.mock('../models/Payment', () => {
  const mockFindOne = vi.fn();
  const mockUpdateOne = vi.fn();
  return {
    Payment: {
      findOne: mockFindOne,
      updateOne: mockUpdateOne,
    },
  };
});

// Mock refund provider
vi.mock('../providers/refund', () => ({
  processProviderRefund: vi.fn(),
}));

// Mock axios for product service notification
vi.mock('axios', () => ({
  default: { post: vi.fn().mockResolvedValue({ data: {} }) },
  post: vi.fn().mockResolvedValue({ data: {} }),
}));

import { Payment } from '../models/Payment';
import { processProviderRefund } from '../providers/refund';
import axios from 'axios';

// We need to import the router after mocks are set up
import { paymentRoutes } from './payment.routes';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payment', paymentRoutes);
  return app;
}

describe('POST /api/payment/refund/:orderId', () => {
  let app: express.Application;

  const mockCompletedPayment = {
    product: 'fintax',
    user_id: 'user-123',
    order_id: 'FT-123456-abcdef01',
    amount: 99000,
    currency: 'VND',
    method: 'momo',
    plan: 'pro_monthly',
    status: 'completed',
    provider_transaction_id: 'MOMO_TXN_789',
    metadata: { app_trans_id: 'momo_trans_123' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
  });

  describe('Validation', () => {
    it('should return 400 if reason is missing', async () => {
      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 50000 });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reason');
    });

    it('should return 400 if reason is empty string', async () => {
      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: '  ' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('reason');
    });

    it('should return 404 if payment not found', async () => {
      (Payment.findOne as any).mockResolvedValue(null);

      const res = await request(app)
        .post('/api/payment/refund/NONEXISTENT-ORDER')
        .send({ reason: 'Customer request' });

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Payment not found');
    });

    it('should return 400 if payment status is not completed', async () => {
      (Payment.findOne as any).mockResolvedValue({
        ...mockCompletedPayment,
        status: 'pending',
      });

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Customer request' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Cannot refund');
      expect(res.body.error).toContain('pending');
    });

    it('should return 400 if refund amount exceeds original payment', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 200000, reason: 'Overcharge' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('exceeds');
    });

    it('should return 400 if refund amount is negative', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: -1000, reason: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('positive number');
    });

    it('should return 400 if refund amount is zero', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 0, reason: 'Test' });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('positive number');
    });
  });

  describe('Full Refund', () => {
    it('should process full refund when amount is not specified', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'MOMO_RF_FT-123456-abcdef01_1234567890',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Customer changed mind' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refundAmount).toBe(99000);
      expect(res.body.status).toBe('refunded');
      expect(res.body.refundId).toBeDefined();
    });

    it('should update payment status to refunded', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_123',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Duplicate charge' });

      expect(Payment.updateOne).toHaveBeenCalledWith(
        { order_id: 'FT-123456-abcdef01' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'refunded',
            'metadata.refund_amount': 99000,
            'metadata.refund_reason': 'Duplicate charge',
          }),
        })
      );
    });

    it('should call processProviderRefund with correct parameters', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_123',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Refund test' });

      expect(processProviderRefund).toHaveBeenCalledWith('momo', {
        orderId: 'FT-123456-abcdef01',
        amount: 99000,
        reason: 'Refund test',
        providerTransactionId: 'MOMO_TXN_789',
        metadata: { app_trans_id: 'momo_trans_123' },
      });
    });
  });

  describe('Partial Refund', () => {
    it('should process partial refund when amount is less than payment', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_PARTIAL_123',
        provider: 'momo',
        amount: 50000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 50000, reason: 'Partial service provided' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.refundAmount).toBe(50000);
      expect(res.body.status).toBe('partially_refunded');
    });

    it('should update payment status to partially_refunded for partial refund', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_456',
        provider: 'momo',
        amount: 30000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 30000, reason: 'Partial refund' });

      expect(Payment.updateOne).toHaveBeenCalledWith(
        { order_id: 'FT-123456-abcdef01' },
        expect.objectContaining({
          $set: expect.objectContaining({
            status: 'partially_refunded',
            'metadata.refund_amount': 30000,
          }),
        })
      );
    });

    it('should treat amount equal to payment as full refund', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_789',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ amount: 99000, reason: 'Full refund via amount' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('refunded');
    });
  });

  describe('Provider Failure', () => {
    it('should return 502 if provider refund fails', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: false,
        provider: 'momo',
        amount: 99000,
        error: 'Provider timeout',
      });

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Customer request' });

      expect(res.status).toBe(502);
      expect(res.body.error).toBe('Refund failed at provider');
      expect(res.body.detail).toBe('Provider timeout');
      expect(res.body.provider).toBe('momo');
    });

    it('should not update payment status if provider fails', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: false,
        provider: 'momo',
        amount: 99000,
        error: 'Network error',
      });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Test' });

      expect(Payment.updateOne).not.toHaveBeenCalled();
    });
  });

  describe('Product Service Notification', () => {
    it('should notify product service after successful refund', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_NOTIF_123',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Notification test' });

      // Give time for the fire-and-forget notification
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(axios.post).toHaveBeenCalledWith(
        'http://localhost:4003/internal/payment-refunded',
        expect.objectContaining({
          orderId: 'FT-123456-abcdef01',
          userId: 'user-123',
          product: 'fintax',
          refundAmount: 99000,
          status: 'refunded',
          reason: 'Notification test',
        }),
        expect.objectContaining({ timeout: 5000 })
      );
    });

    it('should not fail the refund if product notification fails', async () => {
      (Payment.findOne as any).mockResolvedValue(mockCompletedPayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'RF_SILENT_123',
        provider: 'momo',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });
      (axios.post as any).mockRejectedValue(new Error('Product service unavailable'));

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Should succeed anyway' });

      // Refund should still succeed even if notification fails
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('Different Providers', () => {
    it('should dispatch to correct provider based on payment method', async () => {
      const stripePayment = { ...mockCompletedPayment, method: 'stripe' };
      (Payment.findOne as any).mockResolvedValue(stripePayment);
      (processProviderRefund as any).mockResolvedValue({
        success: true,
        refundId: 'STRIPE_RF_123',
        provider: 'stripe',
        amount: 99000,
      });
      (Payment.updateOne as any).mockResolvedValue({ modifiedCount: 1 });

      await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Stripe refund test' });

      expect(processProviderRefund).toHaveBeenCalledWith('stripe', expect.any(Object));
    });
  });

  describe('Error Handling', () => {
    it('should return 500 if an unexpected error occurs', async () => {
      (Payment.findOne as any).mockRejectedValue(new Error('DB connection lost'));

      const res = await request(app)
        .post('/api/payment/refund/FT-123456-abcdef01')
        .send({ reason: 'Test error' });

      expect(res.status).toBe(500);
      expect(res.body.error).toBe('Refund processing failed');
    });
  });
});
