/**
 * Feature Flag Types
 * Task: SHARED-001
 * 
 * All AI features that can be toggled
 * Nov 2026: All AI features = false
 */

// ============================================================
// TRENDBRIEF FEATURES
// ============================================================
export interface TrendBriefFeatures {
  // AI-powered features (disabled Nov 2026)
  ai_summarize_url: boolean;      // /summarize-url endpoint
  ai_daily_briefing: boolean;     // /briefing endpoint
  ai_text_to_speech: boolean;     // /tts endpoint
  ai_smart_search: boolean;       // AI-powered search

  // Non-AI features (enabled)
  rss_headlines: boolean;         // 15-min RSS fetcher
  breaking_news: boolean;         // BREAKING section
  trending_topics: boolean;       // TRENDING section
  news_categories: boolean;       // Category filtering
}

// ============================================================
// SMARTBUY FEATURES
// ============================================================
export interface SmartBuyFeatures {
  // AI-powered features (disabled Nov 2026)
  ai_chat_query: boolean;         // /ai/query endpoint
  ai_stream_query: boolean;       // /ai/query/stream endpoint
  ai_voice_search: boolean;       // /ai/query/voice endpoint
  ai_product_recommendations: boolean;

  // Non-AI features (enabled)
  price_comparison: boolean;      // Core price comparison
  price_history: boolean;         // Price history charts
  flash_sales: boolean;           // Flash sale section
  price_alerts: boolean;          // Price drop notifications
  affiliate_links: boolean;       // Affiliate integration
}

// ============================================================
// FINTAX FEATURES
// ============================================================
export interface FinTaxFeatures {
  // AI-powered features (disabled Nov 2026)
  ai_chat: boolean;               // /chat endpoint
  ai_tax_advisor: boolean;        // /tax-advisor endpoint
  ai_receipt_ocr: boolean;        // AI OCR for receipts
  ai_classification: boolean;     // AI expense classification

  // Non-AI features (enabled)
  pit_calculator: boolean;        // PIT calculator
  expense_tracker: boolean;       // Manual expense tracking
  tax_faq: boolean;               // FAQ pages
  tax_tips: boolean;              // Tips carousel
  keyword_classification: boolean; // Rule-based classification
  anomaly_detection: boolean;     // Z-score anomaly detection
}

// ============================================================
// DOCTORCAR FEATURES
// ============================================================
export interface DoctorCarFeatures {
  // AI-powered features (disabled Nov 2026)
  ai_diagnosis: boolean;          // /diagnosis/analyze endpoint
  ai_image_analysis: boolean;     // Image analysis endpoints
  ai_symptom_chat: boolean;       // AI symptom chat

  // Non-AI features (enabled)
  dtc_lookup: boolean;            // DTC code lookup
  dtc_search: boolean;            // DTC search
  maintenance_schedules: boolean; // Maintenance schedules
  forum_content: boolean;         // Forum scraped content
  car_selector: boolean;          // Car model selector
}

// ============================================================
// CAREMATE FEATURES
// ============================================================
export interface CareMateFeatures {
  // AI-powered features (disabled Nov 2026)
  ai_symptom_checker: boolean;    // /check-symptoms endpoint
  ai_drug_suggestions: boolean;   // /suggest-drugs endpoint
  ai_health_chat: boolean;        // AI health chat

  // Non-AI features (enabled)
  drug_search: boolean;           // Drug database search
  drug_details: boolean;          // Drug detail pages
  condition_browser: boolean;     // Condition browser
  health_articles: boolean;       // Health articles
  pharmacy_prices: boolean;       // Pharmacy price comparison
  disclaimer: boolean;            // Health disclaimers (ALWAYS true)
}

// ============================================================
// GLOBAL FEATURES
// ============================================================
export interface GlobalFeatures {
  premium_subscription: boolean;  // Premium features
  referral_program: boolean;      // Referral system
  gamification: boolean;          // Points, streaks, achievements
  social_sharing: boolean;        // Social share buttons
  push_notifications: boolean;    // Web push
  email_marketing: boolean;       // Email sequences
  adsense: boolean;               // Google AdSense
  analytics: boolean;             // Analytics tracking
}

// ============================================================
// COMBINED FEATURE FLAGS
// ============================================================
export interface FeatureFlags {
  trendbrief: TrendBriefFeatures;
  smartbuy: SmartBuyFeatures;
  fintax: FinTaxFeatures;
  doctorcar: DoctorCarFeatures;
  caremate: CareMateFeatures;
  global: GlobalFeatures;
}

// App identifiers
export type AppId = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// Feature path (e.g., 'trendbrief.ai_summarize_url')
export type FeaturePath = string;

// Feature gate response for disabled features
export interface FeatureGateResponse {
  enabled: boolean;
  message: string;           // Vietnamese message
  alternatives?: string[];   // Alternative actions
  eta?: string;              // Expected enable date
}
