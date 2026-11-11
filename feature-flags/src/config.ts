/**
 * Feature Flags Configuration - Nov 2026 Release
 * 
 * CRITICAL:  All AI features are DISABLED for Nov 2026.
 * Features must be COMPLETELY HIDDEN from UI (no "Coming Soon").
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { AllFeatureFlags } from './types';

// ═══════════════════════════════════════════════════════════════
//  DEFAULT CONFIGURATION - NOV 2026 RELEASE
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_FLAGS: AllFeatureFlags = {
  // ─────────────────────────────────────────────────────────────
  //  GLOBAL AI FLAGS - ALL DISABLED
  // ─────────────────────────────────────────────────────────────
  AI_ENABLED: false,
  AI_CHAT: false,
  AI_STREAM: false,
  AI_VOICE_SEARCH: false,
  AI_PERSONALIZE: false,
  AI_ANALYSIS: false,

  // ─────────────────────────────────────────────────────────────
  //  TRENDBRIEF AI - News Aggregation
  // ─────────────────────────────────────────────────────────────
  trendbrief: {
    // AI Features (DISABLED - hide completely)
    SUMMARIZE_URL: false,
    BRIEFING: false,
    TTS: false,
    
    // Enabled Features
    SEARCH: true,
    BROWSE_TOPICS: true,
    BREAKING_NEWS: true,
    TRENDING: true,
  },

  // ─────────────────────────────────────────────────────────────
  //  SMARTBUY AI - Shopping Comparison
  // ─────────────────────────────────────────────────────────────
  smartbuy: {
    // AI Features (DISABLED - hide completely)
    AI_SHOPPING_ASSISTANT: false,
    AI_REVIEW_SUMMARY_REALTIME: false,
    
    // Enabled Features
    SEARCH: true,
    PRICE_COMPARISON: true,
    FLASH_SALES: true,
    PRECOMPUTED_SIMILAR: true,
    PRECOMPUTED_REVIEW_SUMMARY: true,
  },

  // ─────────────────────────────────────────────────────────────
  //  FINTAX AI - Personal Finance & Tax
  // ─────────────────────────────────────────────────────────────
  fintax: {
    // AI Features (DISABLED - hide completely)
    AI_TAX_ADVISOR: false,
    AI_CLASSIFICATION: false,
    ML_ANOMALY: false,
    
    // Enabled Features
    PIT_CALCULATOR: true,
    TRANSACTION_MANAGEMENT: true,
    RULE_BASED_CLASSIFY: true,
    RULE_BASED_ANOMALY: true,
    STATIC_FAQ: true,
    STATIC_TIPS: true,
  },

  // ─────────────────────────────────────────────────────────────
  //  DOCTORCAR AI - Vehicle Diagnostics
  // ─────────────────────────────────────────────────────────────
  doctorcar: {
    // AI Features (DISABLED - hide completely)
    AI_DIAGNOSIS: false,
    IMAGE_ANALYSIS: false,
    AI_QUICK_FAQ: false,
    
    // Enabled Features
    DTC_DATABASE: true,
    MAINTENANCE_SCHEDULE: true,
    ARTICLES: true,
    GARAGE_DIRECTORY: true,
  },

  // ─────────────────────────────────────────────────────────────
  //  CAREMATE AI - Health & Pharmacy
  // ─────────────────────────────────────────────────────────────
  caremate: {
    // AI Features (DISABLED - hide completely)
    AI_SYMPTOM_CHECK: false,
    AI_DRUG_SUGGEST: false,
    EMERGENCY_DETECTION: false,
    
    // Enabled Features
    DRUG_DATABASE: true,
    PHARMACY_DIRECTORY: true,
    HEALTH_ARTICLES: true,
    DRUG_PRICES: true,
    SHOW_MEDICAL_DISCLAIMER: true,
    SHOW_EMERGENCY_INFO: true,
  },
};

// ═══════════════════════════════════════════════════════════════
//  DISABLED FEATURE MESSAGES (Vietnamese)
// ═══════════════════════════════════════════════════════════════

export const DISABLED_MESSAGES: Record<string, { vi: string; en: string; eta: string }> = {
  // Global AI
  AI_ENABLED: {
    vi: 'Tính năng AI đang được phát triển',
    en: 'AI features are under development',
    eta: 'Q1 2027',
  },
  AI_CHAT: {
    vi: 'Chat AI đang được phát triển',
    en: 'AI Chat is under development',
    eta: 'Q1 2027',
  },
  
  // TrendBrief
  SUMMARIZE_URL: {
    vi: 'Tính năng tóm tắt URL đang được phát triển',
    en: 'URL summarization is under development',
    eta: 'Q1 2027',
  },
  BRIEFING: {
    vi: 'Tính năng tạo briefing đang được phát triển',
    en: 'Briefing generation is under development',
    eta: 'Q1 2027',
  },
  TTS: {
    vi: 'Tính năng đọc tin đang được phát triển',
    en: 'Text-to-speech is under development',
    eta: 'Q1 2027',
  },
  
  // SmartBuy
  AI_SHOPPING_ASSISTANT: {
    vi: 'Trợ lý mua sắm AI đang được phát triển',
    en: 'AI Shopping Assistant is under development',
    eta: 'Q1 2027',
  },
  AI_REVIEW_SUMMARY_REALTIME: {
    vi: 'Tổng hợp đánh giá AI đang được phát triển',
    en: 'AI Review Summary is under development',
    eta: 'Q1 2027',
  },
  
  // FinTax
  AI_TAX_ADVISOR: {
    vi: 'Tư vấn thuế AI đang được phát triển',
    en: 'AI Tax Advisor is under development',
    eta: 'Q1 2027',
  },
  AI_CLASSIFICATION: {
    vi: 'Phân loại AI đang được phát triển',
    en: 'AI Classification is under development',
    eta: 'Q1 2027',
  },
  ML_ANOMALY: {
    vi: 'Phát hiện bất thường ML đang được phát triển',
    en: 'ML Anomaly Detection is under development',
    eta: 'Q1 2027',
  },
  
  // DoctorCar
  AI_DIAGNOSIS: {
    vi: 'Chẩn đoán AI đang được phát triển',
    en: 'AI Diagnosis is under development',
    eta: 'Q1 2027',
  },
  IMAGE_ANALYSIS: {
    vi: 'Phân tích hình ảnh đang được phát triển',
    en: 'Image Analysis is under development',
    eta: 'Q1 2027',
  },
  AI_QUICK_FAQ: {
    vi: 'FAQ AI đang được phát triển',
    en: 'AI FAQ is under development',
    eta: 'Q1 2027',
  },
  
  // CareMate
  AI_SYMPTOM_CHECK: {
    vi: 'Kiểm tra triệu chứng AI đang được phát triển',
    en: 'AI Symptom Check is under development',
    eta: 'Q1 2027',
  },
  AI_DRUG_SUGGEST: {
    vi: 'Gợi ý thuốc AI đang được phát triển',
    en: 'AI Drug Suggestion is under development',
    eta: 'Q1 2027',
  },
  EMERGENCY_DETECTION: {
    vi: 'Phát hiện khẩn cấp đang được phát triển',
    en: 'Emergency Detection is under development',
    eta: 'Q1 2027',
  },
};

// ═══════════════════════════════════════════════════════════════
//  ALTERNATIVES FOR DISABLED FEATURES
// ═══════════════════════════════════════════════════════════════

export const FEATURE_ALTERNATIVES: Record<string, Array<{ icon: string; text: string; link: string }>> = {
  // TrendBrief
  SUMMARIZE_URL: [
    { icon: '📰', text: 'Đọc tin đầy đủ', link: '/news' },
    { icon: '🔥', text: 'Xem tin nổi bật', link: '/trending' },
  ],
  BRIEFING: [
    { icon: '📋', text: 'Xem danh sách tin', link: '/topics' },
  ],
  TTS: [
    { icon: '📖', text: 'Đọc bài viết', link: '/articles' },
  ],
  
  // SmartBuy
  AI_SHOPPING_ASSISTANT: [
    { icon: '🔍', text: 'Tìm kiếm sản phẩm', link: '/search' },
    { icon: '💰', text: 'So sánh giá', link: '/compare' },
  ],
  AI_REVIEW_SUMMARY_REALTIME: [
    { icon: '⭐', text: 'Xem đánh giá tổng hợp', link: '/reviews' },
  ],
  
  // FinTax
  AI_TAX_ADVISOR: [
    { icon: '🧮', text: 'Tính thuế TNCN', link: '/calculator' },
    { icon: '❓', text: 'Xem FAQ thuế', link: '/faq' },
  ],
  AI_CLASSIFICATION: [
    { icon: '📂', text: 'Phân loại thủ công', link: '/transactions' },
  ],
  ML_ANOMALY: [
    { icon: '📊', text: 'Xem báo cáo chi tiêu', link: '/reports' },
  ],
  
  // DoctorCar
  AI_DIAGNOSIS: [
    { icon: '🔧', text: 'Tra mã lỗi DTC', link: '/dtc' },
    { icon: '📅', text: 'Lịch bảo dưỡng', link: '/maintenance' },
  ],
  IMAGE_ANALYSIS: [
    { icon: '📝', text: 'Đọc bài viết', link: '/articles' },
  ],
  AI_QUICK_FAQ: [
    { icon: '📚', text: 'Xem bài viết', link: '/articles' },
  ],
  
  // CareMate
  AI_SYMPTOM_CHECK: [
    { icon: '💊', text: 'Tra cứu thuốc', link: '/drugs' },
    { icon: '📖', text: 'Đọc bài sức khỏe', link: '/articles' },
  ],
  AI_DRUG_SUGGEST: [
    { icon: '🔍', text: 'Tìm kiếm thuốc', link: '/search' },
    { icon: '🏥', text: 'Tìm nhà thuốc', link: '/pharmacies' },
  ],
  EMERGENCY_DETECTION: [
    { icon: '🚨', text: 'Gọi cấp cứu 115', link: 'tel:115' },
    { icon: '🏥', text: 'Tìm bệnh viện gần', link: '/hospitals' },
  ],
};
