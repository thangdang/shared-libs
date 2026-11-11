/**
 * Payment Collection Schema - MON-005
 * VNPay, MoMo transaction records
 */
import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  user_id: mongoose.Types.ObjectId;
  subscription_id?: mongoose.Types.ObjectId;
  provider: 'vnpay' | 'momo' | 'bank_transfer';
  transaction_id: string;
  provider_transaction_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  metadata: Record<string, any>;
  created_at: Date;
  completed_at?: Date;
}

const PaymentSchema = new Schema<IPayment>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  subscription_id: { type: Schema.Types.ObjectId, ref: 'Subscription' },
  provider: { type: String, enum: ['vnpay', 'momo', 'bank_transfer'], required: true },
  transaction_id: { type: String, required: true, unique: true },
  provider_transaction_id: { type: String, index: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  status: { type: String, enum: ['pending', 'completed', 'failed', 'refunded'], default: 'pending' },
  metadata: { type: Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
  completed_at: { type: Date }
}, { collection: 'payments' });

PaymentSchema.index({ status: 1, created_at: -1 });
PaymentSchema.index({ provider: 1, provider_transaction_id: 1 });

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);
