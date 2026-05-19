/**
 * Token Routes — Verify and refresh JWT tokens
 * Called by product services to validate incoming requests
 */
import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'winlux-jwt-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

/**
 * POST /api/auth/token/verify — Verify a JWT token (called by product services)
 */
router.post('/verify', (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ valid: false, error: 'No token' }); return; }

    const decoded = jwt.verify(token, JWT_SECRET) as any;
    res.json({ valid: true, user: decoded });
  } catch (error) {
    res.json({ valid: false, error: 'Invalid or expired token' });
  }
});

/**
 * POST /api/auth/token/refresh — Refresh an expiring token
 */
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token) { res.status(400).json({ error: 'No token' }); return; }

    const decoded = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true }) as any;
    const user = await User.findById(decoded.id).lean();
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }

    const newToken = jwt.sign(
      {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        isPremium: !!user.premium_until && new Date(user.premium_until) > new Date(),
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN },
    );

    res.json({ token: newToken });
  } catch (error) {
    res.status(401).json({ error: 'Cannot refresh token' });
  }
});

/**
 * GET /api/auth/token/public-key — Get JWT public key (for product services to verify locally)
 * In symmetric JWT (HS256), this returns the shared secret hint
 */
router.get('/public-key', (_req: Request, res: Response) => {
  // Product services should use the same JWT_SECRET env var
  // This endpoint just confirms the algorithm
  res.json({ algorithm: 'HS256', hint: 'Use JWT_SECRET env var to verify tokens locally' });
});

export { router as tokenRoutes };
