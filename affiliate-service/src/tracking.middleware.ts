/**
 * Affiliate Tracking Middleware
 * Express middleware for tracking affiliate clicks and conversions
 */

import { Request, Response, NextFunction } from 'express';
import { AffiliateService } from './affiliate.service';
import { AffiliatePlatform, AffiliateClick } from './types';

/**
 * Extended request with affiliate tracking data
 */
export interface AffiliateRequest extends Request {
  affiliateClick?: AffiliateClick;
  affiliateLinkId?: string;
  affiliatePlatform?: AffiliatePlatform;
}

/**
 * Middleware to track affiliate link clicks
 * Used on redirect endpoints
 */
export function affiliateClickTracker(affiliateService: AffiliateService) {
  return async (req: AffiliateRequest, res: Response, next: NextFunction) => {
    try {
      const linkId = req.params.linkId || req.query.linkId as string;
      
      if (!linkId) {
        return next();
      }

      // Extract tracking data from request
      const trackingData = {
        sessionId: req.cookies?.sessionId || req.headers['x-session-id'] as string,
        userId: (req as any).user?.id,
        ipAddress: getClientIp(req),
        userAgent: req.headers['user-agent'],
        referrer: req.headers['referer'] || req.headers['referrer'],
        metadata: {
          path: req.path,
          query: req.query
        }
      };

      // Track the click
      const click = affiliateService.trackClick(linkId, trackingData);
      
      // Attach to request for downstream use
      req.affiliateClick = click;
      req.affiliateLinkId = linkId;

      next();
    } catch (error) {
      console.error('Affiliate click tracking error:', error);
      next(); // Don't block the request on tracking errors
    }
  };
}

/**
 * Middleware to handle affiliate redirects
 * Redirects user to the affiliate URL after tracking
 */
export function affiliateRedirect(
  affiliateService: AffiliateService,
  linkStore: Map<string, { affiliateUrl: string; platform: AffiliatePlatform }>
) {
  return async (req: AffiliateRequest, res: Response) => {
    try {
      const linkId = req.params.linkId;
      const linkData = linkStore.get(linkId);

      if (!linkData) {
        return res.status(404).json({
          error: 'Affiliate link not found',
          message: 'Liên kết không tồn tại hoặc đã hết hạn'
        });
      }

      // Track click if not already tracked by middleware
      if (!req.affiliateClick) {
        affiliateService.trackClick(linkId, {
          sessionId: req.cookies?.sessionId,
          userId: (req as any).user?.id,
          ipAddress: getClientIp(req),
          userAgent: req.headers['user-agent']
        });
      }

      // Redirect to affiliate URL
      res.redirect(302, linkData.affiliateUrl);
    } catch (error) {
      console.error('Affiliate redirect error:', error);
      res.status(500).json({
        error: 'Redirect failed',
        message: 'Không thể chuyển hướng. Vui lòng thử lại.'
      });
    }
  };
}

/**
 * Middleware to verify conversion webhooks from platforms
 */
export function conversionWebhookHandler(affiliateService: AffiliateService) {
  return async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as AffiliatePlatform;
      const webhookData = req.body;

      // Validate webhook signature (platform-specific)
      const isValid = validateWebhookSignature(platform, req);
      if (!isValid) {
        return res.status(401).json({ error: 'Invalid signature' });
      }

      // Parse conversion data based on platform
      const conversionData = parseConversionWebhook(platform, webhookData);
      
      if (conversionData) {
        affiliateService.recordConversion({
          clickId: conversionData.clickId,
          linkId: conversionData.linkId,
          platform,
          orderId: conversionData.orderId,
          orderAmount: conversionData.orderAmount,
          commission: conversionData.commission
        });
      }

      res.status(200).json({ received: true });
    } catch (error) {
      console.error('Conversion webhook error:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  };
}

/**
 * Get client IP address from request
 */
function getClientIp(req: Request): string | undefined {
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = Array.isArray(forwardedFor) 
      ? forwardedFor[0] 
      : forwardedFor.split(',')[0];
    return ips.trim();
  }
  return req.socket?.remoteAddress;
}

/**
 * Validate webhook signature (platform-specific)
 */
function validateWebhookSignature(platform: AffiliatePlatform, req: Request): boolean {
  // Each platform has different signature validation
  // This would be implemented based on platform documentation
  switch (platform) {
    case AffiliatePlatform.SHOPEE:
      // Validate Shopee webhook signature
      return true; // Placeholder
    case AffiliatePlatform.LAZADA:
      // Validate Lazada webhook signature
      return true; // Placeholder
    case AffiliatePlatform.TIKI:
      // Validate Tiki webhook signature
      return true; // Placeholder
    default:
      return false;
  }
}

/**
 * Parse conversion webhook data (platform-specific)
 */
function parseConversionWebhook(
  platform: AffiliatePlatform,
  data: Record<string, unknown>
): {
  clickId: string;
  linkId: string;
  orderId: string;
  orderAmount: number;
  commission: number;
} | null {
  // Parse based on platform webhook format
  switch (platform) {
    case AffiliatePlatform.SHOPEE:
      return {
        clickId: data.click_id as string || '',
        linkId: data.link_id as string || '',
        orderId: data.order_id as string || '',
        orderAmount: Number(data.order_amount) || 0,
        commission: Number(data.commission) || 0
      };
    case AffiliatePlatform.LAZADA:
      return {
        clickId: data.clickId as string || '',
        linkId: data.linkId as string || '',
        orderId: data.orderId as string || '',
        orderAmount: Number(data.amount) || 0,
        commission: Number(data.commission) || 0
      };
    case AffiliatePlatform.TIKI:
      return {
        clickId: data.click_id as string || '',
        linkId: data.link_id as string || '',
        orderId: data.order_id as string || '',
        orderAmount: Number(data.total) || 0,
        commission: Number(data.commission) || 0
      };
    default:
      return null;
  }
}

/**
 * Express router factory for affiliate endpoints
 */
export function createAffiliateRouter(
  affiliateService: AffiliateService,
  linkStore: Map<string, { affiliateUrl: string; platform: AffiliatePlatform }>
) {
  // Note: This returns configuration for routes, not an actual router
  // The actual router should be created in the consuming application
  return {
    routes: [
      {
        method: 'GET',
        path: '/go/:linkId',
        handlers: [
          affiliateClickTracker(affiliateService),
          affiliateRedirect(affiliateService, linkStore)
        ]
      },
      {
        method: 'POST',
        path: '/webhook/:platform',
        handlers: [conversionWebhookHandler(affiliateService)]
      }
    ]
  };
}
