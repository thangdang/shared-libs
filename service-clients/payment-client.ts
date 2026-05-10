/**
 * Payment Service Client
 * ──────────────────────
 * Drop this file into any product service's src/services/ folder.
 * Calls the shared payment-service at localhost:3006.
 */
import axios from 'axios';

const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3006';

export interface CreatePaymentInput {
  product: string;
  userId: string;
  plan: string;
  method: 'momo' | 'zalopay' | 'payos' | 'stripe';
  amount: number;
  description?: string;
  email?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  payUrl?: string;
  qrCode?: string;
  error?: string;
}

export interface PaymentStatus {
  order_id: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  method: string;
  amount: number;
  created_at: string;
}

/**
 * Create a payment via shared payment service.
 */
export async function createPayment(input: CreatePaymentInput): Promise<PaymentResult> {
  try {
    const res = await axios.post(`${PAYMENT_SERVICE_URL}/api/payment/create`, input, { timeout: 10000 });
    return res.data;
  } catch (error: any) {
    return { success: false, orderId: '', error: error.response?.data?.error || error.message };
  }
}

/**
 * Check payment status.
 */
export async function getPaymentStatus(orderId: string): Promise<PaymentStatus | null> {
  try {
    const res = await axios.get(`${PAYMENT_SERVICE_URL}/api/payment/status/${orderId}`, { timeout: 5000 });
    return res.data.payment;
  } catch {
    return null;
  }
}

/**
 * Get available plans for a product.
 */
export async function getPlans(product: string): Promise<any[]> {
  try {
    const res = await axios.get(`${PAYMENT_SERVICE_URL}/api/payment/plans/${product}`, { timeout: 5000 });
    return res.data.plans;
  } catch {
    return [];
  }
}

/**
 * Get user's payment history.
 */
export async function getUserPayments(userId: string): Promise<PaymentStatus[]> {
  try {
    const res = await axios.get(`${PAYMENT_SERVICE_URL}/api/payment/user/${userId}`, { timeout: 5000 });
    return res.data.payments;
  } catch {
    return [];
  }
}
