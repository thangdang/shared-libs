/**
 * Auth Routes — Register, Login, OTP, Google SSO, Zalo SSO
 */
import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { sendOTP, verifyOTP } from '../services/otp.service';
import { verifyGoogleToken } from '../services/google.service';
import { authenticateWithZalo } from '../services/zalo.service';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'winlux-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/register — Email + password registration
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name, phone, product } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
      return;
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      res.status(409).json({ error: 'Email đã được đăng ký' });
      return;
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      email: email.toLowerCase(),
      password_hash: passwordHash,
      name: name || email.split('@')[0],
      phone,
      products: [product].filter(Boolean),
      auth_method: 'email',
    });

    const token = generateToken(user);
    res.status(201).json({ token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Đăng ký thất bại' });
  }
});

/**
 * POST /api/auth/login — Email + password login
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() });
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

    const token = generateToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Đăng nhập thất bại' });
  }
});

/**
 * POST /api/auth/google — Google SSO login/register
 */
router.post('/google', async (req: Request, res: Response) => {
  try {
    const { idToken, product } = req.body;
    const googleUser = await verifyGoogleToken(idToken);
    if (!googleUser) {
      res.status(401).json({ error: 'Google token không hợp lệ' });
      return;
    }

    let user = await User.findOne({ email: googleUser.email });
    if (!user) {
      user = await User.create({
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

    const token = generateToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Google login thất bại' });
  }
});

/**
 * POST /api/auth/zalo — Zalo SSO login/register (OAuth + Mini App)
 */
router.post('/zalo', async (req: Request, res: Response) => {
  try {
    const { code, product, mini_app } = req.body;

    if (!code || !product) {
      res.status(400).json({ error: 'code và product là bắt buộc' });
      return;
    }

    const result = await authenticateWithZalo({ code, product, mini_app });
    res.json({ success: true, data: { token: result.token, user: result.user } });
  } catch (error) {
    res.status(500).json({ error: 'Zalo login thất bại' });
  }
});

/**
 * POST /api/auth/otp/send — Send OTP via SMS (eSMS.vn)
 */
router.post('/otp/send', async (req: Request, res: Response) => {
  try {
    const { phone } = req.body;
    if (!phone) { res.status(400).json({ error: 'Số điện thoại là bắt buộc' }); return; }

    await sendOTP(phone);
    res.json({ success: true, message: 'OTP đã được gửi' });
  } catch (error) {
    res.status(500).json({ error: 'Gửi OTP thất bại' });
  }
});

/**
 * POST /api/auth/otp/verify — Verify OTP and login/register
 */
router.post('/otp/verify', async (req: Request, res: Response) => {
  try {
    const { phone, otp, product } = req.body;
    const valid = await verifyOTP(phone, otp);
    if (!valid) { res.status(401).json({ error: 'OTP không đúng hoặc đã hết hạn' }); return; }

    let user = await User.findOne({ phone });
    if (!user) {
      user = await User.create({
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

    const token = generateToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (error) {
    res.status(500).json({ error: 'Xác thực OTP thất bại' });
  }
});

// ─── Helpers ───

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

export { router as authRoutes };
