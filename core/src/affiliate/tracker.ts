/**
 * Affiliate Tracker - Click and conversion tracking
 */

import { createHash } from 'crypto';
import { AffiliateClick, AffiliateLink, AppName, Platform } from './types';

/**
 * Hash IP address for privacy
 */
export function hashUserIdentifier(ip: string, userAgent?: string): string {
  const data = `${ip}:${userAgent || ''}`;
  return createHash('sha256').update(data).digest('hex').substring(0, 32);
}

/**
 * Create click record
 */
export function createClickRecord(
  linkId: string,
  trackingId: string,
  sourceApp: AppName,
  sourcePage: string,
  ip: string,
  userAgent?: string,
  referer?: string
): Omit<AffiliateClick, '_id'> {
  return {
    linkId,
    userHash: hashUserIdentifier(ip, userAgent),
    userAgent,
    referer,
    sourceApp,
    sourcePage,
    trackingId,
    clickedAt: new Date(),
    converted: false,
    commissionEarned: 0
  };
}

/**
 * Calculate conversion rate
 */
export function calculateConversionRate(clicks: number, conversions: number): number {
  if (clicks === 0) return 0;
  return Math.round((conversions / clicks) * 10000) / 100; // 2 decimal places
}

/**
 * Aggregate stats from clicks
 */
export interface AggregatedStats {
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
  averageCommission: number;
}

export function aggregateClickStats(clicks: AffiliateClick[]): AggregatedStats {
  const totalClicks = clicks.length;
  const conversions = clicks.filter(c => c.converted);
  const totalConversions = conversions.length;
  const totalRevenue = conversions.reduce((sum, c) => sum + c.commissionEarned, 0);
  
  return {
    totalClicks,
    totalConversions,
    totalRevenue,
    conversionRate: calculateConversionRate(totalClicks, totalConversions),
    averageCommission: totalConversions > 0 ? totalRevenue / totalConversions : 0
  };
}

/**
 * Group stats by platform
 */
export function groupStatsByPlatform(
  links: AffiliateLink[],
  clicks: AffiliateClick[]
): Record<Platform, AggregatedStats> {
  const result: Record<string, AggregatedStats> = {};
  
  // Group clicks by link platform
  const clicksByLink = new Map<string, AffiliateClick[]>();
  for (const click of clicks) {
    const existing = clicksByLink.get(click.linkId) || [];
    existing.push(click);
    clicksByLink.set(click.linkId, existing);
  }
  
  // Group by platform
  const clicksByPlatform = new Map<Platform, AffiliateClick[]>();
  for (const link of links) {
    const linkClicks = clicksByLink.get(link._id || '') || [];
    const existing = clicksByPlatform.get(link.platform) || [];
    existing.push(...linkClicks);
    clicksByPlatform.set(link.platform, existing);
  }
  
  // Aggregate per platform
  for (const [platform, platformClicks] of clicksByPlatform) {
    result[platform] = aggregateClickStats(platformClicks);
  }
  
  return result as Record<Platform, AggregatedStats>;
}

/**
 * Group stats by app
 */
export function groupStatsByApp(clicks: AffiliateClick[]): Record<AppName, AggregatedStats> {
  const clicksByApp = new Map<AppName, AffiliateClick[]>();
  
  for (const click of clicks) {
    const existing = clicksByApp.get(click.sourceApp) || [];
    existing.push(click);
    clicksByApp.set(click.sourceApp, existing);
  }
  
  const result: Record<string, AggregatedStats> = {};
  for (const [app, appClicks] of clicksByApp) {
    result[app] = aggregateClickStats(appClicks);
  }
  
  return result as Record<AppName, AggregatedStats>;
}

/**
 * Check if click is duplicate (within time window)
 */
export function isDuplicateClick(
  existingClicks: AffiliateClick[],
  userHash: string,
  linkId: string,
  windowMinutes: number = 30
): boolean {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  
  return existingClicks.some(click => 
    click.userHash === userHash &&
    click.linkId === linkId &&
    (now - click.clickedAt.getTime()) < windowMs
  );
}
