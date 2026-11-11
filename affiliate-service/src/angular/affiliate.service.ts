/**
 * Affiliate Angular Service
 * Frontend service for affiliate link management and tracking
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import {
  AffiliatePlatform,
  AffiliateLink,
  AffiliateStats,
  GenerateLinkRequest,
  AffiliateServiceConfig
} from '../types';

export interface AffiliateState {
  links: Map<string, AffiliateLink>;
  stats: AffiliateStats[];
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class AffiliateAngularService {
  private http = inject(HttpClient);

  // Reactive state using signals
  private _state = signal<AffiliateState>({
    links: new Map(),
    stats: [],
    isLoading: false,
    error: null
  });

  // Public computed signals
  readonly links = computed(() => this._state().links);
  readonly stats = computed(() => this._state().stats);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly error = computed(() => this._state().error);

  // Configuration
  private apiEndpoint = '/api/affiliate';

  /**
   * Configure the service
   */
  configure(config: Partial<AffiliateServiceConfig>): void {
    if (config.apiEndpoint) {
      this.apiEndpoint = config.apiEndpoint;
    }
  }

  /**
   * Generate affiliate link for a product URL
   */
  generateLink(request: GenerateLinkRequest): Observable<AffiliateLink | null> {
    return this.http.post<AffiliateLink>(
      `${this.apiEndpoint}/links/generate`,
      request
    ).pipe(
      tap(link => {
        if (link) {
          this._state.update(s => {
            const newLinks = new Map(s.links);
            newLinks.set(link.id, link);
            return { ...s, links: newLinks };
          });
        }
      }),
      catchError(error => {
        console.error('Failed to generate affiliate link:', error);
        return of(null);
      })
    );
  }

  /**
   * Generate affiliate links in batch
   */
  generateLinks(requests: GenerateLinkRequest[]): Observable<(AffiliateLink | null)[]> {
    return this.http.post<(AffiliateLink | null)[]>(
      `${this.apiEndpoint}/links/generate-batch`,
      { links: requests }
    ).pipe(
      tap(links => {
        this._state.update(s => {
          const newLinks = new Map(s.links);
          links.forEach(link => {
            if (link) newLinks.set(link.id, link);
          });
          return { ...s, links: newLinks };
        });
      }),
      catchError(error => {
        console.error('Failed to generate affiliate links:', error);
        return of([]);
      })
    );
  }

  /**
   * Get redirect URL for tracking
   * This URL should be used in <a href> to track clicks
   */
  getTrackingUrl(linkId: string): string {
    return `${this.apiEndpoint}/go/${linkId}`;
  }

  /**
   * Track a click (for analytics only, actual redirect happens server-side)
   */
  trackClick(linkId: string, metadata?: Record<string, unknown>): void {
    // Fire and forget - don't wait for response
    this.http.post(`${this.apiEndpoint}/track/click`, {
      linkId,
      timestamp: new Date().toISOString(),
      metadata
    }).subscribe({
      error: err => console.warn('Click tracking failed:', err)
    });
  }

  /**
   * Get affiliate statistics
   */
  loadStats(
    platform?: AffiliatePlatform,
    period: 'day' | 'week' | 'month' | 'all' = 'month'
  ): Observable<AffiliateStats[]> {
    this._state.update(s => ({ ...s, isLoading: true, error: null }));

    const params: Record<string, string> = { period };
    if (platform) params['platform'] = platform;

    return this.http.get<AffiliateStats[]>(
      `${this.apiEndpoint}/stats`,
      { params }
    ).pipe(
      tap(stats => {
        this._state.update(s => ({
          ...s,
          stats,
          isLoading: false
        }));
      }),
      catchError(error => {
        this._state.update(s => ({
          ...s,
          isLoading: false,
          error: 'Không thể tải thống kê'
        }));
        return of([]);
      })
    );
  }

  /**
   * Detect platform from product URL
   */
  detectPlatform(url: string): AffiliatePlatform | null {
    if (url.includes('shopee.vn') || url.includes('shopee.com')) {
      return AffiliatePlatform.SHOPEE;
    }
    if (url.includes('lazada.vn') || url.includes('lazada.com')) {
      return AffiliatePlatform.LAZADA;
    }
    if (url.includes('tiki.vn')) {
      return AffiliatePlatform.TIKI;
    }
    if (url.includes('longchau.com.vn')) {
      return AffiliatePlatform.LONG_CHAU;
    }
    if (url.includes('pharmacity.vn')) {
      return AffiliatePlatform.PHARMACITY;
    }
    return null;
  }

  /**
   * Get platform display name
   */
  getPlatformName(platform: AffiliatePlatform): string {
    const names: Record<AffiliatePlatform, string> = {
      [AffiliatePlatform.SHOPEE]: 'Shopee',
      [AffiliatePlatform.LAZADA]: 'Lazada',
      [AffiliatePlatform.TIKI]: 'Tiki',
      [AffiliatePlatform.SENDO]: 'Sendo',
      [AffiliatePlatform.LONG_CHAU]: 'Long Châu',
      [AffiliatePlatform.PHARMACITY]: 'Pharmacity',
      [AffiliatePlatform.OTOPARTS]: 'OtoParts'
    };
    return names[platform] || platform;
  }

  /**
   * Get platform logo URL
   */
  getPlatformLogo(platform: AffiliatePlatform): string {
    const logos: Partial<Record<AffiliatePlatform, string>> = {
      [AffiliatePlatform.SHOPEE]: '/assets/logos/shopee.svg',
      [AffiliatePlatform.LAZADA]: '/assets/logos/lazada.svg',
      [AffiliatePlatform.TIKI]: '/assets/logos/tiki.svg'
    };
    return logos[platform] || '/assets/logos/default-store.svg';
  }

  /**
   * Get platform color
   */
  getPlatformColor(platform: AffiliatePlatform): string {
    const colors: Record<AffiliatePlatform, string> = {
      [AffiliatePlatform.SHOPEE]: '#ee4d2d',
      [AffiliatePlatform.LAZADA]: '#0f146d',
      [AffiliatePlatform.TIKI]: '#1a94ff',
      [AffiliatePlatform.SENDO]: '#d0021b',
      [AffiliatePlatform.LONG_CHAU]: '#2f54eb',
      [AffiliatePlatform.PHARMACITY]: '#00a651',
      [AffiliatePlatform.OTOPARTS]: '#ff6b00'
    };
    return colors[platform] || '#666666';
  }
}
