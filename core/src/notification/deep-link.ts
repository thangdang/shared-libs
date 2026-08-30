/**
 * DeepLinkBuilder — Builds platform-specific deep links for notifications.
 *
 * Converts a path (e.g., '/product/iphone-15') into:
 * - Web: https://smartbuy.winlux.com/product/iphone-15
 * - iOS: smartbuy://product/iphone-15
 * - Android: smartbuy://product/iphone-15
 */

interface DeepLinkConfig {
  web?: string;
  ios?: string;
  android?: string;
}

// Default deep link bases per product
const PRODUCT_DEEP_LINKS: Record<string, DeepLinkConfig> = {
  smartbuy: {
    web: 'https://smartbuy.winlux.com',
    ios: 'smartbuy://',
    android: 'smartbuy://',
  },
  trendbriefai: {
    web: 'https://trendbriefai.winlux.com',
    ios: 'trendbriefai://',
    android: 'trendbriefai://',
  },
  caremate: {
    web: 'https://caremate.winlux.com',
    ios: 'caremate://',
    android: 'caremate://',
  },
  fintax: {
    web: 'https://fintax.winlux.com',
    ios: 'fintax://',
    android: 'fintax://',
  },
  doctorcar: {
    web: 'https://doctorcar.winlux.com',
    ios: 'doctorcar://',
    android: 'doctorcar://',
  },
  childhood: {
    web: 'https://childhood.winlux.com',
    ios: 'childhood://',
    android: 'childhood://',
  },
};

export class DeepLinkBuilder {
  private config: DeepLinkConfig;

  constructor(customConfig?: DeepLinkConfig) {
    this.config = customConfig || {};
  }

  /**
   * Build a deep link for a given path and product.
   * Returns web URL by default (works for both push notification data and Zalo).
   */
  build(path: string, product: string): string {
    const base = this.config.web || PRODUCT_DEEP_LINKS[product]?.web || '';
    if (!base) return path;

    // Ensure path starts with /
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
  }

  /**
   * Build platform-specific links (for universal links / app links).
   */
  buildAll(path: string, product: string): { web: string; ios: string; android: string } {
    const defaults = PRODUCT_DEEP_LINKS[product] || {};
    const web = (this.config.web || defaults.web || '') + (path.startsWith('/') ? path : `/${path}`);
    const ios = (this.config.ios || defaults.ios || '') + path.replace(/^\//, '');
    const android = (this.config.android || defaults.android || '') + path.replace(/^\//, '');

    return { web, ios, android };
  }
}
