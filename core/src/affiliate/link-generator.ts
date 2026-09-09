/**
 * Affiliate Link Generator - Generate tracking links for each platform
 */

import { createHash } from 'crypto';
import { Platform, AffiliateAccount } from './types';
import { PLATFORM_URLS } from './constants';

/**
 * Generate a unique tracking ID for a link
 */
export function generateTrackingId(originalUrl: string, timestamp?: number): string {
  const ts = timestamp || Date.now();
  const hash = createHash('md5')
    .update(`${originalUrl}:${ts}`)
    .digest('hex')
    .substring(0, 12);
  return hash;
}

/**
 * Generate affiliate link for a specific platform
 */
export function generateAffiliateLink(
  platform: Platform,
  originalUrl: string,
  affiliateId: string,
  trackingId?: string
): string {
  const config = PLATFORM_URLS[platform];
  if (!config) {
    return originalUrl;
  }
  
  const tid = trackingId || generateTrackingId(originalUrl);
  const encodedUrl = encodeURIComponent(originalUrl);
  
  return config.affiliateFormat
    .replace('{affiliateId}', affiliateId)
    .replace('{encodedUrl}', encodedUrl)
    .replace('{trackingId}', tid)
    .replace('{originalUrl}', originalUrl);
}

/**
 * Generate affiliate links for all available platforms
 */
export interface MultiPlatformLinks {
  platform: Platform;
  affiliateUrl: string;
  trackingId: string;
}

export function generateMultiPlatformLinks(
  originalUrls: Record<Platform, string>,
  accounts: AffiliateAccount[]
): MultiPlatformLinks[] {
  const results: MultiPlatformLinks[] = [];
  const baseTrackingId = generateTrackingId(Object.values(originalUrls)[0] || '');
  
  for (const account of accounts) {
    if (account.status !== 'active') continue;
    
    const platform = account.platform;
    const originalUrl = originalUrls[platform];
    
    if (!originalUrl) continue;
    
    const trackingId = `${baseTrackingId}_${platform}`;
    const affiliateUrl = generateAffiliateLink(
      platform,
      originalUrl,
      account.affiliateId,
      trackingId
    );
    
    results.push({
      platform,
      affiliateUrl,
      trackingId
    });
  }
  
  return results;
}

/**
 * Build redirect URL for tracking (used in your own tracking system)
 * 
 * Example: /affiliate/redirect/abc123?app=smartbuy
 */
export function buildRedirectUrl(
  baseUrl: string,
  linkId: string,
  sourceApp: string
): string {
  return `${baseUrl}/affiliate/redirect/${linkId}?app=${sourceApp}`;
}

/**
 * Parse postback URL parameters from affiliate networks
 */
export interface PostbackData {
  trackingId: string;
  orderId?: string;
  commission?: number;
  platform: Platform;
  raw: Record<string, string>;
}

export function parsePostback(
  platform: Platform,
  params: Record<string, string>
): PostbackData {
  // Each platform has different parameter names
  const mappings: Record<Platform, { trackingId: string; orderId: string; commission: string }> = {
    shopee: { trackingId: 'sub_id', orderId: 'order_id', commission: 'commission' },
    lazada: { trackingId: 'sub_aff_id', orderId: 'order_id', commission: 'payout' },
    tiki: { trackingId: 'sub', orderId: 'order_id', commission: 'commission' },
    tiktok: { trackingId: 'click_id', orderId: 'order_id', commission: 'commission' },
    longchau: { trackingId: 'tracking', orderId: 'order_id', commission: 'commission' },
    pharmacity: { trackingId: 'sub', orderId: 'order_id', commission: 'commission' },
    ankhang: { trackingId: 'track', orderId: 'order_id', commission: 'commission' }
  };
  
  const map = mappings[platform];
  
  return {
    trackingId: params[map.trackingId] || '',
    orderId: params[map.orderId],
    commission: params[map.commission] ? parseFloat(params[map.commission]) : undefined,
    platform,
    raw: params
  };
}
