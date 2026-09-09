/**
 * Affiliate Matcher - Detect category from content and find best platform
 */

import { Category, Platform, AppName } from './types';
import { CATEGORY_PATTERNS, PLATFORM_COMMISSION, APP_PLATFORM_PRIORITY } from './constants';

/**
 * Detect product category from text content
 */
export function detectCategory(text: string): Category {
  if (!text) return 'default';
  
  const textLower = text.toLowerCase();
  
  for (const [pattern, config] of Object.entries(CATEGORY_PATTERNS)) {
    const regex = new RegExp(pattern, 'i');
    if (regex.test(textLower)) {
      return config.category;
    }
  }
  
  return 'default';
}

/**
 * Get best platform for a category based on commission rate
 * Considers app-specific preferences
 */
export function getBestPlatform(
  category: Category,
  sourceApp: AppName,
  availablePlatforms: Platform[]
): Platform {
  // Get app-specific platform priority
  const appPriority = APP_PLATFORM_PRIORITY[sourceApp] || ['shopee', 'lazada', 'tiki'];
  
  // Filter to only available platforms
  const candidates = appPriority.filter(p => availablePlatforms.includes(p));
  
  if (candidates.length === 0) {
    return availablePlatforms[0] || 'shopee';
  }
  
  // Find platform with highest commission for this category
  let bestPlatform = candidates[0];
  let bestCommission = 0;
  
  for (const platform of candidates) {
    const commission = PLATFORM_COMMISSION[platform]?.[category] 
      || PLATFORM_COMMISSION[platform]?.default 
      || 0;
    
    if (commission > bestCommission) {
      bestCommission = commission;
      bestPlatform = platform;
    }
  }
  
  return bestPlatform;
}

/**
 * Get commission rate for platform and category
 */
export function getCommissionRate(platform: Platform, category: Category): number {
  return PLATFORM_COMMISSION[platform]?.[category] 
    || PLATFORM_COMMISSION[platform]?.default 
    || 0;
}

/**
 * Calculate expected commission
 */
export function calculateExpectedCommission(price: number, platform: Platform, category: Category): number {
  const rate = getCommissionRate(platform, category);
  return Math.round(price * rate);
}

/**
 * Match content to category and suggest best platform
 */
export interface MatchResult {
  category: Category;
  bestPlatform: Platform;
  commissionRate: number;
  alternativePlatforms: Array<{ platform: Platform; commissionRate: number }>;
}

export function matchContent(
  content: string,
  sourceApp: AppName,
  availablePlatforms: Platform[]
): MatchResult {
  const category = detectCategory(content);
  const bestPlatform = getBestPlatform(category, sourceApp, availablePlatforms);
  const commissionRate = getCommissionRate(bestPlatform, category);
  
  // Get alternative platforms with their rates
  const alternativePlatforms = availablePlatforms
    .filter(p => p !== bestPlatform)
    .map(platform => ({
      platform,
      commissionRate: getCommissionRate(platform, category)
    }))
    .sort((a, b) => b.commissionRate - a.commissionRate);
  
  return {
    category,
    bestPlatform,
    commissionRate,
    alternativePlatforms
  };
}
