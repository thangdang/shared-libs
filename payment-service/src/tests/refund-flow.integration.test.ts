/**
 * Integration Tests — Payment Refund Flow
 *
 * Tests the full refund lifecycle through POST /api/payment/refund/:orderId route handler:
 * - Create payment → mark completed → full refund → status is 'refunded'
 * - Partial refund → status is 'partially_refunded'
 * - Refund on non-completed payment → 400 error
 * - Refund with amount exceeding original → 400 error
 *
 * @validates Req 7.1 — POST /api/payment/refund/:orderId (full and partial refund)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// ─── Mock Payment Model ───

const mockFindOne = vi.fn();
const mockUpdateOne = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../models/Payment', () => ({
  Payment: {
    findOne: (...args: any[]) => mockFindOne(...args),
    updateOne: (...args: any[]) => mockUpdateOne(...args),
    create: (...args: any[]) => mockCreate(...args),
  },
}));

// ─── Mock processProviderRefund ───

const mockProcessProviderRefund = vi.fn();

vi.mock('../../providers/refund', () => ({
  processProviderRefund: (...args: any[]) => mockProcessProviderRefund(...args),
}));

// ─── Mock axios (for product notification) ───

vi.mock('axios', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: { success: true } }),
  },
}));

// ─── Mock other payment providers (not used in refund but imported by routes) ───

vi.mock('../../providers/momo', () => ({ createMoMoPayment: vi.fn() }));
vi.mock('../../providers/zalopay', () => ({ createZaloPayPayment: vi.fn() }));
vi.mock('../../providers/payos', () => ({ createPayOSPayment: vi.fn() }));
vi.mock('../../providers/sepay', () => ({ createSepayPayment: vi.fn() }));
vi.mock('../../providers/stripe', () => ({ createStripeCheckout: vi.fn() }));

// ─── Import route AFTER mocks are set up ───

import { paymentRoutes } from '../../routes/payment.routes';

// ─── Test App Setup ───

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/payment', paymentRoutes);
  return app;
}

// ─── Test Data ───

const COMPLETED_PAYMENT = {
  _id: 'pay_001',
  product: 'smartbuy',
  user_id: 'user_123',
  order_id: 'SB-1720000000-abcd1234',
  amount: 79000,
  currency: 'VND',
  method: 'sepay',
  plan: 'pro_monthly',
  status: 'completed',
  provider_transaction_id: 'sepay_tx_999',
  metadata: { order_code: 'OC_12345' },
  created_at: new Date('2026-07-01'),
};

const PENDING_PAYMENT = {
  ...COMPLETED_PAYMENT,
  _id: 'pay_002',
  order_id: 'SB-1720000001-efgh5678',
  status: 'pending',
};

const REFUND_SUCCESS_RESULT = {
  success: true,
  refundId: 'RF_SEPAY_001',
  provider: 'sepay',
  amount: 79000,
};

// ─── Tests ───

describe('POST /api/payment/refund/:orderId — Refund Flow Integration', () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    app = createApp();
    mockUpdateOne.mockResolvedValue({ modifiedCount: 1 });
  });

  // ─── Test 1: Full refund on completed payment ───

  it('should refund a completed payment fully and return status=refunded', async () => {
    // Payment.findOne returns a completed payment
    mockFindOne.mockResolvedValueOnce({ ...COMPLETED_PAYMENT });

    // Provider refund succeeds
    mockProcessProviderRefund.mockResolvedValueOnce(REFUND_SUCCESS_RESULT);

    const res = await request(app)
      .post(`/api/payment/refund/${COMPLETED_PAYMENT.order_id}`)
      .send({ reason: 'Khách hàng yêu cầu hoàn tiền' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.refundId).toBe('RF_SEPAY_001');
    expect(res.body.status).toBe('refunded');
    expect(res.body.refundAmount).toBe(79000);
    expect(res.body.orderId).toBe(COMPLETED_PAYMENT.order_id);

    // Verify processProviderRefund was called correctly
    expect(mockProcessProviderRefund).toHaveBeenCalledWith('sepay', {
      orderId: COMPLETED_PAYMENT.order_id,
      amount: 79000,
      reason: 'Khách hàng yêu cầu hoàn tiền',
      providerTransactionId: 'sepay_tx_999',
      metadata: { order_code: 'OC_12345' },
    });

    // Verify Payment.updateOne was called to set status
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { order_id: COMPLETED_PAYMENT.order_id },
      {
        $set: expect.objectContaining({
          status: 'refunded',
          'metadata.refund_id': 'RF_SEPAY_001',
          'metadata.refund_amount': 79000,
          'metadata.refund_reason': 'Khách hàng yêu cầu hoàn tiền',
        }),
      },
    );
  });

  // ─── Test 2: Partial refund → status is 'partially_refunded' ───

  it('should partially refund and return status=partially_refunded', async () => {
    mockFindOne.mockResolvedValueOnce({ ...COMPLETED_PAYMENT });

    const partialRefundResult = {
      success: true,
      refundId: 'RF_SEPAY_002',
      provider: 'sepay',
      amount: 30000,
    };
    mockProcessProviderRefund.mockResolvedValueOnce(partialRefundResult);

    const res = await request(app)
      .post(`/api/payment/refund/${COMPLETED_PAYMENT.order_id}`)
      .send({ amount: 30000, reason: 'Hoàn một phần do lỗi sản phẩm' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.refundId).toBe('RF_SEPAY_002');
    expect(res.body.status).toBe('partially_refunded');
    expect(res.body.refundAmount).toBe(30000);

    // Verify provider was called with partial amount
    expect(mockProcessProviderRefund).toHaveBeenCalledWith('sepay', {
      orderId: COMPLETED_PAYMENT.order_id,
      amount: 30000,
      reason: 'Hoàn một phần do lỗi sản phẩm',
      providerTransactionId: 'sepay_tx_999',
      metadata: { order_code: 'OC_12345' },
    });

    // Verify status set to partially_refunded
    expect(mockUpdateOne).toHaveBeenCalledWith(
      { order_id: COMPLETED_PAYMENT.order_id },
      {
        $set: expect.objectContaining({
          status: 'partially_refunded',
          'metadata.refund_amount': 30000,
        }),
      },
    );
  });

  // ─── Test 3: Refund on non-completed payment → 400 ───

  it('should return 400 when payment is not in completed status', async () => {
    // Payment in "pending" status
    mockFindOne.mockResolvedValueOnce({ ...PENDING_PAYMENT });

    const res = await request(app)
      .post(`/api/payment/refund/${PENDING_PAYMENT.order_id}`)
      .send({ reason: 'Test refund' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('pending');
    expect(res.body.error).toContain('Only completed payments can be refunded');

    // Provider refund should NOT have been called
    expect(mockProcessProviderRefund).not.toHaveBeenCalled();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  // ─── Test 4: Refund with amount exceeding original → 400 ───

  it('should return 400 when refund amount exceeds original payment amount', async () => {
    mockFindOne.mockResolvedValueOnce({ ...COMPLETED_PAYMENT });

    const res = await request(app)
      .post(`/api/payment/refund/${COMPLETED_PAYMENT.order_id}`)
      .send({ amount: 100000, reason: 'Refund too much' }); // 100000 > 79000

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('exceeds');

    // Provider refund should NOT have been called
    expect(mockProcessProviderRefund).not.toHaveBeenCalled();
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  // ─── Test 5: Payment not found → 404 ───

  it('should return 404 when orderId does not exist', async () => {
    mockFindOne.mockResolvedValueOnce(null);

    const res = await request(app)
      .post('/api/payment/refund/NONEXISTENT-ORDER')
      .send({ reason: 'Test reason' });

    expect(res.status).toBe(404);
    expect(res.body.error).toContain('not found');

    expect(mockProcessProviderRefund).not.toHaveBeenCalled();
  });

  // ─── Test 6: Missing reason → 400 ───

  it('should return 400 when reason is not provided', async () => {
    const res = await request(app)
      .post(`/api/payment/refund/${COMPLETED_PAYMENT.order_id}`)
      .send({}); // no reason

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('reason');

    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockProcessProviderRefund).not.toHaveBeenCalled();
  });

  // ─── Test 7: Provider refund failure → 502 ───

  it('should return 502 when provider refund API fails', async () => {
    mockFindOne.mockResolvedValueOnce({ ...COMPLETED_PAYMENT });

    mockProcessProviderRefund.mockResolvedValueOnce({
      success: false,
      provider: 'sepay',
      amount: 79000,
      error: 'Provider timeout',
    });

    const res = await request(app)
      .post(`/api/payment/refund/${COMPLETED_PAYMENT.order_id}`)
      .send({ reason: 'Hoàn tiền' });

    expect(res.status).toBe(502);
    expect(res.body.error).toContain('Refund failed at provider');
    expect(res.body.detail).toBe('Provider timeout');

    // Payment status should NOT be updated on provider failure
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
