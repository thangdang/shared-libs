/**
 * Affiliate Routes - Shared route handlers for all apps
 * 
 * Each app imports and mounts these routes with its own AffiliateService instance.
 */

import { Router, Request, Response, NextFunction } from 'express';
import { AffiliateService } from './service';
import { parsePostback } from './link-generator';
import { Platform, AppName } from './types';

export interface AffiliateRouterOptions {
  service: AffiliateService;
  appName: AppName;
  baseRedirectUrl?: string; // For building redirect URLs
}

/**
 * Create affiliate routes for an app
 * 
 * Routes:
 * - GET  /affiliate/redirect/:linkId - Track click and redirect
 * - POST /affiliate/postback/:platform - Handle conversion postback
 * - GET  /affiliate/stats - Get affiliate statistics (protected)
 */
export function createAffiliateRoutes(options: AffiliateRouterOptions): Router {
  const router = Router();
  const { service, appName } = options;

  /**
   * GET /affiliate/redirect/:linkId
   * 
   * Track click and redirect to affiliate URL
   * 
   * Query params:
   * - page: Source page (optional)
   */
  router.get('/redirect/:linkId', async (req: Request, res: Response) => {
    try {
      const { linkId } = req.params;
      const sourcePage = (req.query.page as string) || req.headers.referer || '/';
      const ip = req.ip || req.socket.remoteAddress || 'unknown';
      const userAgent = req.headers['user-agent'];
      const referer = req.headers.referer;

      const result = await service.trackClick(
        linkId,
        sourcePage,
        ip,
        userAgent,
        referer
      );

      if (!result.success || !result.redirectUrl) {
        return res.status(404).json({ error: 'Link not found' });
      }

      // 302 redirect to affiliate URL
      return res.redirect(302, result.redirectUrl);
    } catch (error) {
      console.error(`[${appName}] Affiliate redirect error:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * POST /affiliate/postback/:platform
   * 
   * Handle conversion postback from affiliate networks
   * 
   * Each platform sends different parameters:
   * - Shopee: sub_id, order_id, commission
   * - Lazada: sub_aff_id, order_id, payout
   * - Tiki: sub, order_id, commission
   */
  router.post('/postback/:platform', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform;
      const params = { ...req.query, ...req.body } as Record<string, string>;

      // Parse postback data based on platform
      const postbackData = parsePostback(platform, params);

      if (!postbackData.trackingId) {
        console.warn(`[${appName}] Postback missing tracking ID:`, params);
        return res.status(400).json({ error: 'Missing tracking ID' });
      }

      // Record conversion
      const success = await service.handlePostback(
        postbackData.trackingId,
        postbackData.orderId || '',
        postbackData.commission || 0
      );

      if (success) {
        console.log(`[${appName}] Conversion recorded:`, {
          platform,
          trackingId: postbackData.trackingId,
          orderId: postbackData.orderId,
          commission: postbackData.commission
        });
        return res.status(200).json({ status: 'OK' });
      } else {
        console.warn(`[${appName}] Conversion not found:`, postbackData.trackingId);
        return res.status(404).json({ error: 'Click not found' });
      }
    } catch (error) {
      console.error(`[${appName}] Postback error:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /affiliate/postback/:platform (GET version for platforms that use GET)
   */
  router.get('/postback/:platform', async (req: Request, res: Response) => {
    try {
      const platform = req.params.platform as Platform;
      const params = req.query as Record<string, string>;

      const postbackData = parsePostback(platform, params);

      if (!postbackData.trackingId) {
        return res.status(400).json({ error: 'Missing tracking ID' });
      }

      const success = await service.handlePostback(
        postbackData.trackingId,
        postbackData.orderId || '',
        postbackData.commission || 0
      );

      return res.status(success ? 200 : 404).json({ 
        status: success ? 'OK' : 'Not found' 
      });
    } catch (error) {
      console.error(`[${appName}] Postback GET error:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  /**
   * GET /affiliate/stats
   * 
   * Get affiliate statistics for this app
   * 
   * Query params:
   * - start: Start date (ISO string)
   * - end: End date (ISO string)
   */
  router.get('/stats', async (req: Request, res: Response) => {
    try {
      const startDate = req.query.start 
        ? new Date(req.query.start as string)
        : new Date(new Date().setDate(new Date().getDate() - 30)); // Last 30 days
      
      const endDate = req.query.end
        ? new Date(req.query.end as string)
        : new Date();

      const stats = await service.getStats(startDate, endDate);

      return res.json({
        app: appName,
        period: { start: startDate, end: endDate },
        stats
      });
    } catch (error) {
      console.error(`[${appName}] Stats error:`, error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
}

/**
 * Middleware to inject affiliate link into product response
 */
export function affiliateLinkMiddleware(service: AffiliateService) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    // Override json method to inject affiliate links
    res.json = function(body: any) {
      // If response has products, add affiliate links
      if (body && Array.isArray(body.products)) {
        // Process asynchronously (fire and forget for performance)
        // In production, you might want to await this
        Promise.all(
          body.products.map(async (product: any) => {
            if (product.url && product.price) {
              try {
                const match = await service.matchAndGenerateLink({
                  content: product.name,
                  productName: product.name,
                  productUrl: product.url,
                  price: product.price,
                  sourceApp: service['appName'] as AppName
                });
                if (match) {
                  product.affiliateUrl = match.affiliateUrl;
                  product.affiliatePlatform = match.platform;
                }
              } catch (e) {
                // Ignore errors, just don't add affiliate link
              }
            }
          })
        ).then(() => {
          originalJson(body);
        });
        return res;
      }

      return originalJson(body);
    };

    next();
  };
}
