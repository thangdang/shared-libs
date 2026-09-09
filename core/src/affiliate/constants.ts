/**
 * Affiliate Constants - Platform configurations and category mappings
 */

import { Platform, Category, AppName } from './types';

/**
 * Category detection patterns (Vietnamese + English)
 */
export const CATEGORY_PATTERNS: Record<string, { category: Category; bestPlatform: Platform; fallback: Platform[] }> = {
  // Electronics
  'điện thoại|phone|iphone|samsung|xiaomi|oppo|vivo|realme': {
    category: 'electronics',
    bestPlatform: 'shopee',
    fallback: ['lazada', 'tiki']
  },
  'laptop|macbook|dell|asus|lenovo|hp|acer': {
    category: 'electronics',
    bestPlatform: 'tiki',
    fallback: ['shopee', 'lazada']
  },
  'tai nghe|headphone|airpods|earbuds|loa|speaker': {
    category: 'electronics',
    bestPlatform: 'shopee',
    fallback: ['lazada', 'tiki']
  },

  // Fashion
  'áo|quần|váy|đầm|giày|dép|túi xách|balo|thời trang': {
    category: 'fashion',
    bestPlatform: 'shopee',
    fallback: ['lazada']
  },

  // Home & Living
  'nội thất|bàn|ghế|giường|tủ|đèn|sofa|kệ|rèm': {
    category: 'home',
    bestPlatform: 'lazada',
    fallback: ['shopee']
  },

  // Health & Beauty
  'mỹ phẩm|skincare|serum|kem|son|mascara|phấn|makeup': {
    category: 'health_beauty',
    bestPlatform: 'shopee',
    fallback: ['lazada', 'tiki']
  },

  // Books
  'sách|book|truyện|tiểu thuyết|manga': {
    category: 'books',
    bestPlatform: 'tiki',
    fallback: ['shopee']
  },

  // Baby & Kids
  'bỉm|tã|sữa bột|đồ chơi|baby|trẻ em|bé|em bé': {
    category: 'baby',
    bestPlatform: 'shopee',
    fallback: ['lazada', 'tiki']
  },

  // Auto Parts (DoctorCar)
  'má phanh|nhớt|dầu|lốp|ắc quy|lọc gió|bugi|phụ tùng|ô tô|xe hơi': {
    category: 'auto_parts',
    bestPlatform: 'shopee',
    fallback: ['lazada']
  },

  // Insurance (DoctorCar)
  'bảo hiểm|insurance': {
    category: 'insurance',
    bestPlatform: 'shopee', // Will be overridden by direct partnership
    fallback: []
  },

  // Medicine (CareMate)
  'thuốc|panadol|efferalgan|decolgen|vitamin|kháng sinh': {
    category: 'medicine',
    bestPlatform: 'longchau',
    fallback: ['pharmacity', 'ankhang']
  },

  // Supplements (CareMate)
  'thực phẩm chức năng|tpcn|bổ sung|centrum|blackmores|omega': {
    category: 'supplements',
    bestPlatform: 'longchau',
    fallback: ['shopee']
  }
};

/**
 * Commission rates by platform and category (VN market)
 */
export const PLATFORM_COMMISSION: Record<Platform, Record<Category | 'default', number>> = {
  shopee: {
    electronics: 0.03,
    fashion: 0.08,
    home: 0.06,
    health_beauty: 0.07,
    books: 0.04,
    baby: 0.06,
    auto_parts: 0.05,
    insurance: 0,
    medicine: 0,
    supplements: 0.05,
    default: 0.05
  },
  lazada: {
    electronics: 0.04,
    fashion: 0.10,
    home: 0.10,
    health_beauty: 0.08,
    books: 0.03,
    baby: 0.07,
    auto_parts: 0.06,
    insurance: 0,
    medicine: 0,
    supplements: 0.06,
    default: 0.06
  },
  tiki: {
    electronics: 0.03,
    fashion: 0.05,
    home: 0.04,
    health_beauty: 0.05,
    books: 0.05,
    baby: 0.04,
    auto_parts: 0.03,
    insurance: 0,
    medicine: 0,
    supplements: 0.04,
    default: 0.04
  },
  tiktok: {
    electronics: 0.05,
    fashion: 0.15,
    home: 0.10,
    health_beauty: 0.12,
    books: 0.05,
    baby: 0.08,
    auto_parts: 0.05,
    insurance: 0,
    medicine: 0,
    supplements: 0.08,
    default: 0.08
  },
  longchau: {
    electronics: 0,
    fashion: 0,
    home: 0,
    health_beauty: 0.03,
    books: 0,
    baby: 0.03,
    auto_parts: 0,
    insurance: 0,
    medicine: 0.04,
    supplements: 0.05,
    default: 0.04
  },
  pharmacity: {
    electronics: 0,
    fashion: 0,
    home: 0,
    health_beauty: 0.02,
    books: 0,
    baby: 0.02,
    auto_parts: 0,
    insurance: 0,
    medicine: 0.03,
    supplements: 0.04,
    default: 0.03
  },
  ankhang: {
    electronics: 0,
    fashion: 0,
    home: 0,
    health_beauty: 0.03,
    books: 0,
    baby: 0.02,
    auto_parts: 0,
    insurance: 0,
    medicine: 0.05,
    supplements: 0.05,
    default: 0.04
  }
};

/**
 * App-specific platform preferences
 */
export const APP_PLATFORM_PRIORITY: Record<AppName, Platform[]> = {
  smartbuy: ['shopee', 'lazada', 'tiki', 'tiktok'],
  video_engine: ['shopee', 'lazada', 'tiki'],
  doctorcar: ['shopee', 'lazada'], // + direct insurance partners
  caremate: ['longchau', 'pharmacity', 'ankhang', 'shopee'],
  fintax: ['tiki', 'shopee'], // Books mostly
  trendbrief: ['shopee', 'lazada', 'tiki'] // Context-based
};

/**
 * Platform base URLs for affiliate links
 */
export const PLATFORM_URLS: Record<Platform, { base: string; affiliateFormat: string }> = {
  shopee: {
    base: 'https://shopee.vn',
    affiliateFormat: 'https://s.shopee.vn/redirect?affiliate_id={affiliateId}&url={encodedUrl}&sub_id={trackingId}'
  },
  lazada: {
    base: 'https://lazada.vn',
    affiliateFormat: 'https://c.lazada.vn/t/c.{affiliateId}?url={encodedUrl}&sub_aff_id={trackingId}'
  },
  tiki: {
    base: 'https://tiki.vn',
    affiliateFormat: 'https://tiki.vn/affiliate?aff_id={affiliateId}&url={encodedUrl}&sub={trackingId}'
  },
  tiktok: {
    base: 'https://www.tiktok.com/shop',
    affiliateFormat: '{originalUrl}' // TikTok handles via creator marketplace
  },
  longchau: {
    base: 'https://nhathuoclongchau.com.vn',
    affiliateFormat: '{originalUrl}?ref={affiliateId}&tracking={trackingId}'
  },
  pharmacity: {
    base: 'https://www.pharmacity.vn',
    affiliateFormat: '{originalUrl}?utm_source={affiliateId}&utm_medium=affiliate&sub={trackingId}'
  },
  ankhang: {
    base: 'https://www.nhathuocankhang.com',
    affiliateFormat: '{originalUrl}?partner={affiliateId}&track={trackingId}'
  }
};
