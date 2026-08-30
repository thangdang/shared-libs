/**
 * Shared payment types for all WinLux products.
 */

// ─── Configuration ───

export interface PaymentConfig {
  /** SePay credentials */
  sepay?: {
    merchantId: string;
    secretKey: string;
    env?: 'sandbox' | 'production';
    successUrl?: string;
    errorUrl?: string;
    cancelUrl?: string;
  };
  /** MoMo credentials */
  momo?: {
    endpoint?: string;
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    redirectUrl?: string;
    ipnUrl?: string;
  };
  /** ZaloPay credentials */
  zalopay?: {
    endpoint?: string;
    appId: string;
    key1: string;
    key2: string;
    redirectUrl?: string;
    callbackUrl?: string;
  };
  /** payOS credentials */
  payos?: {
    clientId: string;
    apiKey: string;
    checksumKey: string;
    cancelUrl?: string;
    returnUrl?: string;
  };
  /** Stripe credentials */
  stripe?: {
    secretKey: string;
    webhookSecret?: string;
    successUrl?: string;
    cancelUrl?: string;
  };
  /** Product internal URLs for notifications */
  productUrls?: Record<string, string>;
}

// ─── Payment ───

export type PaymentMethod = 'sepay' | 'momo' | 'zalopay' | 'payos' | 'stripe';

export type PaymentStatus =
  | 'pending'
  | 'completed'
  | 'failed'
  | 'refunded'
  | 'partially_refunded';

export interface IPayment {
  _id: any;
  product: string;
  user_id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  plan: string;
  status: PaymentStatus;
  provider_transaction_id?: string;
  confirmed_by?: string;
  confirmed_at?: Date;
  refunded_at?: Date;
  refund_amount?: number;
  refund_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at?: Date;
}

export interface CreatePaymentInput {
  product: string;
  userId: string;
  plan: string;
  method: PaymentMethod;
  amount: number;
  description?: string;
  email?: string;
  metadata?: Record<string, any>;
}

export interface CreatePaymentResult {
  orderId: string;
  payUrl?: string;
  qrCode?: string;
  sessionId?: string;
  metadata?: Record<string, any>;
}

// ─── Refund ───

export interface RefundRequest {
  orderId: string;
  amount: number;
  reason: string;
  providerTransactionId?: string;
  metadata?: Record<string, any>;
}

export interface RefundResult {
  success: boolean;
  refundId?: string;
  provider: string;
  amount: number;
  error?: string;
}

// ─── Reconciliation ───

export interface ProviderStatusResult {
  status: 'completed' | 'failed' | 'pending' | 'unknown';
  transactionId?: string;
  error?: string;
}

export interface ReconciliationResult {
  processed: number;
  updated: number;
  alerts: number;
  errors: string[];
}

// ─── Webhook ───

export interface WebhookVerifyResult {
  valid: boolean;
  orderId: string;
  success: boolean;
  transId: string;
  amount?: number;
  metadata?: Record<string, any>;
}
