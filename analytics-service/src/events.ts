/**
 * Analytics Event Definitions - Nov 2026 Release
 * 
 * Predefined event names for all 5 AI apps.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  STANDARD GA4 EVENTS
// ═══════════════════════════════════════════════════════════════

export const STANDARD_EVENTS = {
  // Engagement
  PAGE_VIEW: 'page_view',
  SCROLL: 'scroll',
  CLICK: 'click',
  VIEW_SEARCH_RESULTS: 'view_search_results',
  SEARCH: 'search',
  
  // Content
  SELECT_CONTENT: 'select_content',
  SHARE: 'share',
  
  // User
  LOGIN: 'login',
  SIGN_UP: 'sign_up',
  
  // Ecommerce
  VIEW_ITEM: 'view_item',
  VIEW_ITEM_LIST: 'view_item_list',
  SELECT_ITEM: 'select_item',
  ADD_TO_WISHLIST: 'add_to_wishlist',
  ADD_TO_CART: 'add_to_cart',
  REMOVE_FROM_CART: 'remove_from_cart',
  VIEW_CART: 'view_cart',
  BEGIN_CHECKOUT: 'begin_checkout',
  PURCHASE: 'purchase',
  
  // Errors
  EXCEPTION: 'exception',
} as const;

// ═══════════════════════════════════════════════════════════════
//  TRENDBRIEF AI EVENTS
// ═══════════════════════════════════════════════════════════════

export const TRENDBRIEF_EVENTS = {
  // News reading
  READ_ARTICLE: 'tb_read_article',
  READ_TIME: 'tb_read_time',
  ARTICLE_SCROLL_DEPTH: 'tb_article_scroll_depth',
  
  // Topics
  VIEW_TOPIC: 'tb_view_topic',
  FOLLOW_TOPIC: 'tb_follow_topic',
  UNFOLLOW_TOPIC: 'tb_unfollow_topic',
  
  // Search
  SEARCH_NEWS: 'tb_search_news',
  FILTER_NEWS: 'tb_filter_news',
  
  // Engagement
  SAVE_ARTICLE: 'tb_save_article',
  SHARE_ARTICLE: 'tb_share_article',
  
  // Breaking news
  VIEW_BREAKING: 'tb_view_breaking',
  CLICK_BREAKING: 'tb_click_breaking',
  
  // Trending
  VIEW_TRENDING: 'tb_view_trending',
} as const;

// ═══════════════════════════════════════════════════════════════
//  SMARTBUY AI EVENTS
// ═══════════════════════════════════════════════════════════════

export const SMARTBUY_EVENTS = {
  // Product search
  SEARCH_PRODUCT: 'sb_search_product',
  VIEW_PRODUCT: 'sb_view_product',
  
  // Price comparison
  COMPARE_PRICES: 'sb_compare_prices',
  VIEW_PRICE_HISTORY: 'sb_view_price_history',
  
  // Click-through
  CLICK_TO_SHOPEE: 'sb_click_shopee',
  CLICK_TO_LAZADA: 'sb_click_lazada',
  CLICK_TO_TIKI: 'sb_click_tiki',
  CLICK_TO_EXTERNAL: 'sb_click_external',
  
  // Deals
  VIEW_FLASH_SALE: 'sb_view_flash_sale',
  VIEW_DEAL: 'sb_view_deal',
  
  // Reviews
  VIEW_REVIEWS: 'sb_view_reviews',
  
  // Wishlist
  ADD_TO_WISHLIST: 'sb_add_wishlist',
  REMOVE_WISHLIST: 'sb_remove_wishlist',
  
  // Price alert
  SET_PRICE_ALERT: 'sb_set_price_alert',
} as const;

// ═══════════════════════════════════════════════════════════════
//  FINTAX AI EVENTS
// ═══════════════════════════════════════════════════════════════

export const FINTAX_EVENTS = {
  // Tax calculator
  CALCULATE_TAX: 'ft_calculate_tax',
  SAVE_TAX_RESULT: 'ft_save_tax_result',
  SHARE_TAX_RESULT: 'ft_share_tax_result',
  
  // Transactions
  ADD_TRANSACTION: 'ft_add_transaction',
  EDIT_TRANSACTION: 'ft_edit_transaction',
  DELETE_TRANSACTION: 'ft_delete_transaction',
  IMPORT_TRANSACTIONS: 'ft_import_transactions',
  
  // Categories
  CLASSIFY_TRANSACTION: 'ft_classify_transaction',
  CREATE_CATEGORY: 'ft_create_category',
  
  // Reports
  VIEW_REPORT: 'ft_view_report',
  EXPORT_REPORT: 'ft_export_report',
  
  // Tips/FAQ
  VIEW_TIP: 'ft_view_tip',
  VIEW_FAQ: 'ft_view_faq',
  
  // Settings
  UPDATE_PROFILE: 'ft_update_profile',
  SET_BUDGET: 'ft_set_budget',
} as const;

// ═══════════════════════════════════════════════════════════════
//  DOCTORCAR AI EVENTS
// ═══════════════════════════════════════════════════════════════

export const DOCTORCAR_EVENTS = {
  // DTC lookup
  SEARCH_DTC: 'dc_search_dtc',
  VIEW_DTC_DETAIL: 'dc_view_dtc_detail',
  
  // Vehicle
  ADD_VEHICLE: 'dc_add_vehicle',
  VIEW_VEHICLE: 'dc_view_vehicle',
  DELETE_VEHICLE: 'dc_delete_vehicle',
  
  // Maintenance
  VIEW_MAINTENANCE: 'dc_view_maintenance',
  ADD_MAINTENANCE_LOG: 'dc_add_maintenance_log',
  SET_REMINDER: 'dc_set_reminder',
  
  // Articles
  VIEW_ARTICLE: 'dc_view_article',
  SHARE_ARTICLE: 'dc_share_article',
  
  // Garage
  SEARCH_GARAGE: 'dc_search_garage',
  VIEW_GARAGE: 'dc_view_garage',
  CALL_GARAGE: 'dc_call_garage',
  GET_DIRECTIONS: 'dc_get_directions',
} as const;

// ═══════════════════════════════════════════════════════════════
//  CAREMATE AI EVENTS
// ═══════════════════════════════════════════════════════════════

export const CAREMATE_EVENTS = {
  // Drug database
  SEARCH_DRUG: 'cm_search_drug',
  VIEW_DRUG: 'cm_view_drug',
  VIEW_DRUG_INTERACTIONS: 'cm_view_interactions',
  
  // Pharmacy
  SEARCH_PHARMACY: 'cm_search_pharmacy',
  VIEW_PHARMACY: 'cm_view_pharmacy',
  CALL_PHARMACY: 'cm_call_pharmacy',
  GET_DIRECTIONS: 'cm_get_directions',
  
  // Prices
  VIEW_DRUG_PRICES: 'cm_view_drug_prices',
  COMPARE_DRUG_PRICES: 'cm_compare_drug_prices',
  
  // Health articles
  VIEW_HEALTH_ARTICLE: 'cm_view_health_article',
  SHARE_HEALTH_ARTICLE: 'cm_share_health_article',
  
  // Emergency
  VIEW_EMERGENCY_INFO: 'cm_view_emergency_info',
  CALL_EMERGENCY: 'cm_call_emergency',
} as const;

// ═══════════════════════════════════════════════════════════════
//  MONETIZATION EVENTS
// ═══════════════════════════════════════════════════════════════

export const MONETIZATION_EVENTS = {
  // Ads
  AD_IMPRESSION: 'ad_impression',
  AD_CLICK: 'ad_click',
  
  // Premium
  VIEW_PREMIUM_PAGE: 'view_premium_page',
  START_PREMIUM_TRIAL: 'start_premium_trial',
  PREMIUM_PURCHASE_START: 'premium_purchase_start',
  PREMIUM_PURCHASE_SUCCESS: 'premium_purchase_success',
  PREMIUM_PURCHASE_FAIL: 'premium_purchase_fail',
  PREMIUM_CANCEL: 'premium_cancel',
  PREMIUM_RENEW: 'premium_renew',
} as const;

// ═══════════════════════════════════════════════════════════════
//  CONVERSION EVENTS (for GA4 conversion tracking)
// ═══════════════════════════════════════════════════════════════

export const CONVERSION_EVENTS = {
  // User acquisition
  SIGN_UP: 'sign_up',
  
  // Monetization
  PURCHASE: 'purchase',
  PREMIUM_SUBSCRIPTION: 'premium_subscription',
  
  // Engagement goals
  READ_5_ARTICLES: 'read_5_articles',
  COMPARE_5_PRODUCTS: 'compare_5_products',
  CALCULATE_TAX: 'calculate_tax_complete',
  FIND_GARAGE: 'find_garage_complete',
  FIND_PHARMACY: 'find_pharmacy_complete',
  
  // Referral
  REFERRAL_SENT: 'referral_sent',
  REFERRAL_CONVERTED: 'referral_converted',
} as const;
