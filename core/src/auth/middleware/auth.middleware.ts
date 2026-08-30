/**
 * Auth Middleware — JWT verification for protected routes
 */
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { verifyToken, type TokenConfig } from '../services/token.service.js';
import type { AuthenticatedRequest, TokenPayload } from '../types.js';

export interface AuthMiddlewareConfig extends TokenConfig {
  /** Custom error message for unauthorized requests */
  unauthorizedMessage?: string;
}

/**
 * Create middleware that requires a valid JWT token.
 *
 * Usage:
 *   app.get('/api/profile', requireAuth({ jwtSecret }), handler);
 */
export function requireAuth(config: AuthMiddlewareConfig): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({
        error: config.unauthorizedMessage || 'Unauthorized — Token required',
      });
      return;
    }

    const token = authHeader.slice(7);
    const payload = verifyToken(token, config);

    if (!payload) {
      res.status(401).json({
        error: config.unauthorizedMessage || 'Unauthorized — Invalid or expired token',
      });
      return;
    }

    // Attach user payload to request
    (req as AuthenticatedRequest).user = payload;
    next();
  };
}

/**
 * Create middleware that optionally parses JWT if present.
 * Does not reject requests without a token.
 *
 * Usage:
 *   app.get('/api/content', optionalAuth({ jwtSecret }), handler);
 */
export function optionalAuth(config: TokenConfig): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const payload = verifyToken(token, config);
      if (payload) {
        (req as AuthenticatedRequest).user = payload;
      }
    }

    next();
  };
}

/**
 * Extract user from request (use after requireAuth or optionalAuth).
 */
export function getUser(req: Request): TokenPayload | undefined {
  return (req as AuthenticatedRequest).user;
}

/**
 * Check if request has an authenticated user.
 */
export function isAuthenticated(req: Request): boolean {
  return !!(req as AuthenticatedRequest).user;
}

/**
 * Check if authenticated user has premium status.
 */
export function isPremium(req: Request): boolean {
  const user = (req as AuthenticatedRequest).user;
  return !!user?.isPremium;
}
