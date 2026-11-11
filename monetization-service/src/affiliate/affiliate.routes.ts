/**
 * Affiliate API Routes
 * 
 * Tasks: MON-020, MON-021
 */

import { Router, Request, Response } from 'express';
import { affiliateService } from './affiliate.service';
import { AffiliateClick, AffiliateCampaign } from './affiliate.model';

const router = Router();

/**
 * POST /affiliate/track
 * Track affiliate click and generate affiliate URL
 */
router.post('/track', async (req: Request, res: Response) => {
  try {
    const { productUrl, productId, productName, campaignId } = req.body;
    const userId = (req as any).userId;
    const sessionId = req.headers['x-session-id'] as string || 
                      req.cookies?.sessionId || 
                      `anon_${Date.now()}`;
    const appId = req.headers['x-app-id'] as string || 'smartbuy';

    if (!productUrl || !productId || !productName) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin sản phẩm'
      });
    }

    const { affiliateUrl, trackingId } = await affiliateService.createTrackedLink({
      productUrl,
      productId,
      productName,
      userId,
      sessionId,
      appId,
      source: req.headers['x-source'] as string || 'web',
      campaignId
    });

    res.json({
      success: true,
      data: {
        affiliateUrl,
        trackingId
      }
    });
  } catch (error) {
    console.error('Error tracking affiliate click:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo link affiliate'
    });
  }
});

/**
 * GET /affiliate/redirect
 * Redirect to affiliate URL with tracking
 */
router.get('/redirect', async (req: Request, res: Response) => {
  try {
    const { url, pid, pname } = req.query;
    const userId = (req as any).userId;
    const sessionId = req.headers['x-session-id'] as string || 
                      req.cookies?.sessionId || 
                      `anon_${Date.now()}`;
    const appId = req.headers['x-app-id'] as string || 'smartbuy';

    if (!url || typeof url !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'URL không hợp lệ'
      });
    }

    const { affiliateUrl } = await affiliateService.createTrackedLink({
      productUrl: url,
      productId: pid as string || 'unknown',
      productName: pname as string || 'Unknown Product',
      userId,
      sessionId,
      appId,
      source: 'redirect'
    });

    res.redirect(affiliateUrl);
  } catch (error) {
    console.error('Error redirecting:', error);
    // Fallback to original URL
    const url = req.query.url as string;
    if (url) {
      res.redirect(url);
    } else {
      res.status(500).json({
        success: false,
        error: 'Không thể chuyển hướng'
      });
    }
  }
});

/**
 * POST /affiliate/conversion
 * Track conversion (called by webhook from affiliate networks)
 */
router.post('/conversion', async (req: Request, res: Response) => {
  try {
    const { sessionId, orderId, orderValue, platform, signature } = req.body;

    // TODO: Verify webhook signature based on platform
    // This is critical for production to prevent fake conversions

    if (!sessionId || !orderId || !orderValue || !platform) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    const success = await affiliateService.trackConversion({
      sessionId,
      orderId,
      orderValue: Number(orderValue),
      platform
    });

    res.json({
      success,
      message: success ? 'Conversion tracked' : 'No matching click found'
    });
  } catch (error) {
    console.error('Error tracking conversion:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to track conversion'
    });
  }
});

/**
 * GET /affiliate/stats
 * Get affiliate statistics (admin only)
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check
    
    const { appId, startDate, endDate } = req.query;

    const stats = await affiliateService.getStats({
      appId: appId as string || 'smartbuy',
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined
    });

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tải thống kê'
    });
  }
});

/**
 * GET /affiliate/dashboard
 * Get dashboard data for affiliate admin
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check

    const appId = req.query.appId as string || 'smartbuy';

    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [todayStats, campaigns, recentClicks] = await Promise.all([
      affiliateService.getStats({
        appId,
        startDate: today
      }),

      AffiliateCampaign.find({ isActive: true })
        .select('name platform stats')
        .lean(),

      AffiliateClick.find({ appId })
        .sort({ clickedAt: -1 })
        .limit(20)
        .select('productName platform clickedAt converted conversionValue')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        today: todayStats,
        campaigns,
        recentClicks
      }
    });
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tải dashboard'
    });
  }
});

/**
 * GET /affiliate/campaigns
 * Get all affiliate campaigns
 */
router.get('/campaigns', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;

    const query: any = {};
    if (active === 'true') {
      query.isActive = true;
    }

    const campaigns = await AffiliateCampaign.find(query)
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tải danh sách chiến dịch'
    });
  }
});

/**
 * POST /affiliate/campaigns
 * Create new affiliate campaign
 */
router.post('/campaigns', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check

    const {
      name,
      description,
      platform,
      affiliateId,
      apiKey,
      secretKey,
      commissionRate,
      commissionType,
      startDate
    } = req.body;

    if (!name || !platform || !affiliateId || commissionRate === undefined) {
      return res.status(400).json({
        success: false,
        error: 'Thiếu thông tin bắt buộc'
      });
    }

    const campaign = await AffiliateCampaign.create({
      name,
      description,
      platform,
      affiliateId,
      apiKey,
      secretKey,
      commissionRate,
      commissionType: commissionType || 'percentage',
      startDate: startDate ? new Date(startDate) : new Date(),
      isActive: true
    });

    res.status(201).json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể tạo chiến dịch'
    });
  }
});

/**
 * PATCH /affiliate/campaigns/:id
 * Update affiliate campaign
 */
router.patch('/campaigns/:id', async (req: Request, res: Response) => {
  try {
    // TODO: Add admin authentication check

    const { id } = req.params;
    const updates = req.body;

    const campaign = await AffiliateCampaign.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true }
    );

    if (!campaign) {
      return res.status(404).json({
        success: false,
        error: 'Không tìm thấy chiến dịch'
      });
    }

    res.json({
      success: true,
      data: campaign
    });
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({
      success: false,
      error: 'Không thể cập nhật chiến dịch'
    });
  }
});

export default router;
