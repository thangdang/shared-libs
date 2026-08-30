/**
 * Product Plans — Pricing configuration for all products
 */

export interface ProductPlan {
  id: string;
  price: number;
  durationDays: number;
  label: string;
}

export const PRODUCT_PLANS: Record<string, ProductPlan[]> = {
  trendbriefai: [
    { id: 'pro_monthly', price: 49000, durationDays: 30, label: 'Pro Monthly' },
    { id: 'pro_yearly', price: 399000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
  ],
  smartbuy: [
    { id: 'pro_monthly', price: 79000, durationDays: 30, label: 'Pro Monthly' },
    { id: 'pro_yearly', price: 649000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
  ],
  fintax: [
    { id: 'pro_monthly', price: 99000, durationDays: 30, label: 'Pro Monthly' },
    { id: 'pro_yearly', price: 950000, durationDays: 365, label: 'Pro Yearly (save 20%)' },
    { id: 'seller_pro_monthly', price: 199000, durationDays: 30, label: 'Seller Pro Monthly' },
    { id: 'seller_pro_yearly', price: 1900000, durationDays: 365, label: 'Seller Pro Yearly (save 20%)' },
  ],
  caremate: [
    { id: 'pro_monthly', price: 49000, durationDays: 30, label: 'Pro Monthly' },
    { id: 'pro_yearly', price: 399000, durationDays: 365, label: 'Pro Yearly (save 32%)' },
  ],
  bundle: [
    { id: 'bundle_monthly', price: 149000, durationDays: 30, label: 'All Products Pro Monthly (save 40%)' },
    { id: 'bundle_yearly', price: 1290000, durationDays: 365, label: 'All Products Pro Yearly (save 55%)' },
  ],
};

/**
 * Get plans for a specific product.
 */
export function getPlansByProduct(product: string): ProductPlan[] | null {
  return PRODUCT_PLANS[product] || null;
}

/**
 * Find a specific plan by product and plan ID.
 */
export function findPlan(product: string, planId: string): ProductPlan | null {
  const plans = PRODUCT_PLANS[product];
  return plans?.find((p) => p.id === planId) || null;
}
