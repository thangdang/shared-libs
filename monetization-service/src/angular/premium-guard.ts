/**
 * Premium Guard - Route guard for premium-only content
 * Redirects free users to upgrade page
 */

import { inject } from '@angular/core';
import { Router, CanActivateFn, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { MonetizationService } from './monetization.service';

/**
 * Guard that allows access only to premium subscribers
 * Usage in routes:
 * {
 *   path: 'premium-feature',
 *   component: PremiumFeatureComponent,
 *   canActivate: [premiumGuard]
 * }
 */
export const premiumGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const monetization = inject(MonetizationService);
  const router = inject(Router);

  if (monetization.isPremium()) {
    return true;
  }

  // Get redirect URL from route data or use default
  const upgradeUrl = route.data['upgradeUrl'] || '/pricing';
  const returnUrl = state.url;

  // Redirect to upgrade page with return URL
  router.navigate([upgradeUrl], {
    queryParams: { returnUrl }
  });

  return false;
};

/**
 * Guard that allows access to free tier (for showing upgrade prompts)
 * Usage:
 * {
 *   path: 'basic-feature',
 *   component: BasicFeatureComponent,
 *   canActivate: [freeOrPremiumGuard]
 * }
 */
export const freeOrPremiumGuard: CanActivateFn = () => {
  // Always allow - both free and premium can access
  return true;
};

/**
 * Guard that checks for active subscription (any tier)
 * Useful for features that require login but not premium
 */
export const hasSubscriptionGuard: CanActivateFn = (
  route: ActivatedRouteSnapshot,
  state: RouterStateSnapshot
) => {
  const monetization = inject(MonetizationService);
  const router = inject(Router);
  const subscription = monetization.subscription();

  if (subscription && subscription.status === 'active') {
    return true;
  }

  // Redirect to login or subscription page
  const loginUrl = route.data['loginUrl'] || '/auth/login';
  router.navigate([loginUrl], {
    queryParams: { returnUrl: state.url }
  });

  return false;
};
