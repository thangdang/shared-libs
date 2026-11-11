/**
 * Angular Analytics Service - Nov 2026 Release
 * 
 * Injectable service for Google Analytics 4 tracking in Angular apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Injectable, Inject, inject, PLATFORM_ID, NgZone } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import type {
  AnalyticsConfig,
  PageViewParams,
  EventParams,
  UserProperties,
  EcommerceItem,
  ConversionEvent,
} from '../types';
import { ANALYTICS_CONFIG } from './analytics.provider';

// Global gtag type declaration
declare global {
  interface Window {
    dataLayer: unknown[];
    gtag: (...args: unknown[]) => void;
  }
}

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly router = inject(Router);
  private readonly ngZone = inject(NgZone);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);
  
  private initialized = false;
  private userId: string | null = null;

  constructor(@Inject(ANALYTICS_CONFIG) private readonly config: AnalyticsConfig) {
    if (this.isBrowser && this.config.enabled) {
      this.initialize();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  INITIALIZATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Initialize Google Analytics
   */
  private initialize(): void {
    if (this.initialized || !this.isBrowser) return;

    // Load gtag.js script
    this.loadGtagScript();
    
    // Initialize dataLayer
    window.dataLayer = window.dataLayer || [];
    
    // Define gtag function
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer.push(args);
    };
    
    // Configure consent mode
    if (this.config.consentMode) {
      window.gtag('consent', 'default', {
        analytics_storage: this.config.consentMode.analyticsStorage,
        ad_storage: this.config.consentMode.adStorage,
      });
    }
    
    // Initialize GA4
    window.gtag('js', new Date());
    window.gtag('config', this.config.measurementId, {
      debug_mode: this.config.debug,
      send_page_view: false, // We'll handle page views manually
    });
    
    // Set default user properties
    if (this.config.defaultUserProperties) {
      this.setUserProperties(this.config.defaultUserProperties);
    }
    
    // Track route changes
    this.trackRouteChanges();
    
    this.initialized = true;
    
    if (this.config.debug) {
      console.log('[Analytics] Initialized with measurement ID:', this.config.measurementId);
    }
  }

  /**
   * Load gtag.js script dynamically
   */
  private loadGtagScript(): void {
    if (!this.isBrowser) return;
    
    const script = this.document.createElement('script');
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.config.measurementId}`;
    this.document.head.appendChild(script);
  }

  /**
   * Track Angular route changes automatically
   */
  private trackRouteChanges(): void {
    this.ngZone.runOutsideAngular(() => {
      this.router.events.pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd)
      ).subscribe((event) => {
        this.trackPageView({
          page_title: this.document.title,
          page_location: this.document.location.href,
          page_path: event.urlAfterRedirects,
        });
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  PAGE VIEWS
  // ─────────────────────────────────────────────────────────────

  /**
   * Track page view
   */
  trackPageView(params: PageViewParams): void {
    if (!this.canTrack()) return;

    this.gtag('event', 'page_view', {
      page_title: params.page_title,
      page_location: params.page_location,
      page_path: params.page_path,
      page_referrer: params.page_referrer,
      content_group: params.content_group,
      ...this.getCustomParams(params),
    });

    if (this.config.debug) {
      console.log('[Analytics] Page view:', params);
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  EVENTS
  // ─────────────────────────────────────────────────────────────

  /**
   * Track custom event
   */
  trackEvent(eventName: string, params?: EventParams): void {
    if (!this.canTrack()) return;

    this.gtag('event', eventName, {
      event_category: params?.event_category,
      event_label: params?.event_label,
      value: params?.value,
      non_interaction: params?.non_interaction,
      ...this.getCustomParams(params),
    });

    if (this.config.debug) {
      console.log('[Analytics] Event:', eventName, params);
    }
  }

  /**
   * Track click event
   */
  trackClick(label: string, category?: string, value?: number): void {
    this.trackEvent('click', {
      event_category: category || 'engagement',
      event_label: label,
      value,
    });
  }

  /**
   * Track search event
   */
  trackSearch(searchTerm: string, category?: string): void {
    this.trackEvent('search', {
      event_category: category || 'search',
      event_label: searchTerm,
    });
  }

  /**
   * Track share event
   */
  trackShare(method: string, contentType: string, itemId: string): void {
    this.trackEvent('share', {
      event_category: 'engagement',
      event_label: itemId,
      method,
      content_type: contentType,
      item_id: itemId,
    } as EventParams);
  }

  // ─────────────────────────────────────────────────────────────
  //  ECOMMERCE
  // ─────────────────────────────────────────────────────────────

  /**
   * Track view item (product view)
   */
  trackViewItem(item: EcommerceItem): void {
    if (!this.canTrack()) return;

    this.gtag('event', 'view_item', {
      currency: item.currency || 'VND',
      value: item.price,
      items: [this.formatEcommerceItem(item)],
    });
  }

  /**
   * Track view item list (product list view)
   */
  trackViewItemList(listId: string, listName: string, items: EcommerceItem[]): void {
    if (!this.canTrack()) return;

    this.gtag('event', 'view_item_list', {
      item_list_id: listId,
      item_list_name: listName,
      items: items.map((item, index) => this.formatEcommerceItem({ ...item, index })),
    });
  }

  /**
   * Track select item (click on product)
   */
  trackSelectItem(listId: string, listName: string, item: EcommerceItem): void {
    if (!this.canTrack()) return;

    this.gtag('event', 'select_item', {
      item_list_id: listId,
      item_list_name: listName,
      items: [this.formatEcommerceItem(item)],
    });
  }

  /**
   * Format item for ecommerce tracking
   */
  private formatEcommerceItem(item: EcommerceItem): Record<string, unknown> {
    return {
      item_id: item.item_id,
      item_name: item.item_name,
      item_brand: item.item_brand,
      item_category: item.item_category,
      item_variant: item.item_variant,
      price: item.price,
      currency: item.currency || 'VND',
      quantity: item.quantity || 1,
      coupon: item.coupon,
      index: item.index,
      promotion_id: item.promotion_id,
      promotion_name: item.promotion_name,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  CONVERSIONS
  // ─────────────────────────────────────────────────────────────

  /**
   * Track conversion event
   */
  trackConversion(conversion: ConversionEvent): void {
    if (!this.canTrack()) return;

    this.gtag('event', conversion.event, {
      transaction_id: conversion.transaction_id,
      value: conversion.value,
      currency: conversion.currency || 'VND',
      items: conversion.items?.map(i => this.formatEcommerceItem(i)),
      ...conversion,
    });

    if (this.config.debug) {
      console.log('[Analytics] Conversion:', conversion);
    }
  }

  /**
   * Track purchase (premium subscription)
   */
  trackPurchase(
    transactionId: string,
    value: number,
    items: EcommerceItem[],
    currency = 'VND'
  ): void {
    this.trackConversion({
      event: 'purchase',
      transaction_id: transactionId,
      value,
      currency,
      items,
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  USER PROPERTIES
  // ─────────────────────────────────────────────────────────────

  /**
   * Set user ID
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
    
    if (!this.canTrack()) return;

    if (userId) {
      this.gtag('config', this.config.measurementId, { user_id: userId });
    }

    if (this.config.debug) {
      console.log('[Analytics] User ID set:', userId);
    }
  }

  /**
   * Set user properties
   */
  setUserProperties(properties: UserProperties): void {
    if (!this.canTrack()) return;

    this.gtag('set', 'user_properties', properties);

    if (this.config.debug) {
      console.log('[Analytics] User properties:', properties);
    }
  }

  /**
   * Set user type (free/premium)
   */
  setUserType(type: 'free' | 'premium'): void {
    this.setUserProperties({ user_type: type });
  }

  // ─────────────────────────────────────────────────────────────
  //  CONSENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Update consent settings
   */
  updateConsent(analyticsStorage: 'granted' | 'denied', adStorage: 'granted' | 'denied'): void {
    if (!this.isBrowser) return;

    this.gtag('consent', 'update', {
      analytics_storage: analyticsStorage,
      ad_storage: adStorage,
    });

    if (this.config.debug) {
      console.log('[Analytics] Consent updated:', { analyticsStorage, adStorage });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Check if tracking is possible
   */
  private canTrack(): boolean {
    return this.isBrowser && this.config.enabled && this.initialized && typeof window.gtag === 'function';
  }

  /**
   * Call gtag with type safety
   */
  private gtag(command: string, ...args: unknown[]): void {
    if (typeof window.gtag === 'function') {
      window.gtag(command, ...args);
    }
  }

  /**
   * Extract custom parameters from params object
   */
  private getCustomParams(params?: Record<string, unknown>): Record<string, unknown> {
    if (!params) return {};
    
    const { event_category, event_label, value, non_interaction, ...custom } = params;
    return custom;
  }

  /**
   * Get current config
   */
  getConfig(): AnalyticsConfig {
    return this.config;
  }

  /**
   * Check if analytics is enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
}
