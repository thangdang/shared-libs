/**
 * Subscription Collection Schema - MON-006
 * User subscription management
 */
import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionTier = 'free' | 'basic' | 'premium';
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'past_due';

export interface ISubscription extends Document {
  user_id: mongoose.Types.ObjectId;
  app_id: string;
  tier: SubscriptionTier;
  status: SubscriptionStatus;
  started_at: Date;
  expires_at: Date;
  cancelled_at?: Date;
  auto_renew: boolean;
  payment_method?: string;
  last_payment_id?: mongoose.Types.ObjectId;
  features: string[];
  limits: Record<string, number>;
  created_at: Date;
  updated_at: Date;
}

const SubscriptionSchema = new Schema<ISubscription>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  app_id: { type: String, required: true, enum: ['trendbrief', 'smartbuy', 'fintax', 'doctorcar', 'caremate'] },
  tier: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
  status: { type: String, enum: ['active', 'expired', 'cancelled', 'past_due'], default: 'active' },
  started_at: { type: Date, default: Date.now },
  expires_at: { type: Date, required: true, index: true },
  cancelled_at: { type: Date },
  auto_renew: { type: Boolean, default: true },
  payment_method: { type: String },
  last_payment_id: { type: Schema.Types.ObjectId, ref: 'Payment' },
  features: [{ type: String }],
  limits: { type: Schema.Types.Mixed, default: {} },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, { collection: 'subscriptions' });

SubscriptionSchema.index({ user_id: 1, app_id: 1 }, { unique: true });
SubscriptionSchema.index({ status: 1, expires_at: 1 });

export const Subscription = mongoose.model<ISubscription>('Subscription', SubscriptionSchema);
