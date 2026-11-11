/**
 * Subscription Middleware for All Apps
 * 
 * Tasks: MON-010, MON-025
 */

import { Request, Response, NextFunction } from 'express';
import { Subscription, SUBSCRIPTION_TIERS, SubscriptionTier } from './subscription.model';
import mongoose from 'mongoose';

export interface SubscriptionRequest extends Request {
  userId?: string;
  subscription?: {
    tier: SubscriptionTier;
    status: string;
    features: Record<string, any>;
    isActive: boolean;
  };
}

/**
 * Load subscription info into request
 */
export const loadSubscription = async (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    const appId = req.headers['x-app-id'] as string || req.query.appId as string;

    if (!userId) {
      // Default to free tier for unauthenticated users
      req.subscription = {
        tier: 'free',
        status: 'active',
        features: SUBSCRIPTION_TIERS.free.features,
        isActive: true
      };
      return next();
    }

    const subscription = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      appId
    });

    if (!subscription || subscription.status !== 'active' || subscription.endDate < new Date()) {
      // Default to free tier
      req.subscription = {
        tier: 'free',
        status: subscription?.status || 'none',
        features: SUBSCRIPTION_TIERS.free.features,
        isActive: false
      };
    } else {
      req.subscription = {
        tier: subscription.tier,
        status: subscription.status,
        features: subscription.features as any,
        isActive: true
      };
    }

    next();
  } catch (error) {
    console.error('Error loading subscription:', error);
    // Default to free tier on error
    req.subscription = {
      tier: 'free',
      status: 'error',
      features: SUBSCRIPTION_TIERS.free.features,
      isActive: false
    };
    next();
  }
};

/**
 * Require minimum subscription tier
 */
export const requireTier = (minTier: SubscriptionTier) => {
  const tierOrder: SubscriptionTier[] = ['free', 'basic', 'premium', 'enterprise'];

  return (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    const currentTier = req.subscription?.tier || 'free';
    const currentIndex = tierOrder.indexOf(currentTier);
    const requiredIndex = tierOrder.indexOf(minTier);

    if (currentIndex < requiredIndex) {
      return res.status(403).json({
        success: false,
        error: 'Tính năng này yêu cầu gói ' + SUBSCRIPTION_TIERS[minTier].name,
        requiredTier: minTier,
        currentTier,
        upgradeUrl: '/pricing'
      });
    }

    next();
  };
};

/**
 * Require specific feature
 */
export const requireFeature = (feature: string) => {
  return (req: SubscriptionRequest, res: Response, next: NextFunction) => {
    const tier = req.subscription?.tier || 'free';
    
    // Define feature access by tier
    const featureAccess: Record<string, SubscriptionTier[]> = {
      'ai_chat': ['premium', 'enterprise'],
      'ai_summary': ['premium', 'enterprise'],
      'ai_voice': ['enterprise'],
      'unlimited_api': ['enterprise'],
      'priority_support': ['premium', 'enterprise'],
      'no_ads': ['basic', 'premium', 'enterprise'],
      'extended_history': ['basic', 'premium', 'enterprise'],
      'custom_reports': ['enterprise'],
      'api_access': ['enterprise']
    };

    const allowedTiers = featureAccess[feature] || [];
    
    if (!allowedTiers.includes(tier)) {
      const minRequired = allowedTiers[0] || 'premium';
      return res.status(403).json({
        success: false,
        error: `Tính năng "${feature}" yêu cầu gói ${SUBSCRIPTION_TIERS[minRequired]?.name || 'cao cấp'}`,
        feature,
        requiredTier: minRequired,
        currentTier: tier,
        upgradeUrl: '/pricing'
      });
    }

    next();
  };
};

/**
 * Check and increment API usage
 */
export const checkApiUsage = async (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.userId;
    const appId = req.headers['x-app-id'] as string || req.query.appId as string;

    if (!userId) {
      return next(); // Anonymous users have separate rate limiting
    }

    const subscription = await Subscription.findOne({
      userId: new mongoose.Types.ObjectId(userId),
      appId
    });

    const maxApiCalls = subscription?.features?.maxApiCalls || 
                        SUBSCRIPTION_TIERS.free.features.maxApiCalls;
    const currentUsage = subscription?.usage?.apiCalls || 0;

    // -1 means unlimited
    if (maxApiCalls !== -1 && currentUsage >= maxApiCalls) {
      return res.status(429).json({
        success: false,
        error: 'Bạn đã đạt giới hạn API trong tháng này',
        usage: currentUsage,
        limit: maxApiCalls,
        resetDate: getNextMonthStart(),
        upgradeUrl: '/pricing'
      });
    }

    // Increment usage
    if (subscription) {
      await Subscription.updateOne(
        { _id: subscription._id },
        { 
          $inc: { 'usage.apiCalls': 1 },
          $set: { 'usage.lastActiveAt': new Date() }
        }
      );
    }

    next();
  } catch (error) {
    console.error('Error checking API usage:', error);
    next(); // Continue on error to not block service
  }
};

/**
 * Check if ads should be shown
 */
export const shouldShowAds = (req: SubscriptionRequest): boolean => {
  return req.subscription?.features?.adsEnabled !== false;
};

/**
 * Middleware to add ads flag to response
 */
export const addAdsFlag = (
  req: SubscriptionRequest,
  res: Response,
  next: NextFunction
) => {
  // Store original json method
  const originalJson = res.json.bind(res);

  // Override json method
  res.json = function (body: any) {
    if (body && typeof body === 'object') {
      body.showAds = shouldShowAds(req);
    }
    return originalJson(body);
  };

  next();
};

/**
 * Helper: Get start of next month
 */
function getNextMonthStart(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1);
}

/**
 * Combined middleware for protected routes
 */
export const protectedRoute = (options: {
  minTier?: SubscriptionTier;
  feature?: string;
  checkUsage?: boolean;
} = {}) => {
  const middlewares = [loadSubscription];

  if (options.minTier) {
    middlewares.push(requireTier(options.minTier));
  }

  if (options.feature) {
    middlewares.push(requireFeature(options.feature));
  }

  if (options.checkUsage) {
    middlewares.push(checkApiUsage);
  }

  return middlewares;
};

export default {
  loadSubscription,
  requireTier,
  requireFeature,
  checkApiUsage,
  shouldShowAds,
  addAdsFlag,
  protectedRoute
};
