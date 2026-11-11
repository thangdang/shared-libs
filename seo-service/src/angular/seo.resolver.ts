/**
 * Angular SEO Route Resolver - Nov 2026 Release
 * 
 * Resolver to set SEO meta tags based on route data.
 * 
 * Usage in routes:
 * ```typescript
 * {
 *   path: 'news/:id',
 *   component: NewsDetailComponent,
 *   resolve: { seo: SeoResolver },
 *   data: {
 *     seo: {
 *       title: 'Tin Tức',
 *       description: 'Đọc tin tức mới nhất',
 *     }
 *   }
 * }
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Injectable, inject } from '@angular/core';
import { Resolve, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { SeoService } from './seo.service';
import type { PageSEOConfig } from '../types';

@Injectable({
  providedIn: 'root',
})
export class SeoResolver implements Resolve<void> {
  private readonly seoService = inject(SeoService);

  resolve(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): void {
    const seoData = route.data['seo'] as PageSEOConfig | undefined;
    
    if (seoData) {
      // Build canonical URL from route
      const canonical = this.seoService.buildCanonicalUrl(state.url);
      
      this.seoService.updatePage({
        meta: {
          ...seoData.meta,
          canonical,
        },
        og: {
          ...seoData.og,
          url: canonical,
        },
        twitter: seoData.twitter,
        structuredData: seoData.structuredData,
      });
    }
  }
}

/**
 * Functional resolver for Angular 15+
 * 
 * Usage:
 * ```typescript
 * {
 *   path: 'news/:id',
 *   component: NewsDetailComponent,
 *   resolve: { seo: seoResolver },
 *   data: { seo: { title: 'Tin Tức' } }
 * }
 * ```
 */
export function seoResolver(route: ActivatedRouteSnapshot, state: RouterStateSnapshot): void {
  const seoService = inject(SeoService);
  const seoData = route.data['seo'] as PageSEOConfig | undefined;
  
  if (seoData) {
    const canonical = seoService.buildCanonicalUrl(state.url);
    
    seoService.updatePage({
      meta: { ...seoData.meta, canonical },
      og: { ...seoData.og, url: canonical },
      twitter: seoData.twitter,
      structuredData: seoData.structuredData,
    });
  }
}
