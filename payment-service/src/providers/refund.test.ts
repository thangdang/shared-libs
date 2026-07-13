/**
 * Unit tests for refund provider dispatcher
 */
import { describe, it, expect } from 'vitest';
import { processProviderRefund, RefundRequest } from './refund';

describe('processProviderRefund', () => {
  const baseRequest: RefundRequest = {
    orderId: 'FT-123456-abcdef01',
    amount: 99000,
    reason: 'Customer request',
    providerTransactionId: 'TXN_123',
    metadata: {},
  };

  describe('Provider Dispatch', () => {
    it('should handle sepay provider', async () => {
      const result = await processProviderRefund('sepay', baseRequest);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('sepay');
      expect(result.amount).toBe(99000);
      expect(result.refundId).toContain('SEPAY_RF_');
    });

    it('should handle momo provider', async () => {
      const result = await processProviderRefund('momo', baseRequest);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('momo');
      expect(result.amount).toBe(99000);
      expect(result.refundId).toContain('MOMO_RF_');
    });

    it('should handle zalopay provider', async () => {
      const result = await processProviderRefund('zalopay', baseRequest);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('zalopay');
      expect(result.amount).toBe(99000);
      expect(result.refundId).toContain('ZALO_RF_');
    });

    it('should handle payos provider', async () => {
      const result = await processProviderRefund('payos', baseRequest);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('payos');
      expect(result.amount).toBe(99000);
      expect(result.refundId).toContain('PAYOS_RF_');
    });

    it('should handle stripe provider', async () => {
      const result = await processProviderRefund('stripe', baseRequest);
      expect(result.success).toBe(true);
      expect(result.provider).toBe('stripe');
      expect(result.amount).toBe(99000);
      expect(result.refundId).toContain('STRIPE_RF_');
    });
  });

  describe('Unsupported Provider', () => {
    it('should return failure for unknown provider', async () => {
      const result = await processProviderRefund('unknown_provider', baseRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported refund provider');
      expect(result.provider).toBe('unknown_provider');
    });

    it('should return failure for empty provider string', async () => {
      const result = await processProviderRefund('', baseRequest);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported refund provider');
    });
  });

  describe('Amount Handling', () => {
    it('should pass through the refund amount correctly', async () => {
      const partialRequest = { ...baseRequest, amount: 50000 };
      const result = await processProviderRefund('momo', partialRequest);
      expect(result.amount).toBe(50000);
    });

    it('should include orderId in refund ID for traceability', async () => {
      const result = await processProviderRefund('stripe', baseRequest);
      expect(result.refundId).toContain('FT-123456-abcdef01');
    });
  });
});
