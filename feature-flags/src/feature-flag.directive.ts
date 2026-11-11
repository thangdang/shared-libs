/**
 * Angular Feature Flag Directive
 * Task: SHARED-003
 * 
 * Structural directive to completely HIDE elements
 * when feature is disabled - NO "Coming Soon" placeholders
 * 
 * Usage:
 *   <button *featureFlag="'trendbrief.ai_summarize_url'">
 *     Summarize URL
 *   </button>
 * 
 * The button is completely removed from DOM when disabled
 */

import { 
  Directive, 
  Input, 
  TemplateRef, 
  ViewContainerRef,
  OnInit,
  OnDestroy,
  Injectable
} from '@angular/core';
import { FeaturePath, FeatureFlags, AppId } from './types';

/**
 * Angular Injectable Feature Flag Service
 * Wrapper around the core service for Angular DI
 */
@Injectable({
  providedIn: 'root'
})
export class AngularFeatureFlagService {
  private flags: FeatureFlags | null = null;

  /**
   * Initialize with flags (call from APP_INITIALIZER)
   */
  init(flags: FeatureFlags): void {
    this.flags = flags;
  }

  /**
   * Load flags from environment
   */
  loadFromEnv(env: Record<string, string | undefined>): void {
    // Import default flags
    const defaultFlags = this.getDefaultFlags();
    this.flags = { ...defaultFlags };

    // Override from environment
    for (const [key, value] of Object.entries(env)) {
      if (!key.startsWith('FEATURE_') || !value) continue;
      
      const parts = key.replace('FEATURE_', '').toLowerCase().split('_');
      if (parts.length < 2) continue;
      
      const app = parts[0] as AppId;
      const feature = parts.slice(1).join('_');
      
      if (this.flags[app] && feature in this.flags[app]) {
        (this.flags[app] as any)[feature] = value === 'true';
      }
    }

    // Safety: CareMate disclaimer always true
    if (this.flags.caremate) {
      this.flags.caremate.disclaimer = true;
    }
  }

  /**
   * Check if feature is enabled
   */
  isEnabled(path: FeaturePath): boolean {
    if (!this.flags) {
      console.warn('[FeatureFlags] Service not initialized');
      return false;
    }

    const [app, feature] = path.split('.');
    if (!app || !feature) return false;

    const appFlags = this.flags[app as AppId];
    if (!appFlags) return false;

    return (appFlags as any)[feature] === true;
  }

  /**
   * Get all flags
   */
  getFlags(): FeatureFlags | null {
    return this.flags;
  }

  private getDefaultFlags(): FeatureFlags {
    return {
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
        disclaimer: true
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
  }
}

/**
 * Structural Directive for Feature Flags
 * 
 * IMPORTANT: This completely HIDES the element when disabled
 * NO "Coming Soon" placeholder - the element simply doesn't exist
 */
@Directive({
  selector: '[featureFlag]',
  standalone: true
})
export class FeatureFlagDirective implements OnInit, OnDestroy {
  private hasView = false;
  private featurePath: FeaturePath = '';

  @Input()
  set featureFlag(path: FeaturePath) {
    this.featurePath = path;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private featureFlagService: AngularFeatureFlagService
  ) {}

  ngOnInit(): void {
    this.updateView();
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const isEnabled = this.featureFlagService.isEnabled(this.featurePath);

    if (isEnabled && !this.hasView) {
      // Feature enabled: show element
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (!isEnabled && this.hasView) {
      // Feature disabled: completely remove element
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}

/**
 * Inverse directive - show when feature is DISABLED
 * Useful for showing alternatives
 * 
 * Usage:
 *   <div *featureFlagDisabled="'trendbrief.ai_summarize_url'">
 *     Browse headlines instead
 *   </div>
 */
@Directive({
  selector: '[featureFlagDisabled]',
  standalone: true
})
export class FeatureFlagDisabledDirective implements OnInit, OnDestroy {
  private hasView = false;
  private featurePath: FeaturePath = '';

  @Input()
  set featureFlagDisabled(path: FeaturePath) {
    this.featurePath = path;
    this.updateView();
  }

  constructor(
    private templateRef: TemplateRef<any>,
    private viewContainer: ViewContainerRef,
    private featureFlagService: AngularFeatureFlagService
  ) {}

  ngOnInit(): void {
    this.updateView();
  }

  ngOnDestroy(): void {
    this.viewContainer.clear();
  }

  private updateView(): void {
    const isEnabled = this.featureFlagService.isEnabled(this.featurePath);

    if (!isEnabled && !this.hasView) {
      // Feature disabled: show alternative
      this.viewContainer.createEmbeddedView(this.templateRef);
      this.hasView = true;
    } else if (isEnabled && this.hasView) {
      // Feature enabled: hide alternative
      this.viewContainer.clear();
      this.hasView = false;
    }
  }
}
