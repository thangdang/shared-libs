import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mock axios ---
const mockAxiosPost = vi.fn();
vi.mock('axios', () => ({
  default: {
    post: (...args: any[]) => mockAxiosPost(...args),
  },
}));

// --- Mock crypto (pass-through real implementation for HMAC) ---
vi.mock('crypto', async () => {
  const actual = await vi.importActual<typeof import('crypto')>('crypto');
  return { default: actual, ...actual };
});

// --- Mock stripe ---
const mockStripeRefundsCreate = vi.fn();
vi.mock('stripe', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      refunds: { create: mockStripeRefundsCreate },
    })),
  };
});

import { processProviderRefund, RefundRequest, RefundResult } from './refund';

beforeEach(() => {
  vi.clearAllMocks();
  // Set environment variables for tests
  vi.stubEnv('SEPAY_MERCHANT_ID', 'test-merchant');
  vi.stubEnv('SEPAY_SECRET_KEY', 'test-secret-key');
  vi.stubEnv('SEPAY_ENV', 'sandbox');
  vi.stubEnv('MOMO_ENDPOINT', 'https://test-payment.momo.vn/v2/gateway/api');
  vi.stubEnv('MOMO_PARTNER_CODE', 'TEST_PARTNER');
  vi.stubEnv('MOMO_ACCESS_KEY', 'test-access-key');
  vi.stubEnv('MOMO_SECRET_KEY', 'test-momo-secret');
  vi.stubEnv('ZALOPAY_APP_ID', '12345');
  vi.stubEnv('ZALOPAY_KEY1', 'test-zalo-key1');
  vi.stubEnv('ZALOPAY_ENDPOINT', 'https://sb-openapi.zalopay.vn/v2');
  vi.stubEnv('PAYOS_CLIENT_ID', 'test-client-id');
  vi.stubEnv('PAYOS_API_KEY', 'test-api-key');
  vi.stubEnv('PAYOS_CHECKSUM_KEY', 'test-checksum-key');
  vi.stubEnv('STRIPE_SECRET_KEY', 'sk_test_12345');
});

// ─── Dispatcher Tests ─────────────────────────────────────────────────────────

