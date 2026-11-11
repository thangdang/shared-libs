/**
 * Angular Feature Flag Route Guard - Nov 2026 Release
 * 
 * Route guards to prevent navigation to disabled features.
 * 
 * Usage (standalone):
 * ```typescript
 * export const routes: Routes = [
 *   {
 *     path: 'ai-chat',
 *     component: AIChatComponent,
 *     canActivate: [featureFlagGuard('AI_CHAT')],
 *   },
 *   {
 *     path: 'summarize',
 *     loadComponent: () => import('./summarize.component'),
 *     canActivate: [featureFlagGuard('SUMMARIZE_URL', '/news')],
 *   },
 * ];
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { inject, Injectable } from '@angular/core';
import {
  CanActivate,
  CanActivateChild,
  CanMatch,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  Router,
  UrlTree,
  Route,
  UrlSegment,
} from '@angular/router';
import { FeatureFlagService } from './feature-flag.service';

// ═══════════════════════════════════════════════════════════════
//  FUNCTIONAL GUARD (Angular 15+)
// ═══════════════════════════════════════════════════════════════

/**
 * Functional route guard for feature flags
 * 
 * @param feature Feature flag name to check
 * @param redirectTo Path to redirect if disabled (default: '/')
 */
export function featureFlagGuard(feature: string, redirectTo = '/') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isEnabled(feature)) {
      return true;
    }

    // Feature is disabled - redirect
    console.warn(`[FeatureFlag] Access denied to disabled feature: ${feature}`);
    return router.parseUrl(redirectTo);
  };
}

/**
 * Functional guard that requires AI to be enabled globally
 */
export function requireAIGuard(redirectTo = '/') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isAIEnabled()) {
      return true;
    }

    console.warn('[FeatureFlag] Access denied - AI is globally disabled');
    return router.parseUrl(redirectTo);
  };
}

// ═══════════════════════════════════════════════════════════════
//  CLASS-BASED GUARD (for advanced use cases)
// ═══════════════════════════════════════════════════════════════

@Injectable({
  providedIn: 'root',
})
export class FeatureFlagGuard implements CanActivate, CanActivateChild, CanMatch {
  private readonly featureFlags = inject(FeatureFlagService);
  private readonly router = inject(Router);

  /**
   * Check if route can be activated
   * 
   * Route must have data.feature defined:
   * ```typescript
   * {
   *   path: 'ai-chat',
   *   component: AIChatComponent,
   *   canActivate: [FeatureFlagGuard],
   *   data: { feature: 'AI_CHAT', redirectTo: '/faq' }
   * }
   * ```
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.checkFeature(route);
  }

  canActivateChild(
    childRoute: ActivatedRouteSnapshot,
    _state: RouterStateSnapshot
  ): boolean | UrlTree {
    return this.checkFeature(childRoute);
  }

  canMatch(route: Route, _segments: UrlSegment[]): boolean | UrlTree {
    const feature = route.data?.['feature'];
    const redirectTo = route.data?.['redirectTo'] || '/';

    if (!feature) {
      console.warn('[FeatureFlagGuard] No feature specified in route data');
      return true;
    }

    if (this.featureFlags.isEnabled(feature)) {
      return true;
    }

    console.warn(`[FeatureFlagGuard] Feature "${feature}" is disabled`);
    return this.router.parseUrl(redirectTo);
  }

  private checkFeature(route: ActivatedRouteSnapshot): boolean | UrlTree {
    const feature = route.data['feature'];
    const redirectTo = route.data['redirectTo'] || '/';

    if (!feature) {
      console.warn('[FeatureFlagGuard] No feature specified in route data');
      return true;
    }

    if (this.featureFlags.isEnabled(feature)) {
      return true;
    }

    console.warn(`[FeatureFlagGuard] Feature "${feature}" is disabled, redirecting to ${redirectTo}`);
    return this.router.parseUrl(redirectTo);
  }
}

// ═══════════════════════════════════════════════════════════════
//  SPECIALIZED GUARDS PER APP
// ═══════════════════════════════════════════════════════════════

/**
 * Guard factory for TrendBrief routes
 */
export function trendbriefGuard(feature: string, redirectTo = '/news') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.trendbrief[`can${capitalizeFirst(feature)}` as keyof typeof featureFlags.trendbrief]?.()) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}

/**
 * Guard factory for SmartBuy routes
 */
export function smartbuyGuard(feature: string, redirectTo = '/search') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isFeatureEnabled('smartbuy', feature)) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}

/**
 * Guard factory for FinTax routes
 */
export function fintaxGuard(feature: string, redirectTo = '/calculator') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isFeatureEnabled('fintax', feature)) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}

/**
 * Guard factory for DoctorCar routes
 */
export function doctorcarGuard(feature: string, redirectTo = '/dtc') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isFeatureEnabled('doctorcar', feature)) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}

/**
 * Guard factory for CareMate routes
 */
export function caremateGuard(feature: string, redirectTo = '/drugs') {
  return (): boolean | UrlTree => {
    const featureFlags = inject(FeatureFlagService);
    const router = inject(Router);

    if (featureFlags.isFeatureEnabled('caremate', feature)) {
      return true;
    }

    return router.parseUrl(redirectTo);
  };
}

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}
