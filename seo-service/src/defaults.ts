/**
 * SEO Service Defaults - Nov 2026 Release
 * 
 * Default SEO configurations for all 5 apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { SEOServiceConfig } from './types';

type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  DEFAULT SEO CONFIGS PER APP
// ═══════════════════════════════════════════════════════════════

export const APP_SEO_CONFIGS: Record<AppName, SEOServiceConfig> = {
  trendbrief: {
    defaultTitle: 'TrendBrief AI - Tin Tức Thông Minh',
    titleSuffix: ' | TrendBrief AI',
    defaultDescription: 'Đọc tin tức nhanh, thông minh với TrendBrief AI. Tổng hợp tin tức từ nhiều nguồn uy tín, cập nhật 24/7. Tin tức Việt Nam, thế giới, công nghệ, giải trí.',
    defaultKeywords: [
      'tin tức', 'news', 'trending', 'việt nam', 'cập nhật', 'tổng hợp tin',
      'tin nóng', 'tin mới nhất', 'đọc báo', 'thời sự',
    ],
    defaultOgImage: '/assets/og/trendbrief-default.png',
    canonicalBase: 'https://trendbrief.ai',
    siteName: 'TrendBrief AI',
    defaultLocale: 'vi_VN',
    twitterSite: '@TrendBriefAI',
    enableStructuredData: true,
  },

  smartbuy: {
    defaultTitle: 'SmartBuy AI - So Sánh Giá Thông Minh',
    titleSuffix: ' | SmartBuy AI',
    defaultDescription: 'So sánh giá từ Shopee, Lazada, Tiki trong 1 giây. Tìm deal hot, flash sale, mã giảm giá. SmartBuy AI giúp bạn mua sắm thông minh, tiết kiệm hơn.',
    defaultKeywords: [
      'so sánh giá', 'mua sắm', 'deal', 'giảm giá', 'shopee', 'lazada', 'tiki',
      'flash sale', 'mã giảm giá', 'voucher', 'khuyến mãi',
    ],
    defaultOgImage: '/assets/og/smartbuy-default.png',
    canonicalBase: 'https://smartbuy.ai',
    siteName: 'SmartBuy AI',
    defaultLocale: 'vi_VN',
    twitterSite: '@SmartBuyAI',
    enableStructuredData: true,
  },

  fintax: {
    defaultTitle: 'FinTax AI - Quản Lý Tài Chính Cá Nhân',
    titleSuffix: ' | FinTax AI',
    defaultDescription: 'Tính thuế TNCN chính xác theo công thức 2024. Quản lý thu chi, phân loại giao dịch, báo cáo tài chính cá nhân. Công cụ tài chính miễn phí cho người Việt.',
    defaultKeywords: [
      'thuế TNCN', 'tài chính cá nhân', 'quản lý chi tiêu', 'tính thuế',
      'personal finance', 'thu nhập cá nhân', 'kê khai thuế', 'giảm trừ gia cảnh',
    ],
    defaultOgImage: '/assets/og/fintax-default.png',
    canonicalBase: 'https://fintax.ai',
    siteName: 'FinTax AI',
    defaultLocale: 'vi_VN',
    twitterSite: '@FinTaxAI',
    enableStructuredData: true,
  },

  doctorcar: {
    defaultTitle: 'DoctorCar AI - Chẩn Đoán Ô Tô Thông Minh',
    titleSuffix: ' | DoctorCar AI',
    defaultDescription: 'Tra mã lỗi OBD-II/DTC miễn phí. Lịch bảo dưỡng ô tô theo km. Tìm garage sửa xe uy tín gần bạn. DoctorCar AI - bác sĩ cho xe của bạn.',
    defaultKeywords: [
      'mã lỗi ô tô', 'DTC', 'OBD-II', 'bảo dưỡng xe', 'garage', 'sửa xe',
      'car diagnostics', 'check engine', 'lỗi động cơ', 'thay dầu',
    ],
    defaultOgImage: '/assets/og/doctorcar-default.png',
    canonicalBase: 'https://doctorcar.ai',
    siteName: 'DoctorCar AI',
    defaultLocale: 'vi_VN',
    twitterSite: '@DoctorCarAI',
    enableStructuredData: true,
  },

  caremate: {
    defaultTitle: 'CareMate AI - Tra Cứu Thuốc & Sức Khỏe',
    titleSuffix: ' | CareMate AI',
    defaultDescription: 'Tra cứu thông tin thuốc đầy đủ, chính xác. Tìm nhà thuốc gần nhất, so sánh giá thuốc. Đọc bài viết sức khỏe từ nguồn uy tín. CareMate AI - người bạn đồng hành sức khỏe.',
    defaultKeywords: [
      'tra cứu thuốc', 'nhà thuốc', 'sức khỏe', 'drug database', 'pharmacy',
      'health', 'thuốc', 'bệnh', 'triệu chứng', 'giá thuốc',
    ],
    defaultOgImage: '/assets/og/caremate-default.png',
    canonicalBase: 'https://caremate.ai',
    siteName: 'CareMate AI',
    defaultLocale: 'vi_VN',
    twitterSite: '@CareMateAI',
    enableStructuredData: true,
  },
};
