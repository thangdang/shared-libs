/**
 * AdSense Configuration - Nov 2026 Release
 * 
 * Google AdSense configuration for all apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { AdConfig, AdSlot, AppName } from '../types';

// ═══════════════════════════════════════════════════════════════
//  AD SLOT DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export const AD_SLOTS: Record<string, AdSlot> = {
  // Header banner (top of page)
  header_banner: {
    slotId: 'header-banner',
    format: 'horizontal',
    fullWidthResponsive: true,
  },
  
  // Sidebar rectangle
  sidebar_rectangle: {
    slotId: 'sidebar-rectangle',
    format: 'rectangle',
    style: { width: '300px', height: '250px' },
  },
  
  // In-article ad
  in_article: {
    slotId: 'in-article',
    format: 'in-article',
    fullWidthResponsive: true,
  },
  
  // In-feed ad (for list views)
  in_feed: {
    slotId: 'in-feed',
    format: 'in-feed',
    fullWidthResponsive: true,
  },
  
  // Footer banner
  footer_banner: {
    slotId: 'footer-banner',
    format: 'horizontal',
    fullWidthResponsive: true,
  },
  
  // Mobile anchor
  mobile_anchor: {
    slotId: 'mobile-anchor',
    format: 'auto',
    fullWidthResponsive: true,
  },
};

// ═══════════════════════════════════════════════════════════════
//  APP-SPECIFIC AD CONFIGS
// ═══════════════════════════════════════════════════════════════

export const AD_CONFIGS: Record<AppName, AdConfig> = {
  trendbrief: {
    clientId: 'ca-pub-TRENDBRIEF', // Replace with actual
    enabled: true,
    testMode: false,
    disableForPremium: true,
    slots: {
      header: AD_SLOTS.header_banner,
      article_middle: AD_SLOTS.in_article,
      news_feed: AD_SLOTS.in_feed,
      sidebar: AD_SLOTS.sidebar_rectangle,
    },
  },
  
  smartbuy: {
    clientId: 'ca-pub-SMARTBUY', // Replace with actual
    enabled: true,
    testMode: false,
    disableForPremium: true,
    slots: {
      header: AD_SLOTS.header_banner,
      product_list: AD_SLOTS.in_feed,
      product_detail: AD_SLOTS.in_article,
      sidebar: AD_SLOTS.sidebar_rectangle,
    },
  },
  
  fintax: {
    clientId: 'ca-pub-FINTAX', // Replace with actual
    enabled: true,
    testMode: false,
    disableForPremium: true,
    slots: {
      header: AD_SLOTS.header_banner,
      calculator_footer: AD_SLOTS.footer_banner,
      sidebar: AD_SLOTS.sidebar_rectangle,
    },
  },
  
  doctorcar: {
    clientId: 'ca-pub-DOCTORCAR', // Replace with actual
    enabled: true,
    testMode: false,
    disableForPremium: true,
    slots: {
      header: AD_SLOTS.header_banner,
      dtc_result: AD_SLOTS.in_article,
      article_list: AD_SLOTS.in_feed,
      sidebar: AD_SLOTS.sidebar_rectangle,
    },
  },
  
  caremate: {
    clientId: 'ca-pub-CAREMATE', // Replace with actual
    enabled: true,
    testMode: false,
    disableForPremium: true,
    slots: {
      header: AD_SLOTS.header_banner,
      drug_detail: AD_SLOTS.in_article,
      article_list: AD_SLOTS.in_feed,
      sidebar: AD_SLOTS.sidebar_rectangle,
    },
  },
};

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Get AdSense config for an app
 */
export function getAdConfig(
  app: AppName,
  options?: {
    clientId?: string;
    enabled?: boolean;
    testMode?: boolean;
  }
): AdConfig {
  const baseConfig = AD_CONFIGS[app];
  
  return {
    ...baseConfig,
    ...(options?.clientId && { clientId: options.clientId }),
    ...(options?.enabled !== undefined && { enabled: options.enabled }),
    ...(options?.testMode !== undefined && { testMode: options.testMode }),
  };
}

/**
 * Check if ads should be shown
 */
export function shouldShowAds(config: AdConfig, isPremiumUser: boolean): boolean {
  if (!config.enabled) return false;
  if (config.disableForPremium && isPremiumUser) return false;
  return true;
}
