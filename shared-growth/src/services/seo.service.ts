/**
 * SEO Service - Shared across all 5 apps
 * Handles meta tags, structured data, sitemap generation, and SEO optimization
 */

export interface MetaTags {
  title: string;
  description: string;
  keywords: string[];
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  ogType?: string;
  twitterCard?: string;
  canonical?: string;
  robots?: string;
  author?: string;
  language?: string;
}

export interface StructuredData {
  '@context': string;
  '@type': string;
  [key: string]: any;
}

export interface SitemapEntry {
  loc: string;
  lastmod: string;
  changefreq: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  priority: number;
}

export interface SEOConfig {
  appId: string;
  baseUrl: string;
  defaultTitle: string;
  defaultDescription: string;
  defaultKeywords: string[];
  defaultImage: string;
  twitterHandle?: string;
  facebookAppId?: string;
}

export class SEOService {
  private configs: Record<string, SEOConfig> = {
    'trendbrief': {
      appId: 'trendbrief',
      baseUrl: 'https://trendbrief.vn',
      defaultTitle: 'TrendBrief AI - Tóm tắt tin tức thông minh bằng AI',
      defaultDescription: 'Cập nhật tin tức nhanh chóng với bản tóm tắt thông minh. Tiết kiệm 80% thời gian đọc tin với TrendBrief AI.',
      defaultKeywords: ['tin tức', 'tóm tắt tin', 'AI', 'đọc nhanh', 'news brief', 'tin tức việt nam'],
      defaultImage: 'https://trendbrief.vn/og-image.png'
    },
    'smartbuy': {
      appId: 'smartbuy',
      baseUrl: 'https://smartbuy.vn',
      defaultTitle: 'SmartBuy AI - So sánh giá thông minh, tìm deal tốt nhất',
      defaultDescription: 'Tiết kiệm tiền mua sắm với SmartBuy AI. So sánh giá từ nhiều nguồn, theo dõi giảm giá, tìm deal tốt nhất.',
      defaultKeywords: ['so sánh giá', 'deal', 'giảm giá', 'mua sắm thông minh', 'price comparison', 'tiết kiệm'],
      defaultImage: 'https://smartbuy.vn/og-image.png'
    },
    'fintax': {
      appId: 'fintax',
      baseUrl: 'https://fintax.vn',
      defaultTitle: 'FinTax AI - Quản lý tài chính cá nhân & Hỗ trợ kê khai thuế',
      defaultDescription: 'Quản lý thu chi, lập ngân sách, và hỗ trợ kê khai thuế cá nhân với FinTax AI. Kiểm soát tài chính dễ dàng.',
      defaultKeywords: ['quản lý tài chính', 'thuế cá nhân', 'ngân sách', 'chi tiêu', 'personal finance', 'tax'],
      defaultImage: 'https://fintax.vn/og-image.png'
    },
    'doctorcar': {
      appId: 'doctorcar',
      baseUrl: 'https://doctorcar.vn',
      defaultTitle: 'DoctorCar AI - Chăm sóc xe hơi thông minh',
      defaultDescription: 'Theo dõi lịch bảo dưỡng, chi phí sử dụng xe, và nhận nhắc nhở thông minh với DoctorCar AI.',
      defaultKeywords: ['bảo dưỡng xe', 'chăm sóc ô tô', 'chi phí xe', 'car maintenance', 'nhắc bảo dưỡng'],
      defaultImage: 'https://doctorcar.vn/og-image.png'
    },
    'caremate': {
      appId: 'caremate',
      baseUrl: 'https://caremate.vn',
      defaultTitle: 'CareMate AI - Chăm sóc sức khỏe gia đình',
      defaultDescription: 'Quản lý lịch tiêm chủng, thuốc, hồ sơ sức khỏe cho cả gia đình với CareMate AI. Bảo vệ sức khỏe người thân.',
      defaultKeywords: ['sức khỏe gia đình', 'tiêm chủng', 'quản lý thuốc', 'hồ sơ y tế', 'family health', 'vaccination'],
      defaultImage: 'https://caremate.vn/og-image.png'
    }
  };

