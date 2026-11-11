/**
 * Sitemap Generator - Nov 2026 Release
 * 
 * Generates XML sitemaps for all 5 apps with auto-update support.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

// ═══════════════════════════════════════════════════════════════
//  TYPES
// ═══════════════════════════════════════════════════════════════

export interface SitemapUrl {
  /** Full URL */
  loc: string;
  
  /** Last modification date (ISO 8601) */
  lastmod?: string;
  
  /** Change frequency */
  changefreq?: 'always' | 'hourly' | 'daily' | 'weekly' | 'monthly' | 'yearly' | 'never';
  
  /** Priority (0.0 to 1.0) */
  priority?: number;
  
  /** Image for image sitemap */
  image?: SitemapImage;
  
  /** News for news sitemap */
  news?: SitemapNews;
}

export interface SitemapImage {
  /** Image URL */
  loc: string;
  
  /** Image caption */
  caption?: string;
  
  /** Image title */
  title?: string;
}

export interface SitemapNews {
  /** Publication name */
  publicationName: string;
  
  /** Publication language */
  publicationLanguage: string;
  
  /** Publication date (ISO 8601) */
  publicationDate: string;
  
  /** News title */
  title: string;
}

export interface SitemapIndexEntry {
  /** Sitemap URL */
  loc: string;
  
  /** Last modification date */
  lastmod?: string;
}

export interface SitemapConfig {
  /** Base URL (e.g., https://trendbrief.ai) */
  baseUrl: string;
  
  /** Output filename */
  filename?: string;
  
  /** Include images */
  includeImages?: boolean;
  
