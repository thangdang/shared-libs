/**
 * @winlux/auth
 *
 * Shared authentication library for all WinLux products.
 * Provides reusable services, middleware, and route factories.
 *
 * Usage in apps:
 *
 *   import {
 *     createAuthRoutes,
 *     verifyToken,
 *     requireAuth,
 *     GoogleService,
 *     ZaloService,
 *     OTPService,
 *     TokenService,
 *   } from '@winlux/auth';
 *
 *   // Mount full auth routes (optional)
 *   app.use('/api/auth', createAuthRoutes({ userModel: MyUser }));
 *
 *   // Or use services directly
 *   const googleUser = await GoogleService.verifyToken(idToken);
 *
 *   // Protect routes with middleware
 *   app.get('/api/profile', requireAuth(), (req, res) => {
 *     res.json(req.user);
 *   });
 */

// ─── Services ───
export { GoogleService, verifyGoogleToken } from './services/google.service.js';
export { ZaloService, authenticateWithZalo } from './services/zalo.service.js';
export { OTPService, sendOTP, verifyOTP } from './services/otp.service.js';
export { TokenService, generateToken, verifyToken, refreshToken } from './services/token.service.js';

// ─── Middleware ───
export { requireAuth, optionalAuth } from './middleware/auth.middleware.js';

// ─── Route Factories ───
export { createAuthRoutes } from './routes/auth.routes.js';
export { createUserRoutes } from './routes/user.routes.js';
export { createTokenRoutes } from './routes/token.routes.js';

// ─── Types ───
export type {
  AuthConfig,
  GoogleUser,
  ZaloAuthInput,
  ZaloAuthResult,
  TokenPayload,
  AuthenticatedRequest,
  IUser,
} from './types.js';

// ─── Schema (optional — apps can use their own User model) ───
export { createUserSchema, UserSchemaFields } from './models/user.schema.js';
