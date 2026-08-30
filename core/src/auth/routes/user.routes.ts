/**
 * User Routes Factory — Profile management, subscription status
 */
import { Router, Request, Response } from 'express';
import type { Model } from 'mongoose';
import type { IUser } from '../types.js';

export interface UserRoutesConfig {
  /** User model from the app */
  userModel: Model<IUser>;
}

/**
 * Create user routes with the provided configuration.
 */
export function createUserRoutes(config: UserRoutesConfig): Router {
  const router = Router();
  const { userModel } = config;

  /**
   * GET /:id — Get user by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const user = await userModel
        .findById(req.params.id)
        .select('-password_hash')
        .lean();

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  /**
   * PATCH /:id — Update user profile
   */
  router.patch('/:id', async (req: Request, res: Response) => {
    try {
      const { name, phone, avatar_url } = req.body;
      const update: Record<string, any> = {};
      if (name) update.name = name;
      if (phone) update.phone = phone;
      if (avatar_url) update.avatar_url = avatar_url;

      const user = await userModel
        .findByIdAndUpdate(req.params.id, update, { new: true })
        .select('-password_hash')
        .lean();

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ user });
    } catch (error) {
      res.status(500).json({ error: 'Failed to update user' });
    }
  });

  /**
   * POST /:id/activate-premium — Called after successful payment
   */
  router.post('/:id/activate-premium', async (req: Request, res: Response) => {
    try {
      const { plan, durationDays } = req.body;
      const expiresAt = new Date(
        Date.now() + (durationDays || 30) * 24 * 60 * 60 * 1000
      );

      const isBundle = plan?.startsWith('bundle_');
      const updateData: Record<string, any> = {
        premium_until: expiresAt,
        subscription_plan: plan,
        subscription_activated_at: new Date(),
      };

      if (isBundle) {
        updateData.bundle_active = true;
        updateData.bundle_products = [
          'trendbriefai',
          'smartbuy',
          'fintax',
          'caremate',
        ];
      }

      const user = await userModel
        .findByIdAndUpdate(req.params.id, updateData, { new: true })
        .select('-password_hash')
        .lean();

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      res.json({ success: true, premium_until: expiresAt, is_bundle: isBundle });
    } catch (error) {
      res.status(500).json({ error: 'Failed to activate premium' });
    }
  });

  /**
   * GET /:id/subscription — Check subscription status
   */
  router.get('/:id/subscription', async (req: Request, res: Response) => {
    try {
      const user = await userModel
        .findById(req.params.id)
        .select('premium_until subscription_plan')
        .lean();

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      const isPremium =
        !!user.premium_until && new Date(user.premium_until) > new Date();

      res.json({
        isPremium,
        plan: user.subscription_plan || 'free',
        expires_at: user.premium_until,
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to check subscription' });
    }
  });

  return router;
}
