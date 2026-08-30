/**
 * Standardized Analytics Events (T54 — REQ-43)
 *
 * Defines 10 standard events + Express middleware for auto-tracking.
 * All products emit the same event schema → backoffice can aggregate cross-product.
 *
 * Usage:
 *   import { analyticsMiddleware, trackStandardEvent, EVENTS } from '@winlux/service-clients/middleware/analytics-events';
 *
 *   // Auto-track page_view on all routes:
 *   app.use(analyticsMiddleware('smartbuy'));
 *
 *   // Manual event tracking:
 *   await trackStandardEvent('smartbuy', EVENTS.CLICK_AFFILIATE, userId, { product_id, platform });
 */

import { trackEvent } from '../analytics-client';

// ─── 10 Standard Events (cross-product) ──────────────────────────────────────

export const EVENTS = {
  /** User views a page/screen */
  PAGE_VIEW: 'page_view',
  /** User clicks an affiliate/partner link */
  CLICK_AFFILIATE: 'click_affiliate',
  /** User subscribes to a paid plan */
  SUBSCRIBE: 'subscribe',
  /** User cancels/downgrades subscription */
  UNSUBSCRIBE: 'unsubscribe',
  /** User sends a query to AI (symptom check, chat, diagnosis, etc.) */
  AI_QUERY: 'ai_query',
  /** Payment succeeds (subscription, one-time, top-up) */
  PAYMENT_SUCCESS: 'payment_success',
  /** Payment fails (card declined, timeout, etc.) */
  PAYMENT_FAILED: 'payment_failed',
  /** User shares content (Zalo, copy link, native share) */
  SHARE: 'share',
  /** User performs a search */
  SEARCH: 'search',
  /** User creates an account */
  SIGNUP: 'signup',
} as const;

export type StandardEvent = typeof EVENTS[keyof typeof EVENTS];

// ─── Event Properties Schema ─────────────────────────────────────────────────

/**
 * Standard properties attached to each event.
 * Products can add extra properties but these are always present.
 */
export interface StandardEventProperties {
  // Auto-populated by middleware:
  product: string;
  platform: 'web' | 'mobile' | 'zalo' | 'api';
  timestamp: string;
  session_id?: string;
  user_agent?: string;
  ip_hash?: string;  // SHA-256 hashed IP (privacy)

  // Event-specific (varies by event type):
  [key: string]: any;
}

// ─── Express Middleware (auto-tracks page_view) ──────────────────────────────

/**
 * Express middleware that auto-tracks page_view on every request.
 * Also attaches `req.trackEvent()` helper for manual event emission.
 *
 * Usage:
 *   app.use(analyticsMiddleware('smartbuy'));
 *
 *   // Then in route handlers:
 *   req.trackEvent(EVENTS.CLICK_AFFILIATE, { product_id: 'abc', platform: 'shopee' });
 */
export function analyticsMiddleware(product: string) {
  return (req: any, res: any, next: any) => {
    const userId = req.user?.id || req.user?._id?.toString() || undefined;
    const platform = detectPlatform(req);
    const sessionId = req.headers['x-session-id'] as string || undefined;

    // Attach helper to req for manual event tracking in route handlers
    req.trackEvent = async (event: StandardEvent, properties?: Record<string, any>) => {
      try {
        await trackEvent(product, event, userId, {
          ...properties,
          product,
          platform,
          session_id: sessionId,
        }, { platform, sessionId, ip: req.ip });
      } catch (err: any) {
        // Fire-and-forget — never fail the request
        console.debug(`[Analytics] Failed to track ${event}:`, err.message);
      }
    };

    // Auto-track page_view (skip health/internal endpoints)
    const path = req.path || req.url || '';
    if (!shouldSkip(path)) {
      // Defer tracking to avoid blocking response
      setImmediate(async () => {
        try {
          await trackEvent(product, EVENTS.PAGE_VIEW, userId, {
            path,
            method: req.method,
            product,
            platform,
            referrer: req.headers.referer || '',
            session_id: sessionId,
          }, { platform, sessionId, ip: req.ip });
        } catch {
          // Silently ignore
        }
      });
    }

    next();
  };
}

// ─── Helper: Track Standard Event ────────────────────────────────────────────

/**
 * Track a standard event from anywhere (not just inside Express handlers).
 * Use for background jobs, workers, schedulers.
 */
export async function trackStandardEvent(
  product: string,
  event: StandardEvent,
  userId?: string,
  properties?: Record<string, any>,
): Promise<void> {
  try {
    await trackEvent(product, event, userId, {
      ...properties,
      product,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.debug(`[Analytics] Failed to track ${event}:`, err.message);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function detectPlatform(req: any): 'web' | 'mobile' | 'zalo' | 'api' {
  const ua = (req.headers['user-agent'] || '').toLowerCase();
  const source = req.headers['x-source'] || req.query?.source || '';

  if (source === 'zalo' || ua.includes('zalo')) return 'zalo';
  if (source === 'mobile' || ua.includes('dart') || ua.includes('flutter')) return 'mobile';
  if (ua.includes('postman') || ua.includes('insomnia') || !ua.includes('mozilla')) return 'api';
  return 'web';
}

function shouldSkip(path: string): boolean {
  const skipPatterns = [
    '/health', '/metrics', '/favicon', '/robots.txt',
    '/ads.txt', '/sitemap', '/api-docs', '/swagger',
    '/internal/', '/_next/',
  ];
  return skipPatterns.some(p => path.startsWith(p) || path.includes(p));
}
