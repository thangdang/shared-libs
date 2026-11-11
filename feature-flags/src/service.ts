/**
 * Feature Flag Service - Nov 2026 Release
 * 
 * Core service for checking feature flags across all 5 apps.
 * CRITICAL:  All AI features are DISABLED and must be COMPLETELY HIDDEN.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import {
  AllFeatureFlags,
  AppName,
  FeatureName,
  DisabledFeatureResponse,
  TrendBriefFlags,
  SmartBuyFlags,
  FinTaxFlags,
  DoctorCarFlags,
  CareMateFlags,
} from './types';
import { DEFAULT_FLAGS, DISABLED_MESSAGES, FEATURE_ALTERNATIVES } from './config';

// ═══════════════════════════════════════════════════════════════
//  FEATURE FLAG SERVICE
// ═══════════════════════════════════════════════════════════════

export class FeatureFlagService {
  private flags: AllFeatureFlags;
  private overrides: Partial<AllFeatureFlags> = {};

  constructor(customFlags?: Partial<AllFeatureFlags>) {
    this.flags = { ...DEFAULT_FLAGS, ...customFlags };
  }

  // ─────────────────────────────────────────────────────────────
  //  GLOBAL FLAG CHECKS
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if ANY AI feature is enabled globally
   */
  isAIEnabled(): boolean {
    return this.flags.AI_ENABLED;
  }

  /**
   * Check a global feature flag
   */
  isGlobalFeatureEnabled(feature: keyof AllFeatureFlags): boolean {
    const value = this.flags[feature];
    return typeof value === 'boolean' ? value : false;
  }

  // ─────────────────────────────────────────────────────────────
  //  APP-SPECIFIC FLAG CHECKS
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if a feature is enabled for a specific app
   */
  isFeatureEnabled(app: AppName, feature: string): boolean {
    const appFlags = this.flags[app];
    if (!appFlags || typeof appFlags !== 'object') {
      return false;
    }
    return (appFlags as Record<string, boolean>)[feature] ?? false;
  }

  /**
   * Get all flags for a specific app
   */
  getAppFlags(app: AppName): TrendBriefFlags | SmartBuyFlags | FinTaxFlags | DoctorCarFlags | CareMateFlags {
    return this.flags[app];
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): AllFeatureFlags {
    return { ...this.flags };
  }

  // ─────────────────────────────────────────────────────────────
  //  DISABLED FEATURE RESPONSE
  // ─────────────────────────────────────────────────────────────

  /**
   * Get standardized response for disabled features
   * Used by API endpoints to return consistent error messages
   */
  getDisabledFeatureResponse(feature: FeatureName): DisabledFeatureResponse {
    const message = DISABLED_MESSAGES[feature] || {
      vi: 'Tính năng này đang được phát triển',
      en: 'This feature is under development',
      eta: 'Q1 2027',
    };

    const alternatives = FEATURE_ALTERNATIVES[feature] || [];

    return {
      error: 'feature_disabled',
      message: message.vi,
      message_en: message.en,
      feature,
      enabled: false,
      eta: message.eta,
      alternatives,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  CONVENIENCE METHODS PER APP
  // ─────────────────────────────────────────────────────────────

  // TrendBrief
  trendbrief = {
    canSummarizeUrl: (): boolean => this.isFeatureEnabled('trendbrief', 'SUMMARIZE_URL'),
    canGenerateBriefing: (): boolean => this.isFeatureEnabled('trendbrief', 'BRIEFING'),
    canUseTTS: (): boolean => this.isFeatureEnabled('trendbrief', 'TTS'),
    canSearch: (): boolean => this.isFeatureEnabled('trendbrief', 'SEARCH'),
    canBrowseTopics: (): boolean => this.isFeatureEnabled('trendbrief', 'BROWSE_TOPICS'),
    canViewBreakingNews: (): boolean => this.isFeatureEnabled('trendbrief', 'BREAKING_NEWS'),
    canViewTrending: (): boolean => this.isFeatureEnabled('trendbrief', 'TRENDING'),
  };

  // SmartBuy
  smartbuy = {
    canUseAIAssistant: (): boolean => this.isFeatureEnabled('smartbuy', 'AI_SHOPPING_ASSISTANT'),
    canUseRealtimeReviewSummary: (): boolean => this.isFeatureEnabled('smartbuy', 'AI_REVIEW_SUMMARY_REALTIME'),
    canSearch: (): boolean => this.isFeatureEnabled('smartbuy', 'SEARCH'),
    canComparePrices: (): boolean => this.isFeatureEnabled('smartbuy', 'PRICE_COMPARISON'),
    canViewFlashSales: (): boolean => this.isFeatureEnabled('smartbuy', 'FLASH_SALES'),
    canViewPrecomputedSimilar: (): boolean => this.isFeatureEnabled('smartbuy', 'PRECOMPUTED_SIMILAR'),
    canViewPrecomputedReviewSummary: (): boolean => this.isFeatureEnabled('smartbuy', 'PRECOMPUTED_REVIEW_SUMMARY'),
  };

  // FinTax
  fintax = {
    canUseAITaxAdvisor: (): boolean => this.isFeatureEnabled('fintax', 'AI_TAX_ADVISOR'),
    canUseAIClassification: (): boolean => this.isFeatureEnabled('fintax', 'AI_CLASSIFICATION'),
    canUseMLAnomaly: (): boolean => this.isFeatureEnabled('fintax', 'ML_ANOMALY'),
    canUsePITCalculator: (): boolean => this.isFeatureEnabled('fintax', 'PIT_CALCULATOR'),
    canManageTransactions: (): boolean => this.isFeatureEnabled('fintax', 'TRANSACTION_MANAGEMENT'),
    canUseRuleBasedClassify: (): boolean => this.isFeatureEnabled('fintax', 'RULE_BASED_CLASSIFY'),
    canUseRuleBasedAnomaly: (): boolean => this.isFeatureEnabled('fintax', 'RULE_BASED_ANOMALY'),
    canViewStaticFAQ: (): boolean => this.isFeatureEnabled('fintax', 'STATIC_FAQ'),
    canViewStaticTips: (): boolean => this.isFeatureEnabled('fintax', 'STATIC_TIPS'),
  };

  // DoctorCar
  doctorcar = {
    canUseAIDiagnosis: (): boolean => this.isFeatureEnabled('doctorcar', 'AI_DIAGNOSIS'),
    canUseImageAnalysis: (): boolean => this.isFeatureEnabled('doctorcar', 'IMAGE_ANALYSIS'),
    canUseAIQuickFAQ: (): boolean => this.isFeatureEnabled('doctorcar', 'AI_QUICK_FAQ'),
    canUseDTCDatabase: (): boolean => this.isFeatureEnabled('doctorcar', 'DTC_DATABASE'),
    canViewMaintenanceSchedule: (): boolean => this.isFeatureEnabled('doctorcar', 'MAINTENANCE_SCHEDULE'),
    canViewArticles: (): boolean => this.isFeatureEnabled('doctorcar', 'ARTICLES'),
    canViewGarageDirectory: (): boolean => this.isFeatureEnabled('doctorcar', 'GARAGE_DIRECTORY'),
  };

  // CareMate
  caremate = {
    canUseAISymptomCheck: (): boolean => this.isFeatureEnabled('caremate', 'AI_SYMPTOM_CHECK'),
    canUseAIDrugSuggest: (): boolean => this.isFeatureEnabled('caremate', 'AI_DRUG_SUGGEST'),
    canUseEmergencyDetection: (): boolean => this.isFeatureEnabled('caremate', 'EMERGENCY_DETECTION'),
    canUseDrugDatabase: (): boolean => this.isFeatureEnabled('caremate', 'DRUG_DATABASE'),
    canViewPharmacyDirectory: (): boolean => this.isFeatureEnabled('caremate', 'PHARMACY_DIRECTORY'),
    canViewHealthArticles: (): boolean => this.isFeatureEnabled('caremate', 'HEALTH_ARTICLES'),
    canViewDrugPrices: (): boolean => this.isFeatureEnabled('caremate', 'DRUG_PRICES'),
    showMedicalDisclaimer: (): boolean => this.isFeatureEnabled('caremate', 'SHOW_MEDICAL_DISCLAIMER'),
    showEmergencyInfo: (): boolean => this.isFeatureEnabled('caremate', 'SHOW_EMERGENCY_INFO'),
  };

  // ─────────────────────────────────────────────────────────────
  //  RUNTIME OVERRIDES (for testing/development)
  // ─────────────────────────────────────────────────────────────

  /**
   * Override a flag at runtime (development/testing only)
   * WARNING:  Do NOT use in production
   */
  setOverride(app: AppName, feature: string, enabled: boolean): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[FeatureFlags] Runtime overrides disabled in production');
      return;
    }
    const appFlags = this.flags[app] as Record<string, boolean>;
    if (appFlags) {
      appFlags[feature] = enabled;
    }
  }

  /**
   * Clear all runtime overrides
   */
  clearOverrides(): void {
    this.flags = { ...DEFAULT_FLAGS };
  }

  // ─────────────────────────────────────────────────────────────
  //  UTILITY METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get list of all disabled AI features for an app
   */
  getDisabledAIFeatures(app: AppName): string[] {
    const disabled: string[] = [];
    const appFlags = this.flags[app];
    
    if (!appFlags || typeof appFlags !== 'object') {
      return disabled;
    }

    // AI features by app
    const aiFeatures: Record<AppName, string[]> = {
      trendbrief: ['SUMMARIZE_URL', 'BRIEFING', 'TTS'],
      smartbuy: ['AI_SHOPPING_ASSISTANT', 'AI_REVIEW_SUMMARY_REALTIME'],
      fintax: ['AI_TAX_ADVISOR', 'AI_CLASSIFICATION', 'ML_ANOMALY'],
      doctorcar: ['AI_DIAGNOSIS', 'IMAGE_ANALYSIS', 'AI_QUICK_FAQ'],
      caremate: ['AI_SYMPTOM_CHECK', 'AI_DRUG_SUGGEST', 'EMERGENCY_DETECTION'],
    };

    for (const feature of aiFeatures[app]) {
      if (!(appFlags as Record<string, boolean>)[feature]) {
        disabled.push(feature);
      }
    }

    return disabled;
  }

  /**
   * Get list of all enabled features for an app
   */
  getEnabledFeatures(app: AppName): string[] {
    const enabled: string[] = [];
    const appFlags = this.flags[app];

    if (!appFlags || typeof appFlags !== 'object') {
      return enabled;
    }

    for (const [feature, value] of Object.entries(appFlags)) {
      if (value === true) {
        enabled.push(feature);
      }
    }

    return enabled;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════

let instance: FeatureFlagService | null = null;

/**
 * Get singleton instance of FeatureFlagService
 */
export function getFeatureFlagService(customFlags?: Partial<AllFeatureFlags>): FeatureFlagService {
  if (!instance) {
    instance = new FeatureFlagService(customFlags);
  }
  return instance;
}

/**
 * Reset singleton (for testing)
 */
export function resetFeatureFlagService(): void {
  instance = null;
}
