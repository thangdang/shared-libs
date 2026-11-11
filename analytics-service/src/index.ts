/**
 * Analytics Service Library - Nov 2026 Release
 * 
 * Shared Google Analytics 4 service for all 5 AI apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 * @version 1.0.0
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export type {
  AnalyticsConfig,
  PageViewParams,
  EventParams,
  UserProperties,
  EcommerceItem,
  ConversionEvent,
  CustomEvent,
  AnalyticsEvent,
} from './types';

// ═══════════════════════════════════════════════════════════════
//  EVENT DEFINITIONS
// ═══════════════════════════════════════════════════════════════

export {
  // Standard Events
  STANDARD_EVENTS,
  
  // App-specific Events
  TRENDBRIEF_EVENTS,
  SMARTBUY_EVENTS,
  FINTAX_EVENTS,
  DOCTORCAR_EVENTS,
  CAREMATE_EVENTS,
  
  // Monetization Events
  MONETIZATION_EVENTS,
  
  // Conversion Events
  CONVERSION_EVENTS,
} from './events';

// ═══════════════════════════════════════════════════════════════
//  DEFAULT CONFIGS
// ═══════════════════════════════════════════════════════════════

export {
  GA4_MEASUREMENT_IDS,
  ANALYTICS_CONFIGS,
  createAnalyticsConfig,
} from './defaults';
