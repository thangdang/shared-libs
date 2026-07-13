import { Schema, model } from 'mongoose';

export interface IUser {
  email?: string;
  phone?: string;
  password_hash?: string;
  name: string;
  avatar_url?: string;
  auth_method: 'email' | 'google' | 'otp' | 'zalo';
  google_id?: string;
  zalo_id?: string;
  is_verified: boolean;
  products: string[];
  premium_until?: Date;
  subscription_plan?: string;
  subscription_activated_at?: Date;
  last_login_at?: Date;
  created_at: Date;
}

const userSchema = new Schema<IUser>({
  email: { type: String, sparse: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  password_hash: String,
  name: { type: String, required: true },
  avatar_url: String,
  auth_method: { type: String, required: true, enum: ['email', 'google', 'otp', 'zalo'] },
  google_id: { type: String, sparse: true },
  zalo_id: { type: String, sparse: true, unique: true },
  is_verified: { type: Boolean, default: false },
  products: { type: [String], default: [] }, // which products user has used
  premium_until: Date,
  subscription_plan: String,
  subscription_activated_at: Date,
  last_login_at: Date,
}, { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } });

userSchema.index({ email: 1 });
userSchema.index({ phone: 1 });
userSchema.index({ google_id: 1 });
userSchema.index({ zalo_id: 1 });

export const User = model<IUser>('User', userSchema);
