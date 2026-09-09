/**
 * Affiliate Types
 */

export type Platform = 'shopee' | 'lazada' | 'tiki' | 'tiktok' | 'longchau' | 'pharmacity' | 'ankhang';

export type Category = 
  | 'electronics'
  | 'fashion'
  | 'home'
  | 'health_beauty'
  | 'books'
  | 'baby'
  | 'auto_parts'
  | 'insurance'
  | 'medicine'
  | 'supplements'
  | 'default';

export type AppName = 
  | 'smartbuy'
  | 'video_engine'
  | 'doctorcar'
  | 'caremate'
  | 'fintax'
  | 'trendbrief';

export interface AffiliateAccount {
  _id?: string;
  platform: Platform;
  accountName: string;
  affiliateId: string;
  apiKey?: string;
  apiSecret?: string;
  status: 'active' | 'suspended' | 'pending';
  commissionRates: Record<Category, number>;
  cookieDays: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AffiliateLink {
  _id?: string;
  originalUrl: string;
  affiliateUrl: string;
  platform: Platform;
  productId?: string;
  productName: string;
  category: Category;
  price: number;
  commissionRate: number;
  expectedCommission: number;
  clickCount: number;
  conversionCount: number;
  revenue: number;
  sourceApp: AppName;
  createdAt: Date;
  expiresAt?: Date;
}

export interface AffiliateClick {
  _id?: string;
  linkId: string;
  userHash: string;
  userAgent?: string;
  referer?: string;
  sourceApp: AppName;
  sourcePage: string;
  trackingId: string;
  clickedAt: Date;
  converted: boolean;
  orderId?: string;
  commissionEarned: number;
}

export interface AffiliateMatch {
  platform: Platform;
  affiliateUrl: string;
  originalUrl: string;
  productName: string;
  price: number;
  category: Category;
  commissionRate: number;
  expectedCommission: number;
}

export interface MatchRequest {
  content?: string;
  productName?: string;
  productUrl?: string;
  price?: number;
  sourceApp: AppName;
}

export interface AffiliateStats {
  platform: Platform;
  totalClicks: number;
  totalConversions: number;
  totalRevenue: number;
  conversionRate: number;
}
