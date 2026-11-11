/**
 * Open Graph Meta Tags Service
 * Task: GRW-019 - Create Open Graph meta tags
 * 
 * Dynamically updates OG meta tags for social sharing
 * Supports Facebook, Twitter (X), LinkedIn, Zalo, Telegram
 */
import { Injectable, Inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Title, Meta } from '@angular/platform-browser';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

export interface OGMetaConfig {
  // Basic OG
  title: string;
  description: string;
  type?: 'website' | 'article' | 'product' | 'profile';
  url?: string;
  image?: string;
  imageAlt?: string;
  imageWidth?: number;
  imageHeight?: number;
  locale?: string;
  siteName?: string;

  // Article specific
  articleAuthor?: string;
  articlePublishedTime?: string;
  articleModifiedTime?: string;
  articleSection?: string;
  articleTags?: string[];

  // Product specific (SmartBuy)
  productPrice?: number;
  productCurrency?: string;
  productAvailability?: 'in stock' | 'out of stock' | 'preorder';
  productCondition?: 'new' | 'used' | 'refurbished';

  // Twitter Card
  twitterCard?: 'summary' | 'summary_large_image' | 'player';
  twitterSite?: string;
  twitterCreator?: string;

  // Additional
  keywords?: string[];
  canonical?: string;
  robots?: string;
  themeColor?: string;
}

export interface AppOGDefaults {
  siteName: string;
  twitterSite: string;
  themeColor: string;
  defaultImage: string;
  locale: string;
}

@Injectable({
  providedIn: 'root'
})
export class OGMetaService {
  private isBrowser: boolean;
  private defaults: AppOGDefaults = {
    siteName: 'AI Apps VN',
    twitterSite: '@aiappsvn',
    themeColor: '#4CAF50',
    defaultImage: 'https://aiapps.vn/assets/og-default.png',
    locale: 'vi_VN'
  };

  // Pre-defined configs for each app
  private readonly appConfigs: Record<string, Partial<AppOGDefaults>> = {
    trendbrief: {
      siteName: 'TrendBrief - Tin tức thông minh',
      themeColor: '#FF6B6B',
      defaultImage: 'https://trendbrief.vn/assets/og-image.png'
    },
    smartbuy: {
      siteName: 'SmartBuy - So sánh giá thông minh',
      themeColor: '#4CAF50',
      defaultImage: 'https://smartbuy.vn/assets/og-image.png'
    },
    fintax: {
      siteName: 'FinTax - Quản lý tài chính cá nhân',
      themeColor: '#2196F3',
      defaultImage: 'https://fintax.vn/assets/og-image.png'
    },
    doctorcar: {
      siteName: 'DoctorCar - Bác sĩ xe hơi',
      themeColor: '#FF9800',
      defaultImage: 'https://doctorcar.vn/assets/og-image.png'
    },
    caremate: {
      siteName: 'CareMate - Chăm sóc sức khỏe',
      themeColor: '#E91E63',
      defaultImage: 'https://caremate.vn/assets/og-image.png'
    }
  };

