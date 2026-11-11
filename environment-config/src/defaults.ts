/**
 * Environment Configuration Defaults - Nov 2026 Release
 * 
 * Default configurations for all 5 AI apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { AppConfig, AppName, FrontendConfig, SEOConfig } from './types';

// ═══════════════════════════════════════════════════════════════
//  SEO DEFAULTS PER APP
// ═══════════════════════════════════════════════════════════════

export const SEO_DEFAULTS: Record<AppName, SEOConfig> = {
  trendbrief: {
    defaultTitle: 'TrendBrief AI - Tin Tức Thông Minh',
    titleSuffix: ' | TrendBrief AI',
    defaultDescription: 'Đọc tin tức nhanh, thông minh với TrendBrief AI. Tổng hợp tin tức từ nhiều nguồn, cập nhật 24/7.',
    defaultKeywords: ['tin tức', 'news', 'trending', 'việt nam', 'cập nhật', 'tổng hợp tin'],
    defaultOgImage: '/assets/og-trendbrief.png',
    canonicalBase: 'https://trendbrief.ai',
    enableStructuredData: true,
  },
  smartbuy: {
    defaultTitle: 'SmartBuy AI - So Sánh Giá Thông Minh',
    titleSuffix: ' | SmartBuy AI',
    defaultDescription: 'So sánh giá, tìm deal hot từ Shopee, Lazada, Tiki. SmartBuy AI giúp bạn mua sắm thông minh hơn.',
    defaultKeywords: ['so sánh giá', 'mua sắm', 'deal', 'giảm giá', 'shopee', 'lazada', 'tiki'],
    defaultOgImage: '/assets/og-smartbuy.png',
    canonicalBase: 'https://smartbuy.ai',
    enableStructuredData: true,
  },
  fintax: {
    defaultTitle: 'FinTax AI - Quản Lý Tài Chính Cá Nhân',
    titleSuffix: ' | FinTax AI',
    defaultDescription: 'Quản lý chi tiêu, tính thuế TNCN dễ dàng với FinTax AI. Công cụ tài chính cá nhân cho người Việt.',
    defaultKeywords: ['thuế TNCN', 'tài chính cá nhân', 'quản lý chi tiêu', 'tính thuế', 'personal finance'],
    defaultOgImage: '/assets/og-fintax.png',
    canonicalBase: 'https://fintax.ai',
    enableStructuredData: true,
  },
  doctorcar: {
    defaultTitle: 'DoctorCar AI - Chẩn Đoán Ô Tô Thông Minh',
    titleSuffix: ' | DoctorCar AI',
    defaultDescription: 'Tra mã lỗi DTC, lịch bảo dưỡng ô tô, tìm garage uy tín. DoctorCar AI - bác sĩ cho xe của bạn.',
    defaultKeywords: ['mã lỗi ô tô', 'DTC', 'bảo dưỡng xe', 'garage', 'sửa xe', 'car diagnostics'],
    defaultOgImage: '/assets/og-doctorcar.png',
    canonicalBase: 'https://doctorcar.ai',
    enableStructuredData: true,
  },
  caremate: {
    defaultTitle: 'CareMate AI - Tra Cứu Thuốc & Sức Khỏe',
    titleSuffix: ' | CareMate AI',
    defaultDescription: 'Tra cứu thuốc, tìm nhà thuốc gần nhất, đọc bài viết sức khỏe. CareMate AI - người bạn đồng hành sức khỏe.',
    defaultKeywords: ['tra cứu thuốc', 'nhà thuốc', 'sức khỏe', 'drug database', 'pharmacy', 'health'],
    defaultOgImage: '/assets/og-caremate.png',
    canonicalBase: 'https://caremate.ai',
    enableStructuredData: true,
  },
};

// ═══════════════════════════════════════════════════════════════
//  APP DOMAINS
// ═══════════════════════════════════════════════════════════════

export const APP_DOMAINS: Record<AppName, { dev: string; staging: string; prod: string }> = {
  trendbrief: {
    dev: 'http://localhost:4200',
    staging: 'https://staging.trendbrief.ai',
    prod: 'https://trendbrief.ai',
  },
  smartbuy: {
    dev: 'http://localhost:4201',
    staging: 'https://staging.smartbuy.ai',
    prod: 'https://smartbuy.ai',
  },
  fintax: {
    dev: 'http://localhost:4202',
    staging: 'https://staging.fintax.ai',
    prod: 'https://fintax.ai',
  },
  doctorcar: {
    dev: 'http://localhost:4203',
    staging: 'https://staging.doctorcar.ai',
    prod: 'https://doctorcar.ai',
  },
  caremate: {
    dev: 'http://localhost:4204',
    staging: 'https://staging.caremate.ai',
    prod: 'https://caremate.ai',
  },
};

// ═══════════════════════════════════════════════════════════════
//  API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

export const API_ENDPOINTS: Record<AppName, { dev: string; staging: string; prod: string }> = {
  trendbrief: {
    dev: 'http://localhost:3000',
    staging: 'https://api.staging.trendbrief.ai',
    prod: 'https://api.trendbrief.ai',
  },
  smartbuy: {
    dev: 'http://localhost:3001',
    staging: 'https://api.staging.smartbuy.ai',
    prod: 'https://api.smartbuy.ai',
  },
  fintax: {
    dev: 'http://localhost:3002',
    staging: 'https://api.staging.fintax.ai',
    prod: 'https://api.fintax.ai',
  },
  doctorcar: {
    dev: 'http://localhost:3003',
    staging: 'https://api.staging.doctorcar.ai',
    prod: 'https://api.doctorcar.ai',
  },
  caremate: {
    dev: 'http://localhost:3004',
    staging: 'https://api.staging.caremate.ai',
    prod: 'https://api.caremate.ai',
  },
};

// ═══════════════════════════════════════════════════════════════
//  COMMON DEFAULTS
// ═══════════════════════════════════════════════════════════════

export const MONETIZATION_DEFAULTS = {
  adsenseEnabled: true,
  adsenseClientId: '', // Set via environment variable
  premiumEnabled: true,
  premiumPriceVND: 99000, // 99,000 VND
  payment: {
    momoPartnerCode: '', // Set via environment variable
    momoAccessKey: '', // Set via environment variable
    momoEndpoint: 'https://payment.momo.vn/v2/gateway/api/create',
  },
};

export const ANALYTICS_DEFAULTS = {
  ga4MeasurementId: '', // Set per app
  enabled: true,
  debug: false,
  customDimensions: {
    userType: 'user_type',
    appVersion: 'app_version',
    environment: 'environment',
  },
};

export const CACHE_DEFAULTS = {
  enabled: true,
  defaultTtl: 300, // 5 minutes
  driver: 'memory' as const,
};

export const RATE_LIMIT_DEFAULTS = {
  enabled: true,
  maxRequests: 100,
  windowSeconds: 60,
  skipPremium: true,
};

// ═══════════════════════════════════════════════════════════════
//  GA4 MEASUREMENT IDs PER APP
// ═══════════════════════════════════════════════════════════════

export const GA4_MEASUREMENT_IDS: Record<AppName, string> = {
  trendbrief: 'G-TRENDBRIEF01', // Replace with actual
  smartbuy: 'G-SMARTBUY0001',   // Replace with actual
  fintax: 'G-FINTAX000001',     // Replace with actual
  doctorcar: 'G-DOCTORCAR001', // Replace with actual
  caremate: 'G-CAREMATE0001',   // Replace with actual
};

// ═══════════════════════════════════════════════════════════════
//  FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create frontend-safe configuration
 */
export function createFrontendConfig(app: AppName, env: 'development' | 'staging' | 'production'): FrontendConfig {
  const envKey = env === 'development' ? 'dev' : env === 'staging' ? 'staging' : 'prod';
  
  return {
    appName: app,
    environment: env,
    version: '1.0.0',
    debug: env === 'development',
    baseUrl: APP_DOMAINS[app][envKey],
    apiUrl: API_ENDPOINTS[app][envKey],
    
    monetization: {
      adsenseEnabled: MONETIZATION_DEFAULTS.adsenseEnabled,
      adsenseClientId: MONETIZATION_DEFAULTS.adsenseClientId,
      premiumEnabled: MONETIZATION_DEFAULTS.premiumEnabled,
      premiumPriceVND: MONETIZATION_DEFAULTS.premiumPriceVND,
    },
    
    analytics: {
      ga4MeasurementId: GA4_MEASUREMENT_IDS[app],
      enabled: true,
      debug: env === 'development',
    },
    
    seo: SEO_DEFAULTS[app],
  };
}
