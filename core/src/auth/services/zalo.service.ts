/**
 * Zalo SSO Service — OAuth code exchange + user merge
 *
 * Handles both Zalo OAuth (web/app) and Zalo Mini App login flows.
 * Uses @winlux/zalo-sdk SSO module for token exchange and profile retrieval.
 */
import type { Model } from 'mongoose';
import type { ZaloAuthInput, ZaloAuthResult, IUser, AuthConfig, SanitizedUser } from '../types.js';
import { generateToken } from './token.service.js';

// ─── Interfaces ───

export interface ZaloUser {
  id: string;
  name: string;
  avatar?: string;
  phone?: string;
}

export interface ZaloServiceConfig {
  appId: string;
  appSecret: string;
  callbackUrl?: string;
  jwtSecret: string;
  jwtExpiresIn?: string;
}

// ─── Helper Functions ───

/**
 * Normalize VN phone number to local format (0xxxxxxxxx).
 */
export function normalizePhone(phone: string): string {
  let digits = phone.replace(/\D/g, '');

  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  if (!digits.startsWith('0') && digits.length === 9) {
    digits = '0' + digits;
  }

  return digits;
}

/**
 * Strip sensitive fields from user object for client response.
 */
export function sanitizeUser(user: IUser): SanitizedUser {
  return {
    id: user._id.toString(),
    email: user.email,
    name: user.name,
    phone: user.phone,
    avatar_url: user.avatar_url,
    is_verified: user.is_verified,
    isPremium: !!user.premium_until && new Date(user.premium_until) > new Date(),
    premium_until: user.premium_until,
  };
}

/**
 * Authenticate a user via Zalo OAuth code exchange.
 *
 * @param input - Auth code, product name, and flow type
 * @param userModel - Mongoose User model from the app
 * @param config - Zalo service configuration
 * @returns JWT token and sanitized user data
 */
export async function authenticateWithZalo(
  input: ZaloAuthInput,
  userModel: Model<IUser>,
  config: ZaloServiceConfig
): Promise<ZaloAuthResult> {
  const { code, product, mini_app } = input;

  // Dynamic import to avoid hard dependency on zalo-sdk
  let ZaloSSO: any;
  try {
    const zaloSdk = await import('@winlux/zalo-sdk');
    ZaloSSO = zaloSdk.ZaloSSO;
  } catch {
    throw new Error('Zalo SSO requires @winlux/zalo-sdk to be installed');
  }

  const sso = new ZaloSSO({
    appId: config.appId,
    appSecret: config.appSecret,
    callbackUrl: config.callbackUrl,
  });

  // Exchange code for Zalo profile
  const { user: zaloProfile } = await sso.exchangeCode(code);

  // Find existing user by Zalo ID
  let user = await userModel.findOne({ zalo_id: zaloProfile.id });

  // If not found, try matching by phone (merge accounts)
  if (!user && zaloProfile.phone) {
    const normalizedPhone = normalizePhone(zaloProfile.phone);
    user = await userModel.findOne({ phone: normalizedPhone });
    if (user) {
      user.zalo_id = zaloProfile.id;
      if (zaloProfile.avatar && !user.avatar_url) {
        user.avatar_url = zaloProfile.avatar;
      }
      if (zaloProfile.name && !user.name) {
        user.name = zaloProfile.name;
      }
      await user.save();
    }
  }

  // If still not found, create new user
  if (!user) {
    user = await userModel.create({
      name: zaloProfile.name,
      zalo_id: zaloProfile.id,
      phone: zaloProfile.phone ? normalizePhone(zaloProfile.phone) : undefined,
      avatar_url: zaloProfile.avatar,
      auth_method: 'zalo',
      is_verified: true,
      products: [product].filter(Boolean),
    });
  } else {
    user.last_login_at = new Date();
    if (product && !user.products.includes(product)) {
      user.products.push(product);
    }
    await user.save();
  }

  const token = generateToken(user, {
    jwtSecret: config.jwtSecret,
    jwtExpiresIn: config.jwtExpiresIn,
  });

  return {
    token,
    user: sanitizeUser(user),
  };
}

/**
 * Zalo SSO service class for object-oriented usage.
 */
export class ZaloService {
  private config: ZaloServiceConfig;

  constructor(config: ZaloServiceConfig) {
    this.config = config;
  }

  async authenticate(
    input: ZaloAuthInput,
    userModel: Model<IUser>
  ): Promise<ZaloAuthResult> {
    return authenticateWithZalo(input, userModel, this.config);
  }
}
