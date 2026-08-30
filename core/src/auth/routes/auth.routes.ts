/**
 * Auth Routes Factory — Register, Login, OTP, Google SSO, Zalo SSO
 *
 * Creates an Express router with all auth endpoints.
 * Apps can mount this router or use individual services directly.
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Model } from 'mongoose';
import type { IUser, AuthConfig, SanitizedUser } from '../types.js';
import { generateToken, TokenConfig } from '../services/token.service.js';
import { verifyGoogleToken } from '../services/google.service.js';
import { authenticateWithZalo, sanitizeUser } from '../services/zalo.service.js';
import { OTPService } from '../services/otp.service.js';

export interface AuthRoutesConfig extends TokenConfig {
  /** User model from the app */
  userModel: Model<IUser>;
  /** Google OAuth client ID */
  googleClientId?: string;
  /** Zalo OAuth credentials */
  zalo?: {
    appId: string;
    appSecret: string;
    callbackUrl?: string;
  };
  /** Zalo Mini App credentials */
  zaloMiniApp?: {
    appId: string;
    appSecret: string;
  };
  /** Redis URL for OTP */
  redisUrl?: string;
  /** eSMS.vn credentials */
  sms?: {
    apiKey: string;
    secretKey: string;
    brandName?: string;
  };
}

/**
 * Create auth routes with the provided configuration.
 */
export function createAuthRoutes(config: AuthRoutesConfig): Router {
  const router = Router();
  const { userModel, jwtSecret, jwtExpiresIn } = config;

  const tokenConfig: TokenConfig = { jwtSecret, jwtExpiresIn };

  // OTP service instance (lazy init)
  let otpService: OTPService | null = null;
  const getOTPService = () => {
    if (!otpService) {
      otpService = new OTPService({
        redisUrl: config.redisUrl,
        sms: config.sms,
      });
    }
    return otpService;
  };

  /**
   * POST /register — Email + password registration
   */
  router.post('/register', async (req: Request, res: Response) => {
    try {
      const { email, password, name, phone, product } = req.body;

      if (!email || !password) {
        res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
        return;
      }

      const existing = await userModel.findOne({ email: email.toLowerCase() });
      if (existing) {
        res.status(409).json({ error: 'Email đã được đăng ký' });
        return;
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const user = await userModel.create({
        email: email.toLowerCase(),
        password_hash: passwordHash,
        name: name || email.split('@')[0],
        phone,
        products: [product].filter(Boolean),
        auth_method: 'email',
      });

      const token = generateToken(user, tokenConfig);
      res.status(201).json({ token, user: sanitizeUser(user) });
    } catch (error) {
      res.status(500).json({ error: 'Đăng ký thất bại' });
    }
  });

  /**
   * POST /login — Email + password login
   */
  router.post('/login', async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;

      const user = await userModel.findOne({ email: email.toLowerCase() });
      if (!user || !user.password_hash) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        return;
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        res.status(401).json({ error: 'Email hoặc mật khẩu không đúng' });
        return;
      }

      user.last_login_at = new Date();
      await user.save();

      const token = generateToken(user, tokenConfig);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      res.status(500).json({ error: 'Đăng nhập thất bại' });
    }
  });

  /**
   * POST /google — Google SSO login/register
   */
  router.post('/google', async (req: Request, res: Response) => {
    try {
      const { idToken, product } = req.body;

      const googleUser = await verifyGoogleToken(idToken, {
        googleClientId: config.googleClientId,
      });

      if (!googleUser) {
        res.status(401).json({ error: 'Google token không hợp lệ' });
        return;
      }

      let user = await userModel.findOne({ email: googleUser.email });
      if (!user) {
        user = await userModel.create({
          email: googleUser.email,
          name: googleUser.name,
          avatar_url: googleUser.picture,
          auth_method: 'google',
          google_id: googleUser.sub,
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

      const token = generateToken(user, tokenConfig);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      res.status(500).json({ error: 'Google login thất bại' });
    }
  });

  /**
   * POST /zalo — Zalo SSO login/register (OAuth + Mini App)
   */
  router.post('/zalo', async (req: Request, res: Response) => {
    try {
      const { code, product, mini_app } = req.body;

      if (!code || !product) {
        res.status(400).json({ error: 'code và product là bắt buộc' });
        return;
      }

      const zaloConfig = mini_app ? config.zaloMiniApp : config.zalo;
      if (!zaloConfig) {
        res.status(500).json({ error: 'Zalo SSO not configured' });
        return;
      }

      const result = await authenticateWithZalo(
        { code, product, mini_app },
        userModel,
        {
          appId: zaloConfig.appId,
          appSecret: zaloConfig.appSecret,
          callbackUrl: (config.zalo as any)?.callbackUrl,
          jwtSecret,
          jwtExpiresIn,
        }
      );

      res.json({ success: true, data: { token: result.token, user: result.user } });
    } catch (error) {
      res.status(500).json({ error: 'Zalo login thất bại' });
    }
  });

  /**
   * POST /otp/send — Send OTP via SMS
   */
  router.post('/otp/send', async (req: Request, res: Response) => {
    try {
      const { phone } = req.body;
      if (!phone) {
        res.status(400).json({ error: 'Số điện thoại là bắt buộc' });
        return;
      }

      await getOTPService().send(phone);
      res.json({ success: true, message: 'OTP đã được gửi' });
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Gửi OTP thất bại' });
    }
  });

  /**
   * POST /otp/verify — Verify OTP and login/register
   */
  router.post('/otp/verify', async (req: Request, res: Response) => {
    try {
      const { phone, otp, product } = req.body;

      const valid = await getOTPService().verify(phone, otp);
      if (!valid) {
        res.status(401).json({ error: 'OTP không đúng hoặc đã hết hạn' });
        return;
      }

      let user = await userModel.findOne({ phone });
      if (!user) {
        user = await userModel.create({
          phone,
          name: `User ${phone.slice(-4)}`,
          auth_method: 'otp',
          is_verified: true,
          products: [product].filter(Boolean),
        });
      } else {
        user.last_login_at = new Date();
        await user.save();
      }

      const token = generateToken(user, tokenConfig);
      res.json({ token, user: sanitizeUser(user) });
    } catch (error) {
      res.status(500).json({ error: 'Xác thực OTP thất bại' });
    }
  });

  return router;
}
