/**
 * Feature Flag Service
 * Task: SHARED-001
 * 
 * Core service to check feature flags
 * Loads from environment variables
 */

import { 
  FeatureFlags, 
  AppId, 
  FeaturePath,
  TrendBriefFeatures,
  SmartBuyFeatures,
  FinTaxFeatures,
  DoctorCarFeatures,
  CareMateFeatures,
  GlobalFeatures
} from './types';

// Default flags for Nov 2026 go-live
// ALL AI features disabled, all non-AI enabled
const DEFAULT_FLAGS: FeatureFlags = {
  trendbrief: {
    ai_summarize_url: false,
    ai_daily_briefing: false,
    ai_text_to_speech: false,
    ai_smart_search: false,
    rss_headlines: true,
    breaking_news: true,
    trending_topics: true,
    news_categories: true
  },
  smartbuy: {
    ai_chat_query: false,
    ai_stream_query: false,
    ai_voice_search: false,
    ai_product_recommendations: false,
    price_comparison: true,
    price_history: true,
    flash_sales: true,
    price_alerts: true,
    affiliate_links: true
  },
  fintax: {
    ai_chat: false,
    ai_tax_advisor: false,
    ai_receipt_ocr: false,
    ai_classification: false,
    pit_calculator: true,
    expense_tracker: true,
    tax_faq: true,
    tax_tips: true,
    keyword_classification: true,
    anomaly_detection: true
  },
  doctorcar: {
    ai_diagnosis: false,
    ai_image_analysis: false,
    ai_symptom_chat: false,
    dtc_lookup: true,
    dtc_search: true,
    maintenance_schedules: true,
    forum_content: true,
    car_selector: true
  },
  caremate: {
    ai_symptom_checker: false,
    ai_drug_suggestions: false,
    ai_health_chat: false,
    drug_search: true,
    drug_details: true,
    condition_browser: true,
    health_articles: true,
    pharmacy_prices: true,
    disclaimer: true  // ALWAYS true for safety
  },
  global: {
    premium_subscription: true,
    referral_program: true,
    gamification: true,
    social_sharing: true,
    push_notifications: true,
    email_marketing: true,
    adsense: true,
    analytics: true
  }
};

class FeatureFlagService {
  private flags: FeatureFlags;
  private initialized = false;

  constructor() {
    this.flags = { ...DEFAULT_FLAGS };
  }

  /**
   * Initialize flags from environment variables
   * Call this on app startup
   */
  init(env?: Record<string, string>): void {
    const source = env || (typeof process !== 'undefined' ? process.env : {});
    
    // Parse environment variables
    // Format: FEATURE_<APP>_<FEATURE>=true|false
    // Example: FEATURE_TRENDBRIEF_AI_SUMMARIZE_URL=false
    
    for (const [key, value] of Object.entries(source)) {
      if (!key.startsWith('FEATURE_')) continue;
      
      const parts = key.replace('FEATURE_', '').toLowerCase().split('_');
      if (parts.length < 2) continue;
      
      const app = parts[0] as AppId;
      const feature = parts.slice(1).join('_');
      
      if (this.flags[app] && feature in this.flags[app]) {
        (this.flags[app] as any)[feature] = value === 'true';
      }
    }

    // Safety: CareMate disclaimer is ALWAYS true
    this.flags.caremate.disclaimer = true;
    
    this.initialized = true;
  }

  /**
   * Check if a feature is enabled
   * @param path Feature path (e.g., 'trendbrief.ai_summarize_url')
   */
  isEnabled(path: FeaturePath): boolean {
    const [app, feature] = path.split('.');
    
    if (!app || !feature) {
      console.warn(`[FeatureFlags] Invalid feature path: ${path}`);
      return false;
    }

    const appFlags = this.flags[app as AppId];
    if (!appFlags) {
      console.warn(`[FeatureFlags] Unknown app: ${app}`);
      return false;
    }

    const value = (appFlags as any)[feature];
    if (value === undefined) {
      console.warn(`[FeatureFlags] Unknown feature: ${path}`);
      return false;
    }

    return value;
  }

  /**
   * Check if ANY AI feature is enabled for an app
   */
  hasAnyAIFeature(app: AppId): boolean {
    const appFlags = this.flags[app];
    if (!appFlags) return false;

    return Object.entries(appFlags)
      .filter(([key]) => key.startsWith('ai_'))
      .some(([, value]) => value === true);
  }

  /**
   * Get all flags for an app
   */
  getAppFlags<T extends AppId>(app: T): FeatureFlags[T] {
    return this.flags[app];
  }

  /**
   * Get all flags
   */
  getAllFlags(): FeatureFlags {
    return { ...this.flags };
  }

  /**
   * Override a flag (useful for testing)
   */
  setFlag(path: FeaturePath, value: boolean): void {
    const [app, feature] = path.split('.');
    if (this.flags[app as AppId] && feature) {
      // Safety: Never allow disabling CareMate disclaimer
      if (app === 'caremate' && feature === 'disclaimer') {
        console.warn('[FeatureFlags] Cannot disable CareMate disclaimer');
        return;
      }
      (this.flags[app as AppId] as any)[feature] = value;
    }
  }

  /**
   * Reset to default flags
   */
  reset(): void {
    this.flags = JSON.parse(JSON.stringify(DEFAULT_FLAGS));
  }
}

// Singleton instance
export const featureFlagService = new FeatureFlagService();

// Convenience function
export function isEnabled(path: FeaturePath): boolean {
  return featureFlagService.isEnabled(path);
}

// Export class for DI
export { FeatureFlagService };
