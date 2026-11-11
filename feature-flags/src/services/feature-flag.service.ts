/**
 * SHARED-001:  Shared Feature Flag Service
 * Central service for managing feature flags across all apps
 */

import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, catchError, of, tap } from 'rxjs';

export interface FeatureFlags {
  // AI Features (all disabled for Nov 2026 launch)
  ai_summarize_url: boolean;
  ai_briefing: boolean;
  ai_tts: boolean;
  ai_query: boolean;
  ai_query_stream: boolean;
  ai_query_voice: boolean;
  ai_chat: boolean;
  ai_chat_stream: boolean;
  ai_tax_advisor: boolean;
  ai_diagnosis_analyze: boolean;
  ai_diagnosis_quick: boolean;
  ai_image_analysis: boolean;
  ai_check_symptoms: boolean;
  ai_suggest_drugs: boolean;
  ai_emergency_detection: boolean;
  
  // Non-AI Features (all enabled for Nov 2026 launch)
  rule_based_classifier: boolean;
  z_score_anomaly: boolean;
  tesseract_ocr: boolean;
  dtc_database: boolean;
  maintenance_schedules: boolean;
  drug_database: boolean;
  health_articles: boolean;
  
  // Premium Features
  premium_subscription: boolean;
  affiliate_links: boolean;
  ad_free: boolean;
  
  [key: string]: boolean;
}

// Default flags for Nov 2026 launch (AI disabled, non-AI enabled)
export const DEFAULT_FEATURE_FLAGS: FeatureFlags = {
  // AI Features - ALL DISABLED
  ai_summarize_url: false,
  ai_briefing: false,
  ai_tts: false,
  ai_query: false,
  ai_query_stream: false,
  ai_query_voice: false,
  ai_chat: false,
  ai_chat_stream: false,
  ai_tax_advisor: false,
  ai_diagnosis_analyze: false,
  ai_diagnosis_quick: false,
  ai_image_analysis: false,
  ai_check_symptoms: false,
  ai_suggest_drugs: false,
  ai_emergency_detection: false,
  
  // Non-AI Features - ALL ENABLED
  rule_based_classifier: true,
  z_score_anomaly: true,
  tesseract_ocr: true,
  dtc_database: true,
  maintenance_schedules: true,
  drug_database: true,
  health_articles: true,
  
  // Premium Features - ENABLED
  premium_subscription: true,
  affiliate_links: true,
  ad_free: true
};

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {
  // Using signals for Angular 17+
  private flagsSignal = signal<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  private loadedSignal = signal<boolean>(false);
  
  // Legacy RxJS support
  private flagsSubject = new BehaviorSubject<FeatureFlags>(DEFAULT_FEATURE_FLAGS);
  public readonly flags$ = this.flagsSubject.asObservable();
  public readonly flagChanges$ = this.flagsSubject.asObservable();
  
  // Computed signals for common checks
  public readonly anyAiEnabled = computed(() => {
    const flags = this.flagsSignal();
    return Object.keys(flags)
      .filter(key => key.startsWith('ai_'))
      .some(key => flags[key]);
  });
  
  public readonly allAiDisabled = computed(() => !this.anyAiEnabled());

  constructor(private http: HttpClient) {}

  /**
   * Load feature flags from server
   */
  loadFlags(apiUrl?: string): Observable<FeatureFlags> {
    const url = apiUrl || '/api/features';
    
    return this.http.get<FeatureFlags>(url).pipe(
      tap(flags => {
        this.setFlags({ ...DEFAULT_FEATURE_FLAGS, ...flags });
        this.loadedSignal.set(true);
      }),
      catchError(error => {
        console.warn('[FeatureFlags] Failed to load from server, using defaults:', error);
        this.loadedSignal.set(true);
        return of(DEFAULT_FEATURE_FLAGS);
      })
    );
  }

  /**
   * Check if a feature is enabled
   */
  isEnabled(featureName: string): boolean {
    const flags = this.flagsSignal();
    return flags[featureName] ?? false;
  }

  /**
   * Check if any of the features is enabled
   */
  isAnyEnabled(featureNames: string[]): boolean {
    return featureNames.some(name => this.isEnabled(name));
  }

  /**
   * Check if all features are enabled
   */
  areAllEnabled(featureNames: string[]): boolean {
    return featureNames.every(name => this.isEnabled(name));
  }

  /**
   * Get all current flags
   */
  getFlags(): FeatureFlags {
    return this.flagsSignal();
  }

  /**
   * Set flags (for testing or manual override)
   */
  setFlags(flags: Partial<FeatureFlags>): void {
    const newFlags = { ...this.flagsSignal(), ...flags };
    this.flagsSignal.set(newFlags);
    this.flagsSubject.next(newFlags);
  }

  /**
   * Enable a specific feature
   */
  enable(featureName: string): void {
    this.setFlags({ [featureName]: true });
  }

  /**
   * Disable a specific feature
   */
  disable(featureName: string): void {
    this.setFlags({ [featureName]: false });
  }

  /**
   * Toggle a feature
   */
  toggle(featureName: string): void {
    this.setFlags({ [featureName]: !this.isEnabled(featureName) });
  }

  /**
   * Reset to default flags
   */
  reset(): void {
    this.setFlags(DEFAULT_FEATURE_FLAGS);
  }

  /**
   * Check if flags have been loaded
   */
  isLoaded(): boolean {
    return this.loadedSignal();
  }

  /**
   * Get list of all disabled AI features
   */
  getDisabledAiFeatures(): string[] {
    const flags = this.flagsSignal();
    return Object.keys(flags)
      .filter(key => key.startsWith('ai_') && !flags[key]);
  }

  /**
   * Get list of all enabled non-AI features
   */
  getEnabledNonAiFeatures(): string[] {
    const flags = this.flagsSignal();
    return Object.keys(flags)
      .filter(key => !key.startsWith('ai_') && flags[key]);
  }
}

// Export for Node.js backend usage
export function createNodeFeatureFlagService(config?: Partial<FeatureFlags>) {
  const flags = { ...DEFAULT_FEATURE_FLAGS, ...config };
  
  return {
    isEnabled(featureName: string): boolean {
      return flags[featureName] ?? false;
    },
    
    getFlags(): FeatureFlags {
      return { ...flags };
    },
    
    setFlag(featureName: string, value: boolean): void {
      flags[featureName] = value;
    }
  };
}
