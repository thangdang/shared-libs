/**
 * User Routes — Profile management, subscription status
 */
import { Router, Request, Response } from 'express';
import { User } from '../models/User';

const router = Router();

/**
 * GET /api/auth/users/:id — Get user by ID (internal, called by product services)
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('-password_hash').lean();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});

/**
 * PATCH /api/auth/users/:id — Update user profile
 */
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { name, phone, avatar_url } = req.body;
    const update: Record<string, any> = {};
    if (name) update.name = name;
    if (phone) update.phone = phone;
    if (avatar_url) update.avatar_url = avatar_url;

    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true }).select('-password_hash').lean();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

/**
 * POST /api/auth/users/:id/activate-premium — Called by payment-service after successful payment
 */
router.post('/:id/activate-premium', async (req: Request, res: Response) => {
  try {
    const { plan, durationDays } = req.body;
    const expiresAt = new Date(Date.now() + (durationDays || 30) * 24 * 60 * 60 * 1000);

    // Bundle plans activate premium across all products
    const isBundle = plan?.startsWith('bundle_');
    const updateData: Record<string, any> = {
      premium_until: expiresAt,
      subscription_plan: plan,
      subscription_activated_at: new Date(),
    };
    if (isBundle) {
      updateData.bundle_active = true;
      updateData.bundle_products = ['trendbriefai', 'smartbuy', 'fintax', 'caremate'];
    }

    const user = await User.findByIdAndUpdate(req.params.id, updateData, { new: true }).select('-password_hash').lean();

    if (!user) { res.status(404).json({ error: 'User not found' }); return; }
    res.json({ success: true, premium_until: expiresAt, is_bundle: isBundle });
  } catch (error) {
    res.status(500).json({ error: 'Failed to activate premium' });
  }
});

/**
 * GET /api/auth/users/:id/subscription — Check subscription status
 */
router.get('/:id/subscription', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id).select('premium_until subscription_plan').lean();
    if (!user) { res.status(404).json({ error: 'User not found' }); return; }

    const isPremium = !!user.premium_until && new Date(user.premium_until) > new Date();
    res.json({
      isPremium,
      plan: user.subscription_plan || 'free',
      expires_at: user.premium_until,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check subscription' });
  }
});

export { router as userRoutes };
