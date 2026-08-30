/**
 * Shared auth types for all WinLux products.
 */
import type { Request } from 'express';

// ─── Configuration ───

export interface AuthConfig {
  /** JWT secret key */
  jwtSecret: string;
  /** JWT expiration (e.g., '7d', '24h') */
  jwtExpiresIn?: string;
  /** Google OAuth client ID (for verification) */
  googleClientId?: string;
  /** Zalo OAuth credentials */
  zalo?: {
    appId: string;
    appSecret: string;
    callbackUrl?: string;
  };
  /** Zalo Mini App credentials (separate from OAuth) */
  zaloMiniApp?: {
    appId: string;
    appSecret: string;
  };
  /** Redis URL for OTP storage */
  redisUrl?: string;
  /** eSMS.vn credentials for OTP SMS */
  sms?: {
    apiKey: string;
    secretKey: string;
    brandName?: string;
  };
}

// ─── Google SSO ───

export interface GoogleUser {
  sub: string;
  email: string;
  name: string;
  picture: string;
  email_verified: boolean;
}

// ─── Zalo SSO ───

export interface ZaloAuthInput {
  /** Zalo OAuth authorization code */
  code: string;
  /** Product identifier (e.g., 'smartbuy', 'fintax', 'caremate') */
  product: string;
  /** Whether this is a Zalo Mini App login */
  mini_app?: boolean;
}

export interface ZaloAuthResult {
  /** JWT access token */
  token: string;
  /** Sanitized user object */
  user: SanitizedUser;
}

// ─── Token ───

export interface TokenPayload {
  id: string;
  email?: string;
  name: string;
  isPremium: boolean;
  iat?: number;
  exp?: number;
}

// ─── User ───

export interface IUser {
  _id: any;
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
  bundle_active?: boolean;
  bundle_products?: string[];
  last_login_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface SanitizedUser {
  id: string;
  email?: string;
  name: string;
  phone?: string;
  avatar_url?: string;
  is_verified: boolean;
  isPremium: boolean;
  premium_until?: Date;
}

// ─── Express Extensions ───

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload;
}