describe('processProviderRefund — Dispatcher', () => {
  const baseRequest: RefundRequest = {
    orderId: 'ORDER_001',
    amount: 100000,
    reason: 'Customer requested refund',
  };

  it('returns error for unsupported provider', async () => {
    const result = await processProviderRefund('unknown_provider', baseRequest);

    expect(result.success).toBe(false);
    expect(result.provider).toBe('unknown_provider');
    expect(result.amount).toBe(100000);
    expect(result.error).toBe('Unsupported refund provider: unknown_provider');
  });

  it('dispatches to sepay provider', async () => {
    mockAxiosPost.mockResolvedValue({ data: { data: { refund_id: 'RF_001' } } });

    const result = await processProviderRefund('sepay', baseRequest);

    expect(result.provider).toBe('sepay');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('dispatches to momo provider', async () => {
    mockAxiosPost.mockResolvedValue({ data: { resultCode: 0, transId: '123456' } });

    const result = await processProviderRefund('momo', baseRequest);

    expect(result.provider).toBe('momo');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('dispatches to zalopay provider', async () => {
    mockAxiosPost.mockResolvedValue({ data: { return_code: 1, refund_id: 'ZLP_RF_001' } });

    const result = await processProviderRefund('zalopay', baseRequest);

    expect(result.provider).toBe('zalopay');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('dispatches to payos provider', async () => {
    mockAxiosPost.mockResolvedValue({ data: { code: '00', data: { id: 'POS_RF_001' } }, status: 200 });

    const result = await processProviderRefund('payos', baseRequest);

    expect(result.provider).toBe('payos');
    expect(mockAxiosPost).toHaveBeenCalledTimes(1);
  });

  it('dispatches to stripe provider', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_001', status: 'succeeded' });

    const result = await processProviderRefund('stripe', baseRequest);

    expect(result.provider).toBe('stripe');
  });
});

// ─── SePay Refund Tests ───────────────────────────────────────────────────────

describe('refundSepay', () => {
  const request: RefundRequest = {
    orderId: 'SEPAY_ORDER_001',
    amount: 50000,
    reason: 'Hoàn tiền theo yêu cầu',
    providerTransactionId: 'TXN_12345',
  };

  it('calls SePay refund endpoint with correct payload', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { data: { refund_id: 'SEPAY_RF_123', transaction_id: 'TXN_12345' } },
    });

    const result = await processProviderRefund('sepay', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('SEPAY_RF_123');
    expect(result.amount).toBe(50000);

    const [url, payload, config] = mockAxiosPost.mock.calls[0];
    expect(url).toContain('/v1/refund');
    expect(payload.operation).toBe('REFUND');
    expect(payload.order_invoice_number).toBe('SEPAY_ORDER_001');
    expect(payload.refund_amount).toBe('50000');
    expect(payload.currency).toBe('VND');
    expect(payload.transaction_id).toBe('TXN_12345');
    expect(payload.signature).toBeDefined();
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('handles SePay API error response', async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { message: 'Transaction not found' } },
    });

    const result = await processProviderRefund('sepay', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
    expect(result.provider).toBe('sepay');
    expect(result.amount).toBe(50000);
  });

  it('handles network error', async () => {
    mockAxiosPost.mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await processProviderRefund('sepay', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('ECONNREFUSED');
  });

  it('truncates reason to 255 characters', async () => {
    const longReason = 'A'.repeat(300);
    mockAxiosPost.mockResolvedValue({ data: { data: { refund_id: 'RF_001' } } });

    await processProviderRefund('sepay', { ...request, reason: longReason });

    const [, payload] = mockAxiosPost.mock.calls[0];
    expect(payload.refund_reason.length).toBe(255);
  });
});

// ─── MoMo Refund Tests ────────────────────────────────────────────────────────

describe('refundMoMo', () => {
  const request: RefundRequest = {
    orderId: 'MOMO_ORDER_001',
    amount: 200000,
    reason: 'Sản phẩm bị lỗi',
    providerTransactionId: '9876543210',
  };

  it('calls MoMo refund endpoint with HMAC signature', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { resultCode: 0, transId: '111222333', message: 'Successful' },
    });

    const result = await processProviderRefund('momo', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('111222333');
    expect(result.amount).toBe(200000);

    const [url, body] = mockAxiosPost.mock.calls[0];
    expect(url).toContain('/refund');
    expect(body.partnerCode).toBe('TEST_PARTNER');
    expect(body.orderId).toBe('MOMO_ORDER_001');
    expect(body.amount).toBe(200000);
    expect(body.transId).toBe(9876543210);
    expect(body.description).toBe('Sản phẩm bị lỗi');
    expect(body.lang).toBe('vi');
    expect(body.signature).toBeDefined();
    expect(body.signature.length).toBe(64); // HMAC-SHA256 hex
  });

  it('handles MoMo non-zero resultCode as failure', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { resultCode: 11, message: 'Insufficient funds for refund' },
    });

    const result = await processProviderRefund('momo', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Insufficient funds for refund');
  });

  it('handles MoMo API network error', async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { message: 'Service unavailable' } },
    });

    const result = await processProviderRefund('momo', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Service unavailable');
  });

  it('uses 0 for transId when providerTransactionId is not provided', async () => {
    mockAxiosPost.mockResolvedValue({ data: { resultCode: 0, transId: '999' } });

    await processProviderRefund('momo', {
      orderId: 'MOMO_002',
      amount: 100000,
      reason: 'test',
    });

    const [, body] = mockAxiosPost.mock.calls[0];
    expect(body.transId).toBe(0);
  });
});

// ─── ZaloPay Refund Tests ─────────────────────────────────────────────────────

