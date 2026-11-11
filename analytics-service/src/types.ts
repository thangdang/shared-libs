/**
 * Analytics Service Types - Nov 2026 Release
 * 
 * Types for Google Analytics 4 tracking.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface AnalyticsConfig {
  /** GA4 Measurement ID (G-XXXXXXXXXX) */
  measurementId: string;
  
  /** Enable analytics */
  enabled: boolean;
  
  /** Enable debug mode */
  debug: boolean;
  
  /** App name for custom dimension */
  appName: string;
  
  /** App version for custom dimension */
  appVersion: string;
  
  /** Custom dimensions mapping */
  customDimensions?: Record<string, string>;
  
  /** User properties to set */
  defaultUserProperties?: Record<string, string | number | boolean>;
  
  /** Consent mode settings */
  consentMode?: {
    analyticsStorage: 'granted' | 'denied';
    adStorage: 'granted' | 'denied';
  };
}

// ═══════════════════════════════════════════════════════════════
//  EVENT PARAMETERS
// ═══════════════════════════════════════════════════════════════

export interface PageViewParams {
  /** Page title */
  page_title: string;
  
  /** Page location (full URL) */
  page_location: string;
  
  /** Page path (without domain) */
  page_path?: string;
  
  /** Page referrer */
  page_referrer?: string;
  
  /** Content group */
  content_group?: string;
  
  /** Additional custom parameters */
  [key: string]: string | number | boolean | undefined;
}

export interface EventParams {
  /** Event category */
  event_category?: string;
  
  /** Event label */
  event_label?: string;
  
  /** Event value */
  value?: number;
  
  /** Non-interaction flag */
  non_interaction?: boolean;
  
  /** Additional custom parameters */
  [key: string]: string | number | boolean | undefined;
}

// ═══════════════════════════════════════════════════════════════
//  USER PROPERTIES
// ═══════════════════════════════════════════════════════════════

export interface UserProperties {
  /** User type:  free, premium */
  user_type?: 'free' | 'premium';
  
  /** Account creation date */
  account_created?: string;
  
  /** Premium subscription date */
  premium_since?: string;
  
  /** User's preferred language */
  preferred_language?: string;
  
  /** User's city (for geo targeting) */
  city?: string;
  
  /** Additional custom properties */
  [key: string]: string | number | boolean | undefined;
}

// ═══════════════════════════════════════════════════════════════
//  ECOMMERCE
// ═══════════════════════════════════════════════════════════════

export interface EcommerceItem {
  /** Item ID */
  item_id: string;
  
  /** Item name */
  item_name: string;
  
  /** Item brand */
  item_brand?: string;
  
  /** Item category */
  item_category?: string;
  
  /** Item variant */
  item_variant?: string;
  
  /** Price */
  price?: number;
  
  /** Currency */
  currency?: string;
  
  /** Quantity */
  quantity?: number;
  
  /** Coupon */
  coupon?: string;
  
  /** Index position */
  index?: number;
  
  /** Promotion ID */
  promotion_id?: string;
  
  /** Promotion name */
  promotion_name?: string;
}

// ═══════════════════════════════════════════════════════════════
//  CONVERSION EVENTS
// ═══════════════════════════════════════════════════════════════

export interface ConversionEvent {
  /** Conversion event name */
  event: string;
  
  /** Transaction ID */
  transaction_id?: string;
  
  /** Revenue value */
  value?: number;
  
  /** Currency */
  currency?: string;
  
  /** Items */
  items?: EcommerceItem[];
  
  /** Additional parameters */
  [key: string]: unknown;
}

// ═══════════════════════════════════════════════════════════════
//  CUSTOM EVENTS
// ═══════════════════════════════════════════════════════════════

export interface CustomEvent {
  /** Event name */
  name: string;
  
  /** Event parameters */
  params?: EventParams;
}

// ═══════════════════════════════════════════════════════════════
//  ANALYTICS EVENT TYPE (union)
// ═══════════════════════════════════════════════════════════════

export type AnalyticsEvent =
  | { type: 'page_view'; params: PageViewParams }
  | { type: 'event'; name: string; params?: EventParams }
  | { type: 'conversion'; event: ConversionEvent }
  | { type: 'user_properties'; properties: UserProperties };