  /**
   * Generate meta tags for a page
   */
  generateMetaTags(appId: string, pageConfig?: Partial<MetaTags>): MetaTags {
    const config = this.configs[appId];
    if (!config) throw new Error(`Unknown app: ${appId}`);

    return {
      title: pageConfig?.title || config.defaultTitle,
      description: pageConfig?.description || config.defaultDescription,
      keywords: pageConfig?.keywords || config.defaultKeywords,
      ogTitle: pageConfig?.ogTitle || pageConfig?.title || config.defaultTitle,
      ogDescription: pageConfig?.ogDescription || pageConfig?.description || config.defaultDescription,
      ogImage: pageConfig?.ogImage || config.defaultImage,
      ogType: pageConfig?.ogType || 'website',
      twitterCard: pageConfig?.twitterCard || 'summary_large_image',
      canonical: pageConfig?.canonical || config.baseUrl,
      robots: pageConfig?.robots || 'index, follow',
      author: pageConfig?.author || config.defaultTitle.split(' - ')[0],
      language: pageConfig?.language || 'vi'
    };
  }

  /**
   * Generate HTML meta tags string
   */
  generateMetaTagsHTML(tags: MetaTags): string {
    const lines: string[] = [
      `<title>${this.escapeHtml(tags.title)}</title>`,
      `<meta name="description" content="${this.escapeHtml(tags.description)}">`,
      `<meta name="keywords" content="${tags.keywords.join(', ')}">`,
      `<meta name="robots" content="${tags.robots}">`,
      `<meta name="author" content="${this.escapeHtml(tags.author || '')}">`,
      `<link rel="canonical" href="${tags.canonical}">`,
      '',
      '<!-- Open Graph -->',
      `<meta property="og:title" content="${this.escapeHtml(tags.ogTitle || tags.title)}">`,
      `<meta property="og:description" content="${this.escapeHtml(tags.ogDescription || tags.description)}">`,
      `<meta property="og:image" content="${tags.ogImage}">`,
      `<meta property="og:type" content="${tags.ogType}">`,
      `<meta property="og:locale" content="vi_VN">`,
      '',
      '<!-- Twitter Card -->',
      `<meta name="twitter:card" content="${tags.twitterCard}">`,
      `<meta name="twitter:title" content="${this.escapeHtml(tags.ogTitle || tags.title)}">`,
      `<meta name="twitter:description" content="${this.escapeHtml(tags.ogDescription || tags.description)}">`,
      `<meta name="twitter:image" content="${tags.ogImage}">`
    ];

    return lines.join('\n');
  }

  /**
   * Generate structured data for WebApplication
   */
  generateWebAppStructuredData(appId: string): StructuredData {
    const config = this.configs[appId];
    if (!config) throw new Error(`Unknown app: ${appId}`);

    return {
      '@context': 'https://schema.org',
      '@type': 'WebApplication',
      'name': config.defaultTitle.split(' - ')[0],
      'description': config.defaultDescription,
      'url': config.baseUrl,
      'applicationCategory': this.getAppCategory(appId),
      'operatingSystem': 'Web',
      'offers': {
        '@type': 'Offer',
        'price': '0',
        'priceCurrency': 'VND'
      },
      'aggregateRating': {
        '@type': 'AggregateRating',
        'ratingValue': '4.8',
        'ratingCount': '1000'
      },
      'inLanguage': 'vi',
      'author': {
        '@type': 'Organization',
        'name': config.defaultTitle.split(' - ')[0]
      }
    };
  }

