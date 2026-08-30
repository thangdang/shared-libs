/**
 * Payment Schema — Optional schema definition for apps that want to use it
 */
import { Schema, type SchemaDefinition } from 'mongoose';
import type { IPayment } from '../types.js';

/**
 * Schema field definitions for Payment model.
 */
export const PaymentSchemaFields: SchemaDefinition<IPayment> = {
  product: { type: String, required: true, index: true },
  user_id: { type: String, required: true, index: true },
  order_id: { type: String, required: true, unique: true },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'VND' },
  method: {
    type: String,
    required: true,
    enum: ['sepay', 'momo', 'zalopay', 'payos', 'stripe'],
  },
  plan: { type: String, required: true },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'completed', 'failed', 'refunded', 'partially_refunded'],
  },
  provider_transaction_id: String,
  confirmed_by: String,
  confirmed_at: Date,
  refunded_at: Date,
  refund_amount: Number,
  refund_reason: String,
  metadata: { type: Schema.Types.Mixed, default: {} },
};

/**
 * Create a Mongoose schema for Payment with standard indexes.
 */
export function createPaymentSchema<T extends IPayment = IPayment>(
  additionalFields?: SchemaDefinition<Partial<T>>
): Schema<T> {
  const schema = new Schema<T>(
    {
      ...PaymentSchemaFields,
      ...additionalFields,
    } as SchemaDefinition<T>,
    {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }
  );

  schema.index({ status: 1, created_at: -1 });
  schema.index({ product: 1, status: 1 });
  schema.index({ method: 1, status: 1 });

  return schema;
}