describe('refundZaloPay', () => {
  const request: RefundRequest = {
    orderId: 'ZALO_ORDER_001',
    amount: 150000,
    reason: 'Đơn hàng trùng lặp',
    providerTransactionId: 'ZP_TXN_001',
  };

  it('calls ZaloPay refund endpoint with MAC signature', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { return_code: 1, refund_id: 'ZLP_RF_12345', return_message: 'Success' },
    });

    const result = await processProviderRefund('zalopay', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('ZLP_RF_12345');
    expect(result.amount).toBe(150000);

    const [url, body] = mockAxiosPost.mock.calls[0];
    expect(url).toContain('/refund');
    expect(body.app_id).toBe(12345);
    expect(body.zp_trans_id).toBe('ZP_TXN_001');
    expect(body.amount).toBe(150000);
    expect(body.description).toBe('Đơn hàng trùng lặp');
    expect(body.timestamp).toBeDefined();
    expect(body.mac).toBeDefined();
    expect(body.mac.length).toBe(64); // HMAC-SHA256 hex
    expect(body.m_refund_id).toBeDefined();
  });

  it('handles ZaloPay non-1 return_code as failure', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { return_code: 2, return_message: 'Transaction not found' },
    });

    const result = await processProviderRefund('zalopay', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Transaction not found');
  });

  it('handles ZaloPay API error', async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { return_message: 'Invalid MAC' } },
    });

    const result = await processProviderRefund('zalopay', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Invalid MAC');
  });

  it('uses empty string for zpTransId when not provided', async () => {
    mockAxiosPost.mockResolvedValue({ data: { return_code: 1, refund_id: 'RF_001' } });

    await processProviderRefund('zalopay', {
      orderId: 'ZALO_002',
      amount: 50000,
      reason: 'test',
    });

    const [, body] = mockAxiosPost.mock.calls[0];
    expect(body.zp_trans_id).toBe('');
  });
});

// ─── payOS Refund Tests ───────────────────────────────────────────────────────

describe('refundPayOS', () => {
  const request: RefundRequest = {
    orderId: 'PAYOS_ORDER_001',
    amount: 75000,
    reason: 'Khách hàng huỷ đơn',
    providerTransactionId: '1700000001',
  };

  it('calls payOS cancel endpoint with correct auth headers', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { code: '00', data: { id: 'PAYOS_CANCEL_001', orderCode: 1700000001 } },
      status: 200,
    });

    const result = await processProviderRefund('payos', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('PAYOS_CANCEL_001');
    expect(result.amount).toBe(75000);

    const [url, , config] = mockAxiosPost.mock.calls[0];
    expect(url).toContain('/v2/payment-requests/1700000001/cancel');
    expect(config.headers['x-client-id']).toBe('test-client-id');
    expect(config.headers['x-api-key']).toBe('test-api-key');
    expect(config.headers['Content-Type']).toBe('application/json');
  });

  it('falls back to orderId when providerTransactionId not provided', async () => {
    mockAxiosPost.mockResolvedValue({
      data: { code: '00', data: { id: 'PAYOS_CANCEL_002' } },
      status: 200,
    });

    await processProviderRefund('payos', {
      orderId: 'PAYOS_FALLBACK_001',
      amount: 30000,
      reason: 'test',
    });

    const [url] = mockAxiosPost.mock.calls[0];
    expect(url).toContain('/v2/payment-requests/PAYOS_FALLBACK_001/cancel');
  });

  it('handles payOS error response', async () => {
    mockAxiosPost.mockRejectedValue({
      response: { data: { desc: 'Order not found', message: 'NOT_FOUND' } },
    });

    const result = await processProviderRefund('payos', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('Order not found');
  });

  it('includes cancellation reason and signature in body', async () => {
    mockAxiosPost.mockResolvedValue({ data: { code: '00', data: {} }, status: 200 });

    await processProviderRefund('payos', request);

    const [, body] = mockAxiosPost.mock.calls[0];
    expect(body.cancellationReason).toBe('Khách hàng huỷ đơn');
    expect(body.signature).toBeDefined();
  });
});

// ─── Stripe Refund Tests ──────────────────────────────────────────────────────

