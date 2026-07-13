import { Schema, model, Types } from 'mongoose';

export interface IPayment {
  product: string;          // trendbriefai | smartbuy | fintax | caremate
  user_id: string;
  order_id: string;
  amount: number;
  currency: string;
  method: 'sepay' | 'momo' | 'zalopay' | 'payos' | 'stripe';
  plan: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  provider_transaction_id?: string;
  confirmed_by?: string;
  confirmed_at?: Date;
  refunded_at?: Date;
  refund_amount?: number;
  refund_reason?: string;
  metadata?: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

const paymentSchema = new Schema<IPayment>({
  product: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  order_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  method: { type: String, required: true, enum: ['sepay', 'momo', 'zalopay', 'payos', 'stripe'] },
  plan: { type: String, required: true },
  status: { type: String, default: 'pending', enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'] },
  provider_transaction_id: String,
  confirmed_by: String,
  confirmed_at: Date,
  refunded_at: Date,
  refund_amount: Number,
  refund_reason: String,
  metadata: { type: Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

paymentSchema.index({ status: 1, created_at: -1 });
paymentSchema.index({ product: 1, status: 1 });
paymentSchema.index({ method: 1, status: 1 });

export const Payment = model<IPayment>('Payment', paymentSchema);
