/**
 * Feature Flag Express Middleware - Nov 2026 Release
 * 
 * Middleware for Express.js backends to check feature flags.
 * Returns 403 with disabled feature response when AI features are accessed.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Request, Response, NextFunction } from 'express';
import { AppName, FeatureName } from './types';
import { getFeatureFlagService } from './service';

// ═══════════════════════════════════════════════════════════════
//  TYPE EXTENSIONS
// ═══════════════════════════════════════════════════════════════

declare global {
  namespace Express {
    interface Request {
      featureFlags?: {
        app: AppName;
        isEnabled: (feature: string) => boolean;
        getDisabledResponse: (feature: FeatureName) => object;
      };
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  MIDDLEWARE FACTORY
// ═══════════════════════════════════════════════════════════════

/**
 * Create feature flag middleware for a specific app
 * 
 * Usage:
 * ```typescript
 * app.use(createFeatureFlagMiddleware('trendbrief'));
 * ```
 */
export function createFeatureFlagMiddleware(app: AppName) {
  const service = getFeatureFlagService();

  return (req: Request, _res: Response, next: NextFunction): void => {
    req.featureFlags = {
      app,
      isEnabled: (feature: string) => service.isFeatureEnabled(app, feature),
      getDisabledResponse: (feature: FeatureName) => service.getDisabledFeatureResponse(feature),
    };
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE CHECK MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * Middleware to require a specific feature to be enabled
 * Returns 403 with disabled feature response if not enabled
 * 
 * Usage:
 * ```typescript
 * app.post('/api/summarize', 
 *   requireFeature('trendbrief', 'SUMMARIZE_URL'),
 *   summarizeController
 * );
 * ```
 */
export function requireFeature(app: AppName, feature: FeatureName) {
  const service = getFeatureFlagService();

  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!service.isFeatureEnabled(app, feature)) {
      res.status(403).json(service.getDisabledFeatureResponse(feature));
      return;
    }
    next();
  };
}

/**
 * Middleware to require global AI to be enabled
 * Returns 403 if AI is globally disabled
 * 
 * Usage:
 * ```typescript
 * app.use('/api/ai/*', requireAIEnabled());
 * ```
 */
export function requireAIEnabled() {
  const service = getFeatureFlagService();

  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!service.isAIEnabled()) {
      res.status(403).json(service.getDisabledFeatureResponse('AI_ENABLED'));
      return;
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
//  CONDITIONAL ROUTE MIDDLEWARE
// ═══════════════════════════════════════════════════════════════

/**
 * Skip route entirely if feature is disabled (returns 404)
 * Use this for routes that should be completely hidden
 * 
 * Usage:
 * ```typescript
 * app.post('/api/ai/chat',
 *   hideIfDisabled('trendbrief', 'AI_CHAT'),
 *   chatController
 * );
 * ```
 */
export function hideIfDisabled(app: AppName, feature: string) {
  const service = getFeatureFlagService();

  return (_req: Request, res: Response, next: NextFunction): void => {
    if (!service.isFeatureEnabled(app, feature)) {
      // Return 404 - route doesn't exist (feature is hidden)
      res.status(404).json({
        error: 'not_found',
        message: 'Resource not found',
      });
      return;
    }
    next();
  };
}

/**
 * Redirect to alternative if feature is disabled
 * 
 * Usage:
 * ```typescript
 * app.get('/api/ai/briefing',
 *   redirectIfDisabled('trendbrief', 'BRIEFING', '/api/news/list'),
 *   briefingController
 * );
 * ```
 */
export function redirectIfDisabled(app: AppName, feature: string, redirectPath: string) {
  const service = getFeatureFlagService();

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!service.isFeatureEnabled(app, feature)) {
      // Redirect to alternative endpoint
      res.redirect(307, redirectPath);
      return;
    }
    next();
  };
}

// ═══════════════════════════════════════════════════════════════
//  FEATURE FLAGS API ENDPOINT
// ═══════════════════════════════════════════════════════════════

/**
 * Create endpoint handler that returns current feature flags for an app
 * 
 * Usage:
 * ```typescript
 * app.get('/api/features', createFeatureFlagsEndpoint('trendbrief'));
 * ```
 */
export function createFeatureFlagsEndpoint(app: AppName) {
  const service = getFeatureFlagService();

  return (_req: Request, res: Response): void => {
    const flags = service.getAppFlags(app);
    const enabled = service.getEnabledFeatures(app);
    const disabledAI = service.getDisabledAIFeatures(app);

    res.json({
      app,
      flags,
      summary: {
        enabled,
        disabledAIFeatures: disabledAI,
        aiEnabled: service.isAIEnabled(),
      },
    });
  };
}

// ═══════════════════════════════════════════════════════════════
//  ERROR HANDLER
// ═══════════════════════════════════════════════════════════════

/**
 * Error handler for feature flag related errors
 */
export function featureFlagErrorHandler(
  err: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err.message?.includes('feature_disabled')) {
    res.status(403).json({
      error: 'feature_disabled',
      message: err.message,
    });
    return;
  }
  next(err);
}