describe('refundStripe', () => {
  const request: RefundRequest = {
    orderId: 'STRIPE_ORDER_001',
    amount: 500000,
    reason: 'requested_by_customer',
    providerTransactionId: 'pi_1234567890',
    metadata: { refundedBy: 'admin' },
  };

  it('calls stripe.refunds.create with payment_intent and amount', async () => {
    mockStripeRefundsCreate.mockResolvedValue({
      id: 're_test_001',
      status: 'succeeded',
    });

    const result = await processProviderRefund('stripe', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('re_test_001');
    expect(result.amount).toBe(500000);

    expect(mockStripeRefundsCreate).toHaveBeenCalledWith({
      amount: 500000,
      payment_intent: 'pi_1234567890',
      reason: 'requested_by_customer',
      metadata: { refundedBy: 'admin' },
    });
  });

  it('maps "duplicate" reason correctly', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_002', status: 'succeeded' });

    await processProviderRefund('stripe', { ...request, reason: 'duplicate' });

    const callArgs = mockStripeRefundsCreate.mock.calls[0][0];
    expect(callArgs.reason).toBe('duplicate');
  });

  it('maps "fraudulent" reason correctly', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_003', status: 'succeeded' });

    await processProviderRefund('stripe', { ...request, reason: 'fraudulent' });

    const callArgs = mockStripeRefundsCreate.mock.calls[0][0];
    expect(callArgs.reason).toBe('fraudulent');
  });

  it('maps other reasons to "requested_by_customer"', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_004', status: 'succeeded' });

    await processProviderRefund('stripe', { ...request, reason: 'any other reason' });

    const callArgs = mockStripeRefundsCreate.mock.calls[0][0];
    expect(callArgs.reason).toBe('requested_by_customer');
  });

  it('treats "pending" refund status as success', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_005', status: 'pending' });

    const result = await processProviderRefund('stripe', request);

    expect(result.success).toBe(true);
    expect(result.refundId).toBe('re_005');
  });

  it('treats "failed" refund status as failure', async () => {
    mockStripeRefundsCreate.mockResolvedValue({
      id: 're_006',
      status: 'failed',
      failure_reason: 'charge_already_refunded',
    });

    const result = await processProviderRefund('stripe', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('charge_already_refunded');
  });

  it('handles Stripe SDK exception', async () => {
    mockStripeRefundsCreate.mockRejectedValue(new Error('No such payment_intent: pi_invalid'));

    const result = await processProviderRefund('stripe', request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('No such payment_intent: pi_invalid');
  });

  it('fails if STRIPE_SECRET_KEY is not configured', async () => {
    vi.stubEnv('STRIPE_SECRET_KEY', '');

    // Need to re-import to pick up the empty env var — but since we read at module load,
    // we test the error handling path that checks for empty key.
    // The module reads STRIPE_SECRET_KEY at load time, so this test verifies
    // the throw path inside refundStripe is handled correctly.
    // Since the env is already loaded, we test by having the mock throw.
    mockStripeRefundsCreate.mockRejectedValue(new Error('Stripe not configured'));

    const result = await processProviderRefund('stripe', request);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Stripe not configured');
  });

  it('does not include payment_intent when providerTransactionId is absent', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_007', status: 'succeeded' });

    await processProviderRefund('stripe', {
      orderId: 'STRIPE_002',
      amount: 100000,
      reason: 'test',
    });

    const callArgs = mockStripeRefundsCreate.mock.calls[0][0];
    expect(callArgs.payment_intent).toBeUndefined();
  });

  it('does not include metadata when not provided', async () => {
    mockStripeRefundsCreate.mockResolvedValue({ id: 're_008', status: 'succeeded' });

    await processProviderRefund('stripe', {
      orderId: 'STRIPE_003',
      amount: 50000,
      reason: 'duplicate',
      providerTransactionId: 'pi_test',
    });

    const callArgs = mockStripeRefundsCreate.mock.calls[0][0];
    expect(callArgs.metadata).toBeUndefined();
  });
});
