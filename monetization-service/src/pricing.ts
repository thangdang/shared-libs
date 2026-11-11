/**
 * Pricing Configuration - Nov 2026 Release
 * 
 * Pricing plans for all apps:  Free + 99K VND Premium
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import type { PricingPlan, AppName } from './types';

// ═══════════════════════════════════════════════════════════════
//  PRICING CONSTANTS
// ═══════════════════════════════════════════════════════════════

export const PREMIUM_PRICE_VND = 99000; // 99,000 VND per month

// ═══════════════════════════════════════════════════════════════
//  FREE PLAN
// ═══════════════════════════════════════════════════════════════

export const FREE_PLAN: PricingPlan = {
  id: 'free',
  name: 'Free',
  nameVi: 'Miễn phí',
  priceVND: 0,
  period: 'free',
  features: [
    {
      name: 'Basic features',
      nameVi: 'Tính năng cơ bản',
      included: true,
    },
    {
      name: 'Ads supported',
      nameVi: 'Có quảng cáo',
      included: true,
    },
    {
      name: 'Standard rate limits',
      nameVi: 'Giới hạn truy cập tiêu chuẩn',
      included: true,
    },
    {
      name: 'Community support',
      nameVi: 'Hỗ trợ cộng đồng',
      included: true,
    },
    {
      name: 'No ads',
      nameVi: 'Không quảng cáo',
      included: false,
    },
    {
      name: 'Premium features',
      nameVi: 'Tính năng cao cấp',
      included: false,
    },
    {
      name: 'Priority support',
      nameVi: 'Hỗ trợ ưu tiên',
      included: false,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  PREMIUM PLAN
// ═══════════════════════════════════════════════════════════════

export const PREMIUM_PLAN: PricingPlan = {
  id: 'premium',
  name: 'Premium',
  nameVi: 'Cao cấp',
  priceVND: PREMIUM_PRICE_VND,
  period: 'monthly',
  recommended: true,
  features: [
    {
      name: 'All free features',
      nameVi: 'Tất cả tính năng miễn phí',
      included: true,
    },
    {
      name: 'No ads',
      nameVi: 'Không quảng cáo',
      included: true,
    },
    {
      name: 'Higher rate limits',
      nameVi: 'Giới hạn truy cập cao hơn',
      included: true,
    },
    {
      name: 'Priority support',
      nameVi: 'Hỗ trợ ưu tiên',
      included: true,
    },
    {
      name: 'Premium features',
      nameVi: 'Tính năng cao cấp',
      included: true,
    },
    {
      name: 'Early access to new features',
      nameVi: 'Trải nghiệm tính năng mới sớm',
      included: true,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  ALL PLANS
// ═══════════════════════════════════════════════════════════════

export const PRICING_PLANS: PricingPlan[] = [
  FREE_PLAN,
  PREMIUM_PLAN,
];

// ═══════════════════════════════════════════════════════════════
//  APP-SPECIFIC PREMIUM FEATURES
// ═══════════════════════════════════════════════════════════════

export const APP_PREMIUM_FEATURES: Record<AppName, Array<{ name: string; nameVi: string }>> = {
  trendbrief: [
    { name: 'Unlimited saved articles', nameVi: 'Lưu bài viết không giới hạn' },
    { name: 'Offline reading', nameVi: 'Đọc offline' },
    { name: 'Custom topics', nameVi: 'Chủ đề tùy chỉnh' },
  ],
  smartbuy: [
    { name: 'Unlimited price alerts', nameVi: 'Thông báo giá không giới hạn' },
    { name: 'Price history export', nameVi: 'Xuất lịch sử giá' },
    { name: 'Priority deal notifications', nameVi: 'Thông báo deal ưu tiên' },
  ],
  fintax: [
    { name: 'Unlimited transactions', nameVi: 'Giao dịch không giới hạn' },
    { name: 'Advanced reports', nameVi: 'Báo cáo nâng cao' },
    { name: 'Data export', nameVi: 'Xuất dữ liệu' },
    { name: 'Multiple profiles', nameVi: 'Nhiều hồ sơ' },
  ],
  doctorcar: [
    { name: 'Unlimited vehicles', nameVi: 'Xe không giới hạn' },
    { name: 'Maintenance reminders', nameVi: 'Nhắc bảo dưỡng' },
    { name: 'Full DTC database', nameVi: 'Cơ sở dữ liệu DTC đầy đủ' },
  ],
  caremate: [
    { name: 'Unlimited drug lists', nameVi: 'Danh sách thuốc không giới hạn' },
    { name: 'Drug interaction alerts', nameVi: 'Cảnh báo tương tác thuốc' },
    { name: 'Family profiles', nameVi: 'Hồ sơ gia đình' },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════

/**
 * Format price in VND
 */
export function formatPriceVND(price: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Get premium price (with potential discount)
 */
export function getPremiumPrice(period: 'monthly' | 'yearly' = 'monthly'): {
  price: number;
  formattedPrice: string;
  discount: number;
  savingsVND: number;
} {
  if (period === 'yearly') {
    const yearlyDiscount = 20; // 20% off
    const monthlyTotal = PREMIUM_PRICE_VND * 12;
    const yearlyPrice = Math.round(monthlyTotal * (1 - yearlyDiscount / 100));
    const savings = monthlyTotal - yearlyPrice;
    
    return {
      price: yearlyPrice,
      formattedPrice: formatPriceVND(yearlyPrice),
      discount: yearlyDiscount,
      savingsVND: savings,
    };
  }
  
  return {
    price: PREMIUM_PRICE_VND,
    formattedPrice: formatPriceVND(PREMIUM_PRICE_VND),
    discount: 0,
    savingsVND: 0,
  };
}

/**
 * Get pricing plan with app-specific features
 */
export function getPricingPlanForApp(app: AppName, planId: 'free' | 'premium'): PricingPlan {
  const basePlan = planId === 'free' ? FREE_PLAN : PREMIUM_PLAN;
  
  if (planId === 'premium' && APP_PREMIUM_FEATURES[app]) {
    const appFeatures = APP_PREMIUM_FEATURES[app].map(f => ({
      ...f,
      included: true,
    }));
    
    return {
      ...basePlan,
      features: [...basePlan.features, ...appFeatures],
    };
  }
  
  return basePlan;
}