  constructor(
    @Inject(PLATFORM_ID) private platformId: Object,
    @Inject(DOCUMENT) private document: Document,
    private titleService: Title,
    private metaService: Meta,
    private router: Router
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  /**
   * Initialize for specific app
   */
  initForApp(appId: string): void {
    const config = this.appConfigs[appId.toLowerCase()];
    if (config) {
      this.defaults = { ...this.defaults, ...config };
    }

    // Listen for route changes and update canonical
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.updateCanonical(event.urlAfterRedirects);
    });
  }

  /**
   * Update all meta tags
   */
  updateTags(config: OGMetaConfig): void {
    const fullConfig = this.mergeWithDefaults(config);

    // Title
    this.titleService.setTitle(fullConfig.title);

    // Basic meta
    this.setMetaTag('description', fullConfig.description);
    this.setMetaTag('keywords', fullConfig.keywords?.join(', '));
    this.setMetaTag('robots', fullConfig.robots || 'index, follow');
    this.setMetaTag('theme-color', fullConfig.themeColor);

    // Open Graph
    this.setMetaTag('og:title', fullConfig.title);
    this.setMetaTag('og:description', fullConfig.description);
    this.setMetaTag('og:type', fullConfig.type || 'website');
    this.setMetaTag('og:url', fullConfig.url || this.getCurrentUrl());
    this.setMetaTag('og:image', fullConfig.image || this.defaults.defaultImage);
    this.setMetaTag('og:image:alt', fullConfig.imageAlt || fullConfig.title);
    this.setMetaTag('og:image:width', fullConfig.imageWidth?.toString() || '1200');
    this.setMetaTag('og:image:height', fullConfig.imageHeight?.toString() || '630');
    this.setMetaTag('og:locale', fullConfig.locale || this.defaults.locale);
    this.setMetaTag('og:site_name', fullConfig.siteName || this.defaults.siteName);

    // Article specific
    if (fullConfig.type === 'article') {
      this.setMetaTag('article:author', fullConfig.articleAuthor);
      this.setMetaTag('article:published_time', fullConfig.articlePublishedTime);
      this.setMetaTag('article:modified_time', fullConfig.articleModifiedTime);
      this.setMetaTag('article:section', fullConfig.articleSection);
      fullConfig.articleTags?.forEach((tag, i) => {
        this.setMetaTag(`article:tag`, tag);
      });
    }

    // Product specific (SmartBuy)
    if (fullConfig.type === 'product' && fullConfig.productPrice) {
      this.setMetaTag('og:price:amount', fullConfig.productPrice.toString());
      this.setMetaTag('og:price:currency', fullConfig.productCurrency || 'VND');
      this.setMetaTag('og:availability', fullConfig.productAvailability || 'in stock');
      this.setMetaTag('product:condition', fullConfig.productCondition || 'new');
    }

    // Twitter Card
    this.setMetaTag('twitter:card', fullConfig.twitterCard || 'summary_large_image');
    this.setMetaTag('twitter:site', fullConfig.twitterSite || this.defaults.twitterSite);
    this.setMetaTag('twitter:title', fullConfig.title);
    this.setMetaTag('twitter:description', fullConfig.description);
    this.setMetaTag('twitter:image', fullConfig.image || this.defaults.defaultImage);
    this.setMetaTag('twitter:image:alt', fullConfig.imageAlt || fullConfig.title);
    if (fullConfig.twitterCreator) {
      this.setMetaTag('twitter:creator', fullConfig.twitterCreator);
    }

    // Canonical URL
    this.updateCanonical(fullConfig.canonical || fullConfig.url);
  }

  /**
   * Update for price drop (SmartBuy)
   */
  updateForPriceDrop(product: {
    name: string;
    description: string;
    imageUrl: string;
    currentPrice: number;
    originalPrice: number;
    discountPercent: number;
    platform: string;
    url: string;
  }): void {
    const savings = product.originalPrice - product.currentPrice;
    
    this.updateTags({
      title: `🔥 GIẢM ${product.discountPercent}%: ${product.name} | SmartBuy`,
      description: `Chỉ ${this.formatPrice(product.currentPrice)} (tiết kiệm ${this.formatPrice(savings)}) trên ${product.platform}. So sánh giá và mua ngay!`,
      type: 'product',
      url: product.url,
      image: product.imageUrl,
      productPrice: product.currentPrice,
      productCurrency: 'VND',
      productAvailability: 'in stock',
      keywords: ['giảm giá', 'khuyến mãi', product.platform, product.name, 'so sánh giá']
    });
  }

  /**
   * Update for news article (TrendBrief)
   */
  updateForArticle(article: {
    title: string;
    summary: string;
    imageUrl?: string;
    author?: string;
    publishedAt: string;
    category: string;
    tags?: string[];
    url: string;
  }): void {
    this.updateTags({
      title: `${article.title} | TrendBrief`,
      description: article.summary,
      type: 'article',
      url: article.url,
      image: article.imageUrl,
      articleAuthor: article.author,
      articlePublishedTime: article.publishedAt,
      articleSection: article.category,
      articleTags: article.tags,
      keywords: ['tin tức', article.category, ...(article.tags || [])]
    });
  }

  /**
   * Update for tax calculation (FinTax)
   */
  updateForTaxResult(result: {
    grossIncome: number;
    taxAmount: number;
    netIncome: number;
    url: string;
  }): void {
    this.updateTags({
      title: `Thuế TNCN: ${this.formatPrice(result.taxAmount)}/tháng | FinTax`,
      description: `Thu nhập ${this.formatPrice(result.grossIncome)} → Thuế ${this.formatPrice(result.taxAmount)} → Thực nhận ${this.formatPrice(result.netIncome)}. Tính thuế TNCN 2026 miễn phí.`,
      type: 'website',
      url: result.url,
      keywords: ['thuế TNCN', 'tính thuế', 'thuế thu nhập cá nhân', '2026', 'calculator']
    });
  }

  /**
   * Update for DTC code (DoctorCar)
   */
  updateForDTCCode(dtc: {
    code: string;
    title: string;
    description: string;
    severity: string;
    url: string;
  }): void {
    this.updateTags({
      title: `Mã lỗi ${dtc.code}: ${dtc.title} | DoctorCar`,
      description: dtc.description,
      type: 'article',
      url: dtc.url,
      keywords: ['mã lỗi ô tô', dtc.code, 'OBD', 'chẩn đoán xe', 'sửa chữa xe']
    });
  }

  /**
   * Update for drug info (CareMate)
   */
  updateForDrug(drug: {
    name: string;
    genericName?: string;
    description: string;
    imageUrl?: string;
    url: string;
  }): void {
    this.updateTags({
      title: `${drug.name}${drug.genericName ? ` (${drug.genericName})` : ''} | CareMate`,
      description: drug.description,
      type: 'article',
      url: drug.url,
      image: drug.imageUrl,
      keywords: ['thuốc', drug.name, drug.genericName || '', 'sức khỏe', 'thông tin thuốc']
    });
  }

  /**
   * Clear all OG tags (useful for SPA navigation)
   */
  clearTags(): void {
    const ogTags = [
      'og:title', 'og:description', 'og:type', 'og:url', 'og:image',
      'og:image:alt', 'og:image:width', 'og:image:height', 'og:locale', 'og:site_name',
      'twitter:card', 'twitter:site', 'twitter:title', 'twitter:description', 'twitter:image',
      'article:author', 'article:published_time', 'article:section', 'article:tag',
      'og:price:amount', 'og:price:currency', 'og:availability', 'product:condition'
    ];

    ogTags.forEach(tag => this.metaService.removeTag(`property='${tag}'`));
    ogTags.forEach(tag => this.metaService.removeTag(`name='${tag}'`));
  }

  private setMetaTag(name: string, content: string | undefined): void {
    if (!content) return;

    // Determine if property (OG) or name (Twitter, standard)
    const isProperty = name.startsWith('og:') || name.startsWith('article:') || name.startsWith('product:');
    
    if (isProperty) {
      this.metaService.updateTag({ property: name, content });
    } else {
      this.metaService.updateTag({ name, content });
    }
  }

  private updateCanonical(url?: string): void {
    if (!this.isBrowser) return;

    const canonicalUrl = url || this.getCurrentUrl();
    let link = this.document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
    
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    
    link.setAttribute('href', canonicalUrl);
  }

  private getCurrentUrl(): string {
    if (!this.isBrowser) return '';
    return window.location.href;
  }

  private mergeWithDefaults(config: OGMetaConfig): OGMetaConfig {
    return {
      ...config,
      siteName: config.siteName || this.defaults.siteName,
      themeColor: config.themeColor || this.defaults.themeColor,
      locale: config.locale || this.defaults.locale,
      image: config.image || this.defaults.defaultImage
    };
  }

  private formatPrice(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(value);
  }
}
