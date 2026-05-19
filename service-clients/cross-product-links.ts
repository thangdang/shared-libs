/**
 * Cross-Product Link Generator
 * ─────────────────────────────
 * Generates contextual links between products to drive traffic sharing.
 * Drop into any product service's src/services/ folder.
 *
 * Usage:
 *   const links = getCrossLinks('smartbuy', { category: 'health' });
 *   // Returns: [{ product: 'caremate', label: 'Tìm thuốc liên quan', url: '...' }]
 */

const BASE_URLS: Record<string, string> = {
  trendbriefai: 'https://trendbriefai.winlux.com',
  smartbuy: 'https://smartbuy.winlux.com',
  caremate: 'https://caremate.winlux.com',
  fintax: 'https://fintax.winlux.com',
};

const UTM_BASE = 'utm_medium=cross_promo';

interface CrossLink {
  product: string;
  label: string;
  url: string;
  icon: string;
}

interface LinkContext {
  category?: string;
  keywords?: string[];
  productName?: string;
  articleTopic?: string;
}

/**
 * Get contextual cross-product links based on current product and context.
 */
export function getCrossLinks(currentProduct: string, context: LinkContext): CrossLink[] {
  const links: CrossLink[] = [];
  const utm = `${UTM_BASE}&utm_source=${currentProduct}`;

  switch (currentProduct) {
    case 'smartbuy':
      // SmartBuy → CareMate (health products)
      if (context.category === 'health' || context.keywords?.some(k => ['thuốc', 'vitamin', 'sức khỏe', 'y tế'].includes(k))) {
        links.push({
          product: 'caremate',
          label: 'Xem hướng dẫn sử dụng thuốc',
          url: `${BASE_URLS.caremate}/suc-khoe?${utm}`,
          icon: '🏥',
        });
      }
      // SmartBuy → FIN Tax (spending tracking)
      links.push({
        product: 'fintax',
        label: 'Theo dõi chi tiêu & tính thuế',
        url: `${BASE_URLS.fintax}/tinh-thue-tncn-2026?${utm}`,
        icon: '💰',
      });
      break;

    case 'trendbriefai':
      // TrendBrief → SmartBuy (product mentions)
      if (context.articleTopic === 'tech' || context.keywords?.some(k => ['iPhone', 'Samsung', 'laptop', 'điện thoại'].includes(k))) {
        const query = context.productName || context.keywords?.[0] || '';
        links.push({
          product: 'smartbuy',
          label: `So sánh giá ${query}`,
          url: `${BASE_URLS.smartbuy}/tim-kiem?q=${encodeURIComponent(query)}&${utm}`,
          icon: '🛒',
        });
      }
      // TrendBrief → FIN Tax (finance articles)
      if (context.articleTopic === 'finance') {
        links.push({
          product: 'fintax',
          label: 'Tính thuế TNCN 2026 miễn phí',
          url: `${BASE_URLS.fintax}/tinh-thue-tncn-2026?${utm}`,
          icon: '🧮',
        });
      }
      break;

    case 'caremate':
      // CareMate → SmartBuy (buy drugs/health products)
      if (context.keywords?.some(k => ['thuốc', 'vitamin', 'thực phẩm chức năng'].includes(k))) {
        const query = context.productName || 'vitamin';
        links.push({
          product: 'smartbuy',
          label: `Mua ${query} giá tốt nhất`,
          url: `${BASE_URLS.smartbuy}/tim-kiem?q=${encodeURIComponent(query)}&${utm}`,
          icon: '🛒',
        });
      }
      break;

    case 'fintax':
      // FIN Tax → SmartBuy (deal alerts for sellers)
      links.push({
        product: 'smartbuy',
        label: 'Tìm deal tốt nhất hôm nay',
        url: `${BASE_URLS.smartbuy}/flash-sale?${utm}`,
        icon: '⚡',
      });
      break;
  }

  return links;
}

/**
 * Generate a cross-promo banner HTML snippet (for server-side injection).
 */
export function getCrossPromoBanner(currentProduct: string, context: LinkContext): string | null {
  const links = getCrossLinks(currentProduct, context);
  if (links.length === 0) return null;

  const link = links[0]; // Show top 1 cross-link
  return `<div class="cross-promo" style="padding:12px;background:#f0f9ff;border-radius:8px;margin:16px 0;text-align:center;">
    <span>${link.icon}</span>
    <a href="${link.url}" target="_blank" rel="noopener" style="color:#1a73e8;font-weight:600;text-decoration:none;margin-left:8px;">${link.label}</a>
  </div>`;
}
