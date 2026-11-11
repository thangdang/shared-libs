/**
 * Angular Environment Config Service - Nov 2026 Release
 * 
 * Injectable service for Angular applications to access environment configuration.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Injectable, Inject, signal, computed } from '@angular/core';
import type { FrontendConfig, AppName, Environment, SEOConfig } from '../types';
import { ENVIRONMENT_CONFIG } from './environment-config.provider';

@Injectable({
  providedIn: 'root',
})
export class EnvironmentConfigService {
  // ─────────────────────────────────────────────────────────────
  //  STATE (using Angular Signals)
  // ─────────────────────────────────────────────────────────────
  
  private readonly _config = signal<FrontendConfig | null>(null);
  
  /** Read-only signal of current config */
  readonly config = this._config.asReadonly();
  
  /** Computed signal:  Current app name */
  readonly appName = computed(() => this._config()?.appName ?? 'trendbrief');
  
  /** Computed signal:  Current environment */
  readonly environment = computed(() => this._config()?.environment ?? 'development');
  
  /** Computed signal:  Is production? */
  readonly isProduction = computed(() => this._config()?.environment === 'production');
  
  /** Computed signal:  Is debug mode? */
  readonly isDebug = computed(() => this._config()?.debug ?? false);
  
  /** Computed signal:  API URL */
  readonly apiUrl = computed(() => this._config()?.apiUrl ?? '');
  
  /** Computed signal:  Base URL */
  readonly baseUrl = computed(() => this._config()?.baseUrl ?? '');

  constructor(
    @Inject(ENVIRONMENT_CONFIG) config: FrontendConfig
  ) {
    this._config.set(config);
  }

  // ─────────────────────────────────────────────────────────────
  //  GETTERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Get full configuration
   */
  getConfig(): FrontendConfig | null {
    return this._config();
  }

  /**
   * Get app name
   */
  getAppName(): AppName {
    return this.appName();
  }

  /**
   * Get environment
   */
  getEnvironment(): Environment {
    return this.environment();
  }

  /**
   * Get API URL
   */
  getApiUrl(): string {
    return this.apiUrl();
  }

  /**
   * Get base URL
   */
  getBaseUrl(): string {
    return this.baseUrl();
  }

  /**
   * Get app version
   */
  getVersion(): string {
    return this._config()?.version ?? '1.0.0';
  }

  // ─────────────────────────────────────────────────────────────
  //  MONETIZATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Is AdSense enabled?
   */
  isAdsenseEnabled(): boolean {
    return this._config()?.monetization.adsenseEnabled ?? false;
  }

  /**
   * Get AdSense client ID
   */
  getAdsenseClientId(): string {
    return this._config()?.monetization.adsenseClientId ?? '';
  }

  /**
   * Is premium subscription enabled?
   */
  isPremiumEnabled(): boolean {
    return this._config()?.monetization.premiumEnabled ?? false;
  }

  /**
   * Get premium price in VND
   */
  getPremiumPriceVND(): number {
    return this._config()?.monetization.premiumPriceVND ?? 99000;
  }

  /**
   * Format premium price for display
   */
  getFormattedPremiumPrice(): string {
    const price = this.getPremiumPriceVND();
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0,
    }).format(price);
  }

  // ─────────────────────────────────────────────────────────────
  //  ANALYTICS
  // ─────────────────────────────────────────────────────────────

  /**
   * Is analytics enabled?
   */
  isAnalyticsEnabled(): boolean {
    return this._config()?.analytics.enabled ?? false;
  }

  /**
   * Get GA4 measurement ID
   */
  getGA4MeasurementId(): string {
    return this._config()?.analytics.ga4MeasurementId ?? '';
  }

  /**
   * Is analytics debug mode enabled?
   */
  isAnalyticsDebug(): boolean {
    return this._config()?.analytics.debug ?? false;
  }

  // ─────────────────────────────────────────────────────────────
  //  SEO
  // ─────────────────────────────────────────────────────────────

  /**
   * Get SEO configuration
   */
  getSEOConfig(): SEOConfig | null {
    return this._config()?.seo ?? null;
  }

  /**
   * Get default page title
   */
  getDefaultTitle(): string {
    return this._config()?.seo.defaultTitle ?? '';
  }

  /**
   * Get title suffix
   */
  getTitleSuffix(): string {
    return this._config()?.seo.titleSuffix ?? '';
  }

  /**
   * Build full page title
   */
  buildPageTitle(pageTitle?: string): string {
    const suffix = this.getTitleSuffix();
    if (pageTitle) {
      return `${pageTitle}${suffix}`;
    }
    return this.getDefaultTitle();
  }

  /**
   * Get canonical base URL
   */
  getCanonicalBase(): string {
    return this._config()?.seo.canonicalBase ?? '';
  }

  /**
   * Build canonical URL for a path
   */
  buildCanonicalUrl(path: string): string {
    const base = this.getCanonicalBase();
    return `${base}${path.startsWith('/') ? path : '/' + path}`;
  }

  /**
   * Get default meta description
   */
  getDefaultDescription(): string {
    return this._config()?.seo.defaultDescription ?? '';
  }

  /**
   * Get default meta keywords
   */
  getDefaultKeywords(): string {
    return this._config()?.seo.defaultKeywords?.join(', ') ?? '';
  }

  /**
   * Get default OG image
   */
  getDefaultOgImage(): string {
    const ogImage = this._config()?.seo.defaultOgImage ?? '';
    if (ogImage.startsWith('http')) {
      return ogImage;
    }
    return `${this.getBaseUrl()}${ogImage}`;
  }

  // ─────────────────────────────────────────────────────────────
  //  UTILITY
  // ─────────────────────────────────────────────────────────────

  /**
   * Build full API endpoint URL
   */
  buildApiUrl(endpoint: string): string {
    const baseApi = this.getApiUrl();
    return `${baseApi}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
  }

  /**
   * Check if environment is development
   */
  isDevelopment(): boolean {
    return this.environment() === 'development';
  }

  /**
   * Check if environment is staging
   */
  isStaging(): boolean {
    return this.environment() === 'staging';
  }
}
