/**
 * Zalo SSO Service — OAuth code exchange + user merge
 *
 * Handles both Zalo OAuth (web/app) and Zalo Mini App login flows.
 * Uses @winlux/zalo-sdk SSO module for token exchange and profile retrieval.
 *
 * Flow:
 *   1. Client sends Zalo auth code (from OAuth redirect or Mini App)
 *   2. Exchange code → get Zalo user profile (id, name, avatar, phone)
 *   3. Find existing user by zalo_id OR merge by phone number
 *   4. Create new user if no match found
 *   5. Return JWT + sanitized user
 *
 * @see Req 4.1 — POST /api/auth/zalo endpoint
 * @see Req 4.2 — Support OAuth + Mini App flows
 * @see Req 4.3 — Auto-create/merge user
 * @see Req 4.5 — Uses @winlux/zalo-sdk SSO module
 */

import jwt from 'jsonwebtoken';
import { ZaloSSO } from '@winlux/zalo-sdk';
import type { ZaloUser } from '@winlux/zalo-sdk';
import { User, IUser } from '../models/User';

// ─── Configuration ───

const JWT_SECRET = process.env.JWT_SECRET || 'winlux-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

const ZALO_APP_ID = process.env.ZALO_APP_ID || '';
const ZALO_APP_SECRET = process.env.ZALO_APP_SECRET || '';
const ZALO_CALLBACK_URL = process.env.ZALO_CALLBACK_URL || '';

/** Zalo Mini App uses a separate app ID/secret */
const ZALO_MINI_APP_ID = process.env.ZALO_MINI_APP_ID || ZALO_APP_ID;
const ZALO_MINI_APP_SECRET = process.env.ZALO_MINI_APP_SECRET || ZALO_APP_SECRET;

// ─── SSO Instances ───

const zaloSSO = new ZaloSSO({
  appId: ZALO_APP_ID,
  appSecret: ZALO_APP_SECRET,
  callbackUrl: ZALO_CALLBACK_URL,
});

const zaloMiniAppSSO = new ZaloSSO({
  appId: ZALO_MINI_APP_ID,
  appSecret: ZALO_MINI_APP_SECRET,
});

// ─── Interfaces ───

export interface ZaloAuthInput {
  /** Zalo OAuth authorization code */
  code: string;
  /** Product identifier (e.g., 'smartbuy', 'fintax', 'caremate') */
  product: string;
  /** Whether this is a Zalo Mini App login (uses different app credentials) */
  mini_app?: boolean;
}

export interface ZaloAuthResult {
  /** JWT access token */
  token: string;
  /** Sanitized user object */
  user: {
    id: string;
    email?: string;
    name: string;
    phone?: string;
    avatar_url?: string;
    is_verified: boolean;
    isPremium: boolean;
    premium_until?: Date;
  };
}

// ─── Main Service Function ───

/**
 * Authenticate a user via Zalo OAuth code exchange.
 *
 * Supports two flows:
 * - **OAuth flow** (web/app):  Standard Zalo OAuth redirect with code
 * - **Mini App flow**:  Zalo Mini App provides code with separate credentials
 *
 * User merge logic:
 * 1. Find existing user by `zalo_id`
 * 2. If not found and phone available, merge with existing phone-based account
 * 3. If no match at all, create a new user
 *
 * @param input - Auth code, product name, and flow type
 * @returns JWT token and sanitized user data
 * @throws Error if code exchange fails or Zalo API returns an error
 */
export async function authenticateWithZalo(input: ZaloAuthInput): Promise<ZaloAuthResult> {
  const { code, product, mini_app } = input;

  // Step 1: Exchange code for Zalo profile using the appropriate SSO instance
  const sso = mini_app ? zaloMiniAppSSO : zaloSSO;
  const { user: zaloProfile } = await sso.exchangeCode(code);

  // Step 2: Find existing user by Zalo ID
  let user = await User.findOne({ zalo_id: zaloProfile.id });

  // Step 3: If not found, try matching by phone (merge accounts)
  if (!user && zaloProfile.phone) {
    const normalizedPhone = normalizePhone(zaloProfile.phone);
    user = await User.findOne({ phone: normalizedPhone });
    if (user) {
      // Link Zalo ID to existing phone-based account
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

  // Step 4: If still not found, create new user
  if (!user) {
    user = await User.create({
      name: zaloProfile.name,
      zalo_id: zaloProfile.id,
      phone: zaloProfile.phone ? normalizePhone(zaloProfile.phone) : undefined,
      avatar_url: zaloProfile.avatar,
      auth_method: 'zalo',
      is_verified: true,
      products: [product].filter(Boolean),
    });
  } else {
    // Update last login and add product if new
    user.last_login_at = new Date();
    if (product && !user.products.includes(product)) {
      user.products.push(product);
    }
    await user.save();
  }

  // Step 5: Generate JWT
  const token = generateToken(user);

  return {
    token,
    user: sanitizeUser(user),
  };
}

// ─── Helper Functions ───

/**
 * Normalize VN phone number to local format (0xxxxxxxxx).
 * Handles: +84xxx, 84xxx, 0xxx formats.
 */
function normalizePhone(phone: string): string {
  // Strip all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // Handle +84 or 84 prefix → convert to 0-prefix
  if (digits.startsWith('84') && digits.length === 11) {
    digits = '0' + digits.slice(2);
  }

  // Ensure starts with 0
  if (!digits.startsWith('0') && digits.length === 9) {
    digits = '0' + digits;
  }

  return digits;
}

/**
 * Generate a JWT token for the authenticated user.
 */
function generateToken(user: any): string {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      isPremium: !!user.premium_until && new Date(user.premium_until) > new Date(),
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN },
  );
}

/**
 * Strip sensitive fields from user object for client response.
 */
function sanitizeUser(user: any) {
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