  /**
   * Generate structured data for Article (blog posts, SEO content)
   */
  generateArticleStructuredData(
    appId: string,
    article: {
      title: string;
      description: string;
      url: string;
      imageUrl?: string;
      author?: string;
      datePublished: string;
      dateModified?: string;
    }
  ): StructuredData {
    const config = this.configs[appId];

    return {
      '@context': 'https://schema.org',
      '@type': 'Article',
      'headline': article.title,
      'description': article.description,
      'image': article.imageUrl || config.defaultImage,
      'url': article.url,
      'datePublished': article.datePublished,
      'dateModified': article.dateModified || article.datePublished,
      'author': {
        '@type': 'Organization',
        'name': article.author || config.defaultTitle.split(' - ')[0]
      },
      'publisher': {
        '@type': 'Organization',
        'name': config.defaultTitle.split(' - ')[0],
        'logo': {
          '@type': 'ImageObject',
          'url': `${config.baseUrl}/logo.png`
        }
      },
      'mainEntityOfPage': {
        '@type': 'WebPage',
        '@id': article.url
      }
    };
  }

  /**
   * Generate structured data for FAQ page
   */
  generateFAQStructuredData(
    faqs: Array<{ question: string; answer: string }>
  ): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': faqs.map(faq => ({
        '@type': 'Question',
        'name': faq.question,
        'acceptedAnswer': {
          '@type': 'Answer',
          'text': faq.answer
        }
      }))
    };
  }

  /**
   * Generate sitemap entries for an app
   */
  generateSitemapEntries(
    appId: string,
    pages: Array<{
      path: string;
      lastmod?: string;
      changefreq?: SitemapEntry['changefreq'];
      priority?: number;
    }>
  ): SitemapEntry[] {
    const config = this.configs[appId];
    if (!config) throw new Error(`Unknown app: ${appId}`);

    const today = new Date().toISOString().split('T')[0];

    return pages.map(page => ({
      loc: `${config.baseUrl}${page.path}`,
      lastmod: page.lastmod || today,
      changefreq: page.changefreq || 'weekly',
      priority: page.priority || 0.5
    }));
  }

  /**
   * Generate sitemap XML
   */
  generateSitemapXML(entries: SitemapEntry[]): string {
    const urlElements = entries.map(entry => `
  <url>
    <loc>${entry.loc}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    <changefreq>${entry.changefreq}</changefreq>
    <priority>${entry.priority}</priority>
  </url>`).join('');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlElements}
</urlset>`;
  }

  /**
   * Generate robots.txt content
   */
  generateRobotsTxt(appId: string, disallowPaths: string[] = []): string {
    const config = this.configs[appId];
    if (!config) throw new Error(`Unknown app: ${appId}`);

    const disallowLines = disallowPaths.map(path => `Disallow: ${path}`).join('\n');

    return `User-agent: *
Allow: /

${disallowLines}

Sitemap: ${config.baseUrl}/sitemap.xml`;
  }

  /**
   * Optimize title for SEO
   */
  optimizeTitle(title: string, appName: string, maxLength: number = 60): string {
    const suffix = ` | ${appName}`;
    const maxTitleLength = maxLength - suffix.length;

    if (title.length > maxTitleLength) {
      title = title.substring(0, maxTitleLength - 3) + '...';
    }

    return title + suffix;
  }

  /**
   * Optimize description for SEO
   */
  optimizeDescription(description: string, maxLength: number = 160): string {
    if (description.length > maxLength) {
      return description.substring(0, maxLength - 3) + '...';
    }
    return description;
  }

  /**
   * Generate breadcrumb structured data
   */
  generateBreadcrumbStructuredData(
    appId: string,
    breadcrumbs: Array<{ name: string; url: string }>
  ): StructuredData {
    return {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      'itemListElement': breadcrumbs.map((item, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'name': item.name,
        'item': item.url
      }))
    };
  }

  /**
   * Get app category for schema.org
   */
  private getAppCategory(appId: string): string {
    const categories: Record<string, string> = {
      'trendbrief': 'NewsApplication',
      'smartbuy': 'ShoppingApplication',
      'fintax': 'FinanceApplication',
      'doctorcar': 'UtilitiesApplication',
      'caremate': 'HealthApplication'
    };
    return categories[appId] || 'WebApplication';
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const escapeMap: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => escapeMap[char]);
  }
}

export const seoService = new SEOService();
