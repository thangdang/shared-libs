/**
 * Monetization Service Types - Nov 2026 Release
 * 
 * Types for payment, subscription, and ads.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface MonetizationConfig {
  /** App identifier */
  app: AppName;
  
  /** AdSense configuration */
  adsense: {
    enabled: boolean;
    clientId: string;
    slots: Record<string, string>;
  };
  
  /** Premium subscription configuration */
  premium: {
    enabled: boolean;
    priceVND: number;
    trialDays: number;
  };
  
  /** MoMo payment configuration (backend only) */
  momo?: {
    partnerCode: string;
    accessKey: string;
    secretKey: string;
    endpoint: string;
    ipnUrl: string;
    redirectUrl: string;
  };
}

export type AppName = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

// ═══════════════════════════════════════════════════════════════
//  PREMIUM SUBSCRIPTION
// ═══════════════════════════════════════════════════════════════

export interface PremiumSubscription {
  /** User ID */
  userId: string;
  
  /** App name */
  app: AppName;
  
  /** Status */
  status: SubscriptionStatus;
  
  /** Start date */
  startDate: Date;
  
  /** End date (null if lifetime) */
  endDate: Date | null;
  
  /** Payment method */
  paymentMethod: PaymentMethod;
  
  /** Original transaction ID */
  transactionId: string;
  
  /** Auto-renew enabled */
  autoRenew: boolean;
  
  /** Created at */
  createdAt: Date;
  
  /** Updated at */
  updatedAt: Date;
}

export type SubscriptionStatus = 
  | 'active'
  | 'trial'
  | 'expired'
  | 'cancelled'
  | 'pending';

export type PaymentMethod = 'momo' | 'bank_transfer' | 'promo_code' | 'free_trial';

// ═══════════════════════════════════════════════════════════════
//  MOMO PAYMENT
// ═══════════════════════════════════════════════════════════════

export interface MoMoPaymentRequest {
  /** Order ID (unique) */
  orderId: string;
  
  /** Amount in VND */
  amount: number;
  
  /** Order description */
  orderInfo: string;
  
  /** Extra data (JSON string) */
  extraData?: string;
  
  /** Request type */
  requestType: 'captureWallet' | 'payWithATM';
}

export interface MoMoPaymentResponse {
  /** Partner code */
  partnerCode: string;
  
  /** Order ID */
  orderId: string;
  
  /** Request ID */
  requestId: string;
  
  /** Amount */
  amount: number;
  
  /** Response time */
  responseTime: number;
  
  /** Message */
  message: string;
  
  /** Result code (0 = success) */
  resultCode: number;
  
  /** Payment URL (redirect user here) */
  payUrl: string;
  
  /** Deep link for mobile app */
  deeplink?: string;
  
  /** QR code URL */
  qrCodeUrl?: string;
}

export interface MoMoIPNCallback {
  /** Partner code */
  partnerCode: string;
  
  /** Order ID */
  orderId: string;
  
  /** Request ID */
  requestId: string;
  
  /** Amount */
  amount: number;
  
  /** Order info */
  orderInfo: string;
  
  /** Order type */
  orderType: string;
  
  /** Transaction ID (from MoMo) */
  transId: number;
  
  /** Result code */
  resultCode: number;
  
  /** Message */
  message: string;
  
  /** Pay type */
  payType: string;
  
  /** Response time */
  responseTime: number;
  
  /** Extra data */
  extraData: string;
  
  /** Signature */
  signature: string;
}

// ═══════════════════════════════════════════════════════════════
//  ADSENSE
// ═══════════════════════════════════════════════════════════════

export interface AdSlot {
  /** Slot ID */
  slotId: string;
  
  /** Format:  auto, rectangle, horizontal, vertical */
  format: 'auto' | 'rectangle' | 'horizontal' | 'vertical' | 'in-article' | 'in-feed';
  
  /** Full width responsive */
  fullWidthResponsive?: boolean;
  
  /** Custom styles */
  style?: Record<string, string>;
}

export interface AdConfig {
  /** Client ID (ca-pub-XXXXXX) */
  clientId: string;
  
  /** Enable ads */
  enabled: boolean;
  
  /** Enable test mode */
  testMode: boolean;
  
  /** Disable for premium users */
  disableForPremium: boolean;
  
  /** Ad slots by position */
  slots: Record<string, AdSlot>;
}

// ═══════════════════════════════════════════════════════════════
//  PRICING
// ═══════════════════════════════════════════════════════════════

export interface PricingPlan {
  /** Plan ID */
  id: string;
  
  /** Plan name */
  name: string;
  
  /** Name in Vietnamese */
  nameVi: string;
  
  /** Price in VND (0 for free) */
  priceVND: number;
  
  /** Billing period */
  period: 'free' | 'monthly' | 'yearly' | 'lifetime';
  
  /** Features list */
  features: PlanFeature[];
  
  /** Is recommended */
  recommended?: boolean;
  
  /** Discount percentage (for yearly) */
  discount?: number;
}

export interface PlanFeature {
  /** Feature name */
  name: string;
  
  /** Name in Vietnamese */
  nameVi: string;
  
  /** Is included */
  included: boolean;
  
  /** Limit (if applicable) */
  limit?: string;
}

// ═══════════════════════════════════════════════════════════════
//  PREMIUM BENEFITS
// ═══════════════════════════════════════════════════════════════

export interface PremiumBenefits {
  /** Remove ads */
  noAds: boolean;
  
  /** Higher rate limits */
  higherRateLimits: boolean;
  
  /** Priority support */
  prioritySupport: boolean;
  
  /** App-specific benefits */
  appSpecific: Record<string, unknown>;
}

export const PREMIUM_BENEFITS: Record<AppName, PremiumBenefits> = {
  trendbrief: {
    noAds: true,
    higherRateLimits: true,
    prioritySupport: true,
    appSpecific: {
      unlimitedSavedArticles: true,
      offlineReading: true,
      customTopics: true,
    },
  },
  smartbuy: {
    noAds: true,
    higherRateLimits: true,
    prioritySupport: true,
    appSpecific: {
      unlimitedPriceAlerts: true,
      priceHistoryExport: true,
      priorityDealNotifications: true,
    },
  },
  fintax: {
    noAds: true,
    higherRateLimits: true,
    prioritySupport: true,
    appSpecific: {
      unlimitedTransactions: true,
      advancedReports: true,
      dataExport: true,
      multipleProfiles: true,
    },
  },
  doctorcar: {
    noAds: true,
    higherRateLimits: true,
    prioritySupport: true,
    appSpecific: {
      unlimitedVehicles: true,
      maintenanceReminders: true,
      fullDTCDatabase: true,
    },
  },
  caremate: {
    noAds: true,
    higherRateLimits: true,
    prioritySupport: true,
    appSpecific: {
      unlimitedDrugLists: true,
      drugInteractionAlerts: true,
      familyProfiles: true,
    },
  },
};
