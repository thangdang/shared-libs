/**
 * User Schema — Optional schema definition for apps that want to use it
 *
 * Apps can either:
 * 1. Use createUserSchema() to get a Mongoose schema
 * 2. Use UserSchemaFields to define their own schema with custom fields
 * 3. Create their own User model entirely
 */
import { Schema, type SchemaDefinition } from 'mongoose';
import type { IUser } from '../types.js';

/**
 * Schema field definitions for User model.
 * Apps can spread this into their own schema with custom fields.
 */
export const UserSchemaFields: SchemaDefinition<IUser> = {
  email: { type: String, sparse: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  password_hash: String,
  name: { type: String, required: true },
  avatar_url: String,
  auth_method: {
    type: String,
    required: true,
    enum: ['email', 'google', 'otp', 'zalo'],
  },
  google_id: { type: String, sparse: true },
  zalo_id: { type: String, sparse: true, unique: true },
  is_verified: { type: Boolean, default: false },
  products: { type: [String], default: [] },
  premium_until: Date,
  subscription_plan: String,
  subscription_activated_at: Date,
  bundle_active: { type: Boolean, default: false },
  bundle_products: { type: [String], default: [] },
  last_login_at: Date,
};

/**
 * Create a Mongoose schema for User with standard indexes.
 *
 * @param additionalFields - Extra fields to add to the schema
 * @returns Mongoose Schema
 */
export function createUserSchema<T extends IUser = IUser>(
  additionalFields?: SchemaDefinition<Partial<T>>
): Schema<T> {
  const schema = new Schema<T>(
    {
      ...UserSchemaFields,
      ...additionalFields,
    } as SchemaDefinition<T>,
    {
      timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }
  );

  // Standard indexes
  schema.index({ email: 1 });
  schema.index({ phone: 1 });
  schema.index({ google_id: 1 });
  schema.index({ zalo_id: 1 });

  return schema;
}
