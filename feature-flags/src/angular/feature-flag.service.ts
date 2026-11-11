/**
 * Angular Feature Flag Service - Nov 2026 Release
 * 
 * Injectable service for Angular applications to check feature flags.
 * CRITICAL:  All AI features are DISABLED and must be COMPLETELY HIDDEN.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Injectable, Inject, Optional, signal, computed } from '@angular/core';
import type {
  AllFeatureFlags,
  AppName,
  FeatureName,
  DisabledFeatureResponse,
} from '../types';
import { DEFAULT_FLAGS, DISABLED_MESSAGES, FEATURE_ALTERNATIVES } from '../config';
import { FEATURE_FLAGS_CONFIG, FeatureFlagsConfig } from './feature-flag.provider';

@Injectable({
  providedIn: 'root',
})
export class FeatureFlagService {
  // ─────────────────────────────────────────────────────────────
  //  STATE (using Angular Signals)
  // ─────────────────────────────────────────────────────────────
  
  private readonly _flags = signal<AllFeatureFlags>(DEFAULT_FLAGS);
  private readonly _appName = signal<AppName>('trendbrief');

  /** Read-only signal of current flags */
  readonly flags = this._flags.asReadonly();

  /** Read-only signal of current app */
  readonly appName = this._appName.asReadonly();

  /** Computed signal:  Is global AI enabled? */
  readonly isAIEnabled = computed(() => this._flags().AI_ENABLED);

  /** Computed signal:  Current app's flags */
  readonly appFlags = computed(() => this._flags()[this._appName()]);

  constructor(
    @Optional() @Inject(FEATURE_FLAGS_CONFIG) config?: FeatureFlagsConfig
  ) {
    if (config) {
      this._appName.set(config.app);
      if (config.customFlags) {
        this._flags.set({ ...DEFAULT_FLAGS, ...config.customFlags });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  INITIALIZATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize the service with app-specific configuration
   */
  init(app: AppName, customFlags?: Partial<AllFeatureFlags>): void {
    this._appName.set(app);
    if (customFlags) {
      this._flags.set({ ...DEFAULT_FLAGS, ...customFlags });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  FEATURE CHECKS
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if a feature is enabled for the current app
   */
  isEnabled(feature: string): boolean {
    return this.isFeatureEnabled(this._appName(), feature);
  }

  /**
   * Check if a feature is enabled for a specific app
   */
  isFeatureEnabled(app: AppName, feature: string): boolean {
    const appFlags = this._flags()[app];
    if (!appFlags || typeof appFlags !== 'object') {
      return false;
    }
    return (appFlags as Record<string, boolean>)[feature] ?? false;
  }

  /**
   * Check if a feature is disabled (for conditional rendering)
   */
  isDisabled(feature: string): boolean {
    return !this.isEnabled(feature);
  }

  // ─────────────────────────────────────────────────────────────
  //  DISABLED FEATURE HANDLING
  // ─────────────────────────────────────────────────────────────

  /**
   * Get disabled feature response for display
   */
  getDisabledResponse(feature: FeatureName): DisabledFeatureResponse {
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

  /**
   * Get alternatives for a disabled feature
   */
  getAlternatives(feature: FeatureName): Array<{ icon: string; text: string; link: string }> {
    return FEATURE_ALTERNATIVES[feature] || [];
  }

  // ─────────────────────────────────────────────────────────────
  //  CONVENIENCE METHODS - Per App
  // ─────────────────────────────────────────────────────────────

  // TrendBrief checks
  readonly trendbrief = {
    canSummarizeUrl: () => this.isFeatureEnabled('trendbrief', 'SUMMARIZE_URL'),
    canGenerateBriefing: () => this.isFeatureEnabled('trendbrief', 'BRIEFING'),
    canUseTTS: () => this.isFeatureEnabled('trendbrief', 'TTS'),
    canSearch: () => this.isFeatureEnabled('trendbrief', 'SEARCH'),
    canBrowseTopics: () => this.isFeatureEnabled('trendbrief', 'BROWSE_TOPICS'),
    canViewBreakingNews: () => this.isFeatureEnabled('trendbrief', 'BREAKING_NEWS'),
    canViewTrending: () => this.isFeatureEnabled('trendbrief', 'TRENDING'),
  };

  // SmartBuy checks
  readonly smartbuy = {
    canUseAIAssistant: () => this.isFeatureEnabled('smartbuy', 'AI_SHOPPING_ASSISTANT'),
    canUseRealtimeReviewSummary: () => this.isFeatureEnabled('smartbuy', 'AI_REVIEW_SUMMARY_REALTIME'),
    canSearch: () => this.isFeatureEnabled('smartbuy', 'SEARCH'),
    canComparePrices: () => this.isFeatureEnabled('smartbuy', 'PRICE_COMPARISON'),
    canViewFlashSales: () => this.isFeatureEnabled('smartbuy', 'FLASH_SALES'),
    canViewPrecomputedSimilar: () => this.isFeatureEnabled('smartbuy', 'PRECOMPUTED_SIMILAR'),
    canViewPrecomputedReviewSummary: () => this.isFeatureEnabled('smartbuy', 'PRECOMPUTED_REVIEW_SUMMARY'),
  };

  // FinTax checks
  readonly fintax = {
    canUseAITaxAdvisor: () => this.isFeatureEnabled('fintax', 'AI_TAX_ADVISOR'),
    canUseAIClassification: () => this.isFeatureEnabled('fintax', 'AI_CLASSIFICATION'),
    canUseMLAnomaly: () => this.isFeatureEnabled('fintax', 'ML_ANOMALY'),
    canUsePITCalculator: () => this.isFeatureEnabled('fintax', 'PIT_CALCULATOR'),
    canManageTransactions: () => this.isFeatureEnabled('fintax', 'TRANSACTION_MANAGEMENT'),
    canUseRuleBasedClassify: () => this.isFeatureEnabled('fintax', 'RULE_BASED_CLASSIFY'),
    canUseRuleBasedAnomaly: () => this.isFeatureEnabled('fintax', 'RULE_BASED_ANOMALY'),
    canViewStaticFAQ: () => this.isFeatureEnabled('fintax', 'STATIC_FAQ'),
    canViewStaticTips: () => this.isFeatureEnabled('fintax', 'STATIC_TIPS'),
  };

  // DoctorCar checks
  readonly doctorcar = {
    canUseAIDiagnosis: () => this.isFeatureEnabled('doctorcar', 'AI_DIAGNOSIS'),
    canUseImageAnalysis: () => this.isFeatureEnabled('doctorcar', 'IMAGE_ANALYSIS'),
    canUseAIQuickFAQ: () => this.isFeatureEnabled('doctorcar', 'AI_QUICK_FAQ'),
    canUseDTCDatabase: () => this.isFeatureEnabled('doctorcar', 'DTC_DATABASE'),
    canViewMaintenanceSchedule: () => this.isFeatureEnabled('doctorcar', 'MAINTENANCE_SCHEDULE'),
    canViewArticles: () => this.isFeatureEnabled('doctorcar', 'ARTICLES'),
    canViewGarageDirectory: () => this.isFeatureEnabled('doctorcar', 'GARAGE_DIRECTORY'),
  };

  // CareMate checks
  readonly caremate = {
    canUseAISymptomCheck: () => this.isFeatureEnabled('caremate', 'AI_SYMPTOM_CHECK'),
    canUseAIDrugSuggest: () => this.isFeatureEnabled('caremate', 'AI_DRUG_SUGGEST'),
    canUseEmergencyDetection: () => this.isFeatureEnabled('caremate', 'EMERGENCY_DETECTION'),
    canUseDrugDatabase: () => this.isFeatureEnabled('caremate', 'DRUG_DATABASE'),
    canViewPharmacyDirectory: () => this.isFeatureEnabled('caremate', 'PHARMACY_DIRECTORY'),
    canViewHealthArticles: () => this.isFeatureEnabled('caremate', 'HEALTH_ARTICLES'),
    canViewDrugPrices: () => this.isFeatureEnabled('caremate', 'DRUG_PRICES'),
    showMedicalDisclaimer: () => this.isFeatureEnabled('caremate', 'SHOW_MEDICAL_DISCLAIMER'),
    showEmergencyInfo: () => this.isFeatureEnabled('caremate', 'SHOW_EMERGENCY_INFO'),
  };

  // ─────────────────────────────────────────────────────────────
  //  UTILITY METHODS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get all enabled features for current app
   */
  getEnabledFeatures(): string[] {
    const app = this._appName();
    const appFlags = this._flags()[app];
    const enabled: string[] = [];

    if (appFlags && typeof appFlags === 'object') {
      for (const [feature, value] of Object.entries(appFlags)) {
        if (value === true) {
          enabled.push(feature);
        }
      }
    }

    return enabled;
  }

  /**
   * Get all disabled AI features for current app
   */
  getDisabledAIFeatures(): string[] {
    const app = this._appName();
    const appFlags = this._flags()[app];
    const disabled: string[] = [];

    const aiFeatures: Record<AppName, string[]> = {
      trendbrief: ['SUMMARIZE_URL', 'BRIEFING', 'TTS'],
      smartbuy: ['AI_SHOPPING_ASSISTANT', 'AI_REVIEW_SUMMARY_REALTIME'],
      fintax: ['AI_TAX_ADVISOR', 'AI_CLASSIFICATION', 'ML_ANOMALY'],
      doctorcar: ['AI_DIAGNOSIS', 'IMAGE_ANALYSIS', 'AI_QUICK_FAQ'],
      caremate: ['AI_SYMPTOM_CHECK', 'AI_DRUG_SUGGEST', 'EMERGENCY_DETECTION'],
    };

    if (appFlags && typeof appFlags === 'object') {
      for (const feature of aiFeatures[app]) {
        if (!(appFlags as Record<string, boolean>)[feature]) {
          disabled.push(feature);
        }
      }
    }

    return disabled;
  }
}
