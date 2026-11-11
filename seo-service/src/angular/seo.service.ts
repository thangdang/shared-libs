/**
 * Angular SEO Service - Nov 2026 Release
 * 
 * Injectable service for managing meta tags, Open Graph, Twitter cards,
 * and JSON-LD structured data.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Injectable, Inject, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser, DOCUMENT } from '@angular/common';
import { Meta, Title } from '@angular/platform-browser';
import type {
  MetaTags,
  OpenGraphTags,
  TwitterCardTags,
  StructuredDataConfig,
  PageSEOConfig,
  BreadcrumbItem,
  SEOServiceConfig,
} from '../types';
import { serializeJsonLd, buildBreadcrumbs } from '../structured-data';
import { SEO_CONFIG } from './seo.provider';

@Injectable({
  providedIn: 'root',
})
export class SeoService {
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private jsonLdScriptId = 'seo-json-ld';

  constructor(@Inject(SEO_CONFIG) private readonly config: SEOServiceConfig) {}

  // ─────────────────────────────────────────────────────────────
  //  MAIN UPDATE METHOD
  // ─────────────────────────────────────────────────────────────

  /**
   * Update all SEO meta tags for a page
   */
  updatePage(seo: PageSEOConfig): void {
    if (seo.meta) {
      this.updateMetaTags(seo.meta);
    }
    
    if (seo.og) {
      this.updateOpenGraph(seo.og);
    }
    
    if (seo.twitter) {
      this.updateTwitterCard(seo.twitter);
    }
    
    if (seo.structuredData && this.config.enableStructuredData) {
      this.updateStructuredData(seo.structuredData);
    }
    
    if (seo.additionalMeta) {
      for (const meta of seo.additionalMeta) {
        if (meta.name) {
          this.meta.updateTag({ name: meta.name, content: meta.content });
        } else if (meta.property) {
          this.meta.updateTag({ property: meta.property, content: meta.content });
        }
      }
    }
  }

  /**
   * Reset to default SEO tags
   */
  resetToDefaults(): void {
    this.title.setTitle(this.config.defaultTitle);
    this.meta.updateTag({ name: 'description', content: this.config.defaultDescription });
    this.meta.updateTag({ name: 'keywords', content: this.config.defaultKeywords.join(', ') });
    
    this.updateOpenGraph({
      title: this.config.defaultTitle,
      description: this.config.defaultDescription,
      image: this.buildAbsoluteUrl(this.config.defaultOgImage),
      type: 'website',
      siteName: this.config.siteName,
      locale: this.config.defaultLocale,
    });
    
    this.updateTwitterCard({
      card: 'summary_large_image',
      title: this.config.defaultTitle,
      description: this.config.defaultDescription,
      image: this.buildAbsoluteUrl(this.config.defaultOgImage),
      site: this.config.twitterSite,
    });
    
    this.removeStructuredData();
  }

  // ─────────────────────────────────────────────────────────────
  //  META TAGS
  // ─────────────────────────────────────────────────────────────

  /**
   * Update basic meta tags
   */
  updateMetaTags(tags: MetaTags): void {
    // Title
    if (tags.title) {
      const fullTitle = tags.title + this.config.titleSuffix;
      this.title.setTitle(fullTitle);
    }
    
    // Description
    if (tags.description) {
      this.meta.updateTag({ name: 'description', content: tags.description });
    }
    
    // Keywords
    if (tags.keywords) {
      const keywords = Array.isArray(tags.keywords) 
        ? tags.keywords.join(', ')
        : tags.keywords;
      this.meta.updateTag({ name: 'keywords', content: keywords });
    }
    
    // Canonical
    if (tags.canonical) {
      this.updateCanonical(tags.canonical);
    }
    
    // Robots
    if (tags.robots) {
      this.meta.updateTag({ name: 'robots', content: tags.robots });
    }
    
    // Author
    if (tags.author) {
      this.meta.updateTag({ name: 'author', content: tags.author });
    }
  }

  /**
   * Set page title with suffix
   */
  setTitle(pageTitle: string): void {
    this.title.setTitle(pageTitle + this.config.titleSuffix);
  }

  /**
   * Set meta description
   */
  setDescription(description: string): void {
    this.meta.updateTag({ name: 'description', content: description });
  }

  // ─────────────────────────────────────────────────────────────
  //  CANONICAL URL
  // ─────────────────────────────────────────────────────────────

  /**
   * Update canonical link tag
   */
  updateCanonical(url: string): void {
    if (!this.isBrowser) return;
    
    let link: HTMLLinkElement | null = this.document.querySelector('link[rel="canonical"]');
    
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    
    link.setAttribute('href', url);
  }

  /**
   * Build canonical URL from path
   */
  buildCanonicalUrl(path: string): string {
    const cleanPath = path.startsWith('/') ? path : '/' + path;
    return `${this.config.canonicalBase}${cleanPath}`;
  }

  // ─────────────────────────────────────────────────────────────
  //  OPEN GRAPH
  // ─────────────────────────────────────────────────────────────

  /**
   * Update Open Graph meta tags
   */
  updateOpenGraph(og: OpenGraphTags): void {
    const title = og.title || this.title.getTitle();
    const description = og.description || this.config.defaultDescription;
    const image = og.image || this.buildAbsoluteUrl(this.config.defaultOgImage);
    
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:image', content: image });
    
    if (og.url) {
      this.meta.updateTag({ property: 'og:url', content: og.url });
    }
    
    this.meta.updateTag({ property: 'og:type', content: og.type || 'website' });
    this.meta.updateTag({ property: 'og:site_name', content: og.siteName || this.config.siteName });
    this.meta.updateTag({ property: 'og:locale', content: og.locale || this.config.defaultLocale });
    
    // Article-specific tags
    if (og.article) {
      if (og.article.publishedTime) {
        this.meta.updateTag({ property: 'article:published_time', content: og.article.publishedTime });
      }
      if (og.article.modifiedTime) {
        this.meta.updateTag({ property: 'article:modified_time', content: og.article.modifiedTime });
      }
      if (og.article.author) {
        this.meta.updateTag({ property: 'article:author', content: og.article.author });
      }
      if (og.article.section) {
        this.meta.updateTag({ property: 'article:section', content: og.article.section });
      }
      if (og.article.tag) {
        for (const tag of og.article.tag) {
          this.meta.addTag({ property: 'article:tag', content: tag });
        }
      }
    }
    
    // Product-specific tags
    if (og.product) {
      if (og.product.price) {
        this.meta.updateTag({ property: 'product:price:amount', content: og.product.price });
      }
      if (og.product.currency) {
        this.meta.updateTag({ property: 'product:price:currency', content: og.product.currency });
      }
      if (og.product.availability) {
        this.meta.updateTag({ property: 'product:availability', content: og.product.availability });
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  TWITTER CARD
  // ─────────────────────────────────────────────────────────────

  /**
   * Update Twitter card meta tags
   */
  updateTwitterCard(twitter: TwitterCardTags): void {
    const title = twitter.title || this.title.getTitle();
    const description = twitter.description || this.config.defaultDescription;
    const image = twitter.image || this.buildAbsoluteUrl(this.config.defaultOgImage);
    
    this.meta.updateTag({ name: 'twitter:card', content: twitter.card || 'summary_large_image' });
    this.meta.updateTag({ name: 'twitter:title', content: title });
    this.meta.updateTag({ name: 'twitter:description', content: description });
    this.meta.updateTag({ name: 'twitter:image', content: image });
    
    if (twitter.site || this.config.twitterSite) {
      this.meta.updateTag({ name: 'twitter:site', content: twitter.site || this.config.twitterSite || '' });
    }
    
    if (twitter.creator) {
      this.meta.updateTag({ name: 'twitter:creator', content: twitter.creator });
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  STRUCTURED DATA (JSON-LD)
  // ─────────────────────────────────────────────────────────────

  /**
   * Update JSON-LD structured data
   */
  updateStructuredData(configs: StructuredDataConfig[]): void {
    if (!this.isBrowser || !this.config.enableStructuredData) return;
    
    this.removeStructuredData();
    
    if (configs.length === 0) return;
    
    const script = this.document.createElement('script');
    script.id = this.jsonLdScriptId;
    script.type = 'application/ld+json';
    script.textContent = serializeJsonLd(configs);
    
    this.document.head.appendChild(script);
  }

  /**
   * Add breadcrumbs structured data
   */
  setBreadcrumbs(items: BreadcrumbItem[]): void {
    const breadcrumbData = buildBreadcrumbs(items);
    this.updateStructuredData([breadcrumbData]);
  }

  /**
   * Remove JSON-LD script
   */
  removeStructuredData(): void {
    if (!this.isBrowser) return;
    
    const existing = this.document.getElementById(this.jsonLdScriptId);
    if (existing) {
      existing.remove();
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Build absolute URL from relative path
   */
  buildAbsoluteUrl(path: string): string {
    if (path.startsWith('http')) {
      return path;
    }
    return `${this.config.canonicalBase}${path.startsWith('/') ? path : '/' + path}`;
  }

  /**
   * Get current config
   */
  getConfig(): SEOServiceConfig {
    return this.config;
  }
}
