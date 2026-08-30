/**
 * Auth Service Client
 * ───────────────────
 * Drop this file into any product service's src/services/ folder.
 * Calls the shared auth-service at localhost:4100.
 *
 * For JWT verification, product services can verify locally using JWT_SECRET
 * (faster, no network hop) OR call auth-service for full verification.
 */
import axios from 'axios';
import jwt from 'jsonwebtoken';

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:4100';
const JWT_SECRET = process.env.JWT_SECRET || 'winlux-jwt-secret-change-me';

export interface AuthUser {
  id: string;
  email?: string;
  name: string;
  isPremium: boolean;
}

export interface LoginResult {
  success: boolean;
  token?: string;
  user?: AuthUser;
  error?: string;
}

/**
 * Register a new user.
 */
export async function register(email: string, password: string, name: string, product: string): Promise<LoginResult> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/register`, { email, password, name, product }, { timeout: 5000 });
    return { success: true, token: res.data.token, user: res.data.user };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Login with email + password.
 */
export async function login(email: string, password: string): Promise<LoginResult> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/login`, { email, password }, { timeout: 5000 });
    return { success: true, token: res.data.token, user: res.data.user };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Login/register with Google SSO.
 */
export async function googleAuth(idToken: string, product: string): Promise<LoginResult> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/google`, { idToken, product }, { timeout: 5000 });
    return { success: true, token: res.data.token, user: res.data.user };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Login/register with Zalo OAuth.
 */
export async function zaloAuth(code: string, product: string, miniApp?: boolean): Promise<LoginResult> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/zalo`, { code, product, mini_app: miniApp }, { timeout: 5000 });
    return { success: true, token: res.data.token, user: res.data.user };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Send OTP to phone number.
 */
export async function sendOTP(phone: string): Promise<{ success: boolean; error?: string }> {
  try {
    await axios.post(`${AUTH_SERVICE_URL}/api/auth/otp/send`, { phone }, { timeout: 5000 });
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Verify OTP and login/register.
 */
export async function verifyOTP(phone: string, otp: string, product: string): Promise<LoginResult> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/otp/verify`, { phone, otp, product }, { timeout: 5000 });
    return { success: true, token: res.data.token, user: res.data.user };
  } catch (error: any) {
    return { success: false, error: error.response?.data?.error || error.message };
  }
}

/**
 * Verify JWT token LOCALLY (no network hop — fastest).
 * Use this in auth middleware for every request.
 */
export function verifyTokenLocal(token: string): AuthUser | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    return {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      isPremium: decoded.isPremium || false,
    };
  } catch {
    return null;
  }
}

/**
 * Verify JWT token via auth-service (full verification, slower).
 * Use this only when you need fresh user data.
 */
export async function verifyTokenRemote(token: string): Promise<AuthUser | null> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/token/verify`, { token }, { timeout: 3000 });
    return res.data.valid ? res.data.user : null;
  } catch {
    return null;
  }
}

/**
 * Refresh an expiring token.
 */
export async function refreshToken(token: string): Promise<string | null> {
  try {
    const res = await axios.post(`${AUTH_SERVICE_URL}/api/auth/token/refresh`, { token }, { timeout: 3000 });
    return res.data.token;
  } catch {
    return null;
  }
}

/**
 * Activate premium for a user (called after payment success).
 */
export async function activatePremium(userId: string, plan: string, durationDays: number): Promise<boolean> {
  try {
    await axios.post(`${AUTH_SERVICE_URL}/api/auth/users/${userId}/activate-premium`, { plan, durationDays }, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * Express middleware factory — verifies JWT from Authorization header.
 * Uses local verification (fast, no network hop).
 */
export function authMiddleware() {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized — missing token' });
    }

    const token = authHeader.slice(7);
    const user = verifyTokenLocal(token);

    if (!user) {
      return res.status(401).json({ error: 'Unauthorized — invalid token' });
    }

    req.user = user;
    next();
  };
}

/**
 * Express middleware — requires premium subscription.
 */
export function premiumMiddleware() {
  return (req: any, res: any, next: any) => {
    if (!req.user?.isPremium) {
      return res.status(403).json({ error: 'Premium subscription required', upgrade_required: true });
    }
    next();
  };
}