  /** Include news */
  includeNews?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  DEFAULT PAGE CONFIGS PER APP
// ═══════════════════════════════════════════════════════════════

export interface AppPageConfig {
  path: string;
  changefreq: SitemapUrl['changefreq'];
  priority: number;
}

export const APP_STATIC_PAGES: Record<string, AppPageConfig[]> = {
  trendbrief: [
    { path: '/', changefreq: 'hourly', priority: 1.0 },
    { path: '/trending', changefreq: 'hourly', priority: 0.9 },
    { path: '/categories', changefreq: 'daily', priority: 0.8 },
    { path: '/saved', changefreq: 'weekly', priority: 0.5 },
    { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
    { path: '/about', changefreq: 'monthly', priority: 0.4 },
    { path: '/faq', changefreq: 'monthly', priority: 0.6 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
  ],
  smartbuy: [
    { path: '/', changefreq: 'hourly', priority: 1.0 },
    { path: '/flash-sale', changefreq: 'hourly', priority: 0.9 },
    { path: '/categories', changefreq: 'daily', priority: 0.8 },
    { path: '/deals', changefreq: 'hourly', priority: 0.9 },
    { path: '/compare', changefreq: 'weekly', priority: 0.7 },
    { path: '/price-alerts', changefreq: 'weekly', priority: 0.6 },
    { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
    { path: '/faq', changefreq: 'monthly', priority: 0.6 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
  ],
  fintax: [
    { path: '/', changefreq: 'daily', priority: 1.0 },
    { path: '/calculator', changefreq: 'monthly', priority: 0.9 },
    { path: '/calculator/pit', changefreq: 'monthly', priority: 0.9 },
    { path: '/transactions', changefreq: 'weekly', priority: 0.7 },
    { path: '/reports', changefreq: 'weekly', priority: 0.7 },
    { path: '/faq', changefreq: 'monthly', priority: 0.8 },
    { path: '/tips', changefreq: 'monthly', priority: 0.7 },
    { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
  ],
  doctorcar: [
    { path: '/', changefreq: 'daily', priority: 1.0 },
    { path: '/dtc', changefreq: 'daily', priority: 0.9 },
    { path: '/dtc/search', changefreq: 'daily', priority: 0.9 },
    { path: '/maintenance', changefreq: 'weekly', priority: 0.8 },
    { path: '/garage', changefreq: 'weekly', priority: 0.7 },
    { path: '/my-cars', changefreq: 'weekly', priority: 0.6 },
    { path: '/faq', changefreq: 'monthly', priority: 0.6 },
    { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
  ],
  caremate: [
    { path: '/', changefreq: 'daily', priority: 1.0 },
    { path: '/drugs', changefreq: 'daily', priority: 0.9 },
    { path: '/drugs/search', changefreq: 'daily', priority: 0.9 },
    { path: '/pharmacy', changefreq: 'daily', priority: 0.8 },
    { path: '/health', changefreq: 'daily', priority: 0.8 },
    { path: '/my-medications', changefreq: 'weekly', priority: 0.6 },
    { path: '/faq', changefreq: 'monthly', priority: 0.6 },
    { path: '/pricing', changefreq: 'monthly', priority: 0.7 },
    { path: '/privacy', changefreq: 'yearly', priority: 0.2 },
    { path: '/terms', changefreq: 'yearly', priority: 0.2 },
  ],
};

// ═══════════════════════════════════════════════════════════════
//  SITEMAP GENERATOR CLASS
// ═══════════════════════════════════════════════════════════════

export class SitemapGenerator {
  private config: SitemapConfig;
  private urls: SitemapUrl[] = [];

  constructor(config: SitemapConfig) {
    this.config = config;
  }

  /**
   * Add a URL to the sitemap
   */
  addUrl(url: SitemapUrl | string): this {
    if (typeof url === 'string') {
      this.urls.push({ loc: url });
    } else {
      this.urls.push(url);
    }
    return this;
  }

  /**
   * Add multiple URLs
   */
  addUrls(urls: (SitemapUrl | string)[]): this {
    urls.forEach(url => this.addUrl(url));
    return this;
  }

  /**
   * Add static pages for an app
   */
  addAppStaticPages(appName: string): this {
    const pages = APP_STATIC_PAGES[appName];
    if (!pages) return this;

    const today = new Date().toISOString().split('T')[0];

    pages.forEach(page => {
      this.addUrl({
        loc: `${this.config.baseUrl}${page.path}`,
        lastmod: today,
        changefreq: page.changefreq,
        priority: page.priority,
      });
    });

    return this;
  }

  /**
   * Add dynamic pages (e.g., articles, products)
   */
  addDynamicPages(
    pages: Array<{
      slug: string;
      updatedAt?: Date;
      priority?: number;
    }>,
    pathPrefix: string = ''
  ): this {
    pages.forEach(page => {
      this.addUrl({
        loc: `${this.config.baseUrl}${pathPrefix}/${page.slug}`,
        lastmod: page.updatedAt?.toISOString().split('T')[0],
        changefreq: 'weekly',
        priority: page.priority || 0.6,
      });
    });
    return this;
  }

  /**
   * Generate sitemap XML
   */
  toXML(): string {
    const namespaces = [
      'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
    ];

    if (this.config.includeImages) {
      namespaces.push('xmlns:image="http://www.google.com/schemas/sitemap-image/1.1"');
    }

    if (this.config.includeNews) {
      namespaces.push('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    }

    const urlElements = this.urls.map(url => this.urlToXML(url)).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<urlset ${namespaces.join(' ')}>
${urlElements}
</urlset>`;
  }

  /**
   * Convert single URL to XML
   */
  private urlToXML(url: SitemapUrl): string {
    const elements: string[] = [
      `  <url>`,
      `    <loc>${this.escapeXml(url.loc)}</loc>`,
    ];

    if (url.lastmod) {
      elements.push(`    <lastmod>${url.lastmod}</lastmod>`);
    }

    if (url.changefreq) {
      elements.push(`    <changefreq>${url.changefreq}</changefreq>`);
    }

    if (url.priority !== undefined) {
      elements.push(`    <priority>${url.priority.toFixed(1)}</priority>`);
    }

    if (url.image && this.config.includeImages) {
      elements.push(this.imageToXML(url.image));
    }

    if (url.news && this.config.includeNews) {
      elements.push(this.newsToXML(url.news));
    }

    elements.push(`  </url>`);

    return elements.join('\n');
  }

  /**
   * Convert image to XML
   */
  private imageToXML(image: SitemapImage): string {
    const elements: string[] = [
      `    <image:image>`,
      `      <image:loc>${this.escapeXml(image.loc)}</image:loc>`,
    ];

    if (image.caption) {
      elements.push(`      <image:caption>${this.escapeXml(image.caption)}</image:caption>`);
    }

    if (image.title) {
      elements.push(`      <image:title>${this.escapeXml(image.title)}</image:title>`);
    }

    elements.push(`    </image:image>`);

    return elements.join('\n');
  }

  /**
   * Convert news to XML
   */
  private newsToXML(news: SitemapNews): string {
    return `    <news:news>
      <news:publication>
        <news:name>${this.escapeXml(news.publicationName)}</news:name>
        <news:language>${news.publicationLanguage}</news:language>
      </news:publication>
      <news:publication_date>${news.publicationDate}</news:publication_date>
      <news:title>${this.escapeXml(news.title)}</news:title>
    </news:news>`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Get URL count
   */
  getUrlCount(): number {
    return this.urls.length;
  }

  /**
   * Clear all URLs
   */
  clear(): this {
    this.urls = [];
    return this;
  }
}

// ═══════════════════════════════════════════════════════════════
//  SITEMAP INDEX GENERATOR (for multiple sitemaps)
// ═══════════════════════════════════════════════════════════════

export class SitemapIndexGenerator {
  private sitemaps: SitemapIndexEntry[] = [];

  /**
   * Add a sitemap to the index
   */
  addSitemap(entry: SitemapIndexEntry): this {
    this.sitemaps.push(entry);
    return this;
  }

  /**
   * Generate sitemap index XML
   */
  toXML(): string {
    const sitemapElements = this.sitemaps.map(sitemap => {
      const lastmod = sitemap.lastmod 
        ? `\n    <lastmod>${sitemap.lastmod}</lastmod>` 
        : '';
      return `  <sitemap>
    <loc>${sitemap.loc}</loc>${lastmod}
  </sitemap>`;
    }).join('\n');

    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapElements}
</sitemapindex>`;
  }
}

// ═══════════════════════════════════════════════════════════════
//  ROBOTS.TXT GENERATOR
// ═══════════════════════════════════════════════════════════════

export interface RobotsTxtConfig {
  baseUrl: string;
  sitemapPath?: string;
  disallowPaths?: string[];
  allowPaths?: string[];
  crawlDelay?: number;
}

export function generateRobotsTxt(config: RobotsTxtConfig): string {
  const lines: string[] = [
    'User-agent: *',
  ];

  if (config.allowPaths?.length) {
    config.allowPaths.forEach(path => {
      lines.push(`Allow: ${path}`);
    });
  }

  if (config.disallowPaths?.length) {
    config.disallowPaths.forEach(path => {
      lines.push(`Disallow: ${path}`);
    });
  } else {
    // Default disallow paths for all apps
    lines.push('Disallow: /api/');
    lines.push('Disallow: /admin/');
    lines.push('Disallow: /auth/');
    lines.push('Disallow: /_next/');
    lines.push('Disallow: /private/');
  }

  if (config.crawlDelay) {
    lines.push(`Crawl-delay: ${config.crawlDelay}`);
  }

  lines.push('');
  lines.push(`Sitemap: ${config.baseUrl}${config.sitemapPath || '/sitemap.xml'}`);

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════
//  FACTORY FUNCTIONS
// ═══════════════════════════════════════════════════════════════

/**
 * Create sitemap generator for an app
 */
export function createSitemapGenerator(
  appName: string,
  baseUrl: string,
  options?: Partial<SitemapConfig>
): SitemapGenerator {
  const generator = new SitemapGenerator({
    baseUrl,
    ...options,
  });

  generator.addAppStaticPages(appName);

  return generator;
}

/**
 * Generate complete sitemap for an app (static + dynamic)
 */
export async function generateAppSitemap(
  appName: string,
  baseUrl: string,
  dynamicPages?: {
    articles?: Array<{ slug: string; updatedAt?: Date }>;
    products?: Array<{ slug: string; updatedAt?: Date }>;
    categories?: Array<{ slug: string }>;
  }
): Promise<string> {
  const generator = createSitemapGenerator(appName, baseUrl);

  if (dynamicPages?.articles) {
    generator.addDynamicPages(
      dynamicPages.articles.map(a => ({ ...a, priority: 0.7 })),
      appName === 'trendbrief' ? '/article' : '/blog'
    );
  }

  if (dynamicPages?.products) {
    generator.addDynamicPages(
      dynamicPages.products.map(p => ({ ...p, priority: 0.8 })),
      '/product'
    );
  }

  if (dynamicPages?.categories) {
    generator.addDynamicPages(
      dynamicPages.categories.map(c => ({ slug: c.slug, priority: 0.7 })),
      '/category'
    );
  }

  return generator.toXML();
}
