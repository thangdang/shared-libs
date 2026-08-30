/**
 * Token Routes Factory — Verify and refresh JWT tokens
 */
import { Router, Request, Response } from 'express';
import type { Model } from 'mongoose';
import type { IUser } from '../types.js';
import {
  verifyToken,
  refreshToken as refreshTokenFn,
  TokenConfig,
} from '../services/token.service.js';

export interface TokenRoutesConfig extends TokenConfig {
  /** User model from the app */
  userModel: Model<IUser>;
}

/**
 * Create token routes with the provided configuration.
 */
export function createTokenRoutes(config: TokenRoutesConfig): Router {
  const router = Router();
  const { userModel, jwtSecret, jwtExpiresIn } = config;

  const tokenConfig: TokenConfig = { jwtSecret, jwtExpiresIn };

  /**
   * POST /verify — Verify a JWT token
   */
  router.post('/verify', (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ valid: false, error: 'No token' });
        return;
      }

      const decoded = verifyToken(token, tokenConfig);
      if (decoded) {
        res.json({ valid: true, user: decoded });
      } else {
        res.json({ valid: false, error: 'Invalid or expired token' });
      }
    } catch (error) {
      res.json({ valid: false, error: 'Invalid or expired token' });
    }
  });

  /**
   * POST /refresh — Refresh an expiring token
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const { token } = req.body;
      if (!token) {
        res.status(400).json({ error: 'No token' });
        return;
      }

      const getUserById = async (id: string) => {
        return userModel.findById(id).lean() as Promise<IUser | null>;
      };

      const newToken = await refreshTokenFn(token, getUserById, tokenConfig);

      if (!newToken) {
        res.status(401).json({ error: 'Cannot refresh token' });
        return;
      }

      res.json({ token: newToken });
    } catch (error) {
      res.status(401).json({ error: 'Cannot refresh token' });
    }
  });

  /**
   * GET /public-key — Get JWT algorithm hint
   */
  router.get('/public-key', (_req: Request, res: Response) => {
    res.json({
      algorithm: 'HS256',
      hint: 'Use JWT_SECRET env var to verify tokens locally',
    });
  });

  return router;
}
