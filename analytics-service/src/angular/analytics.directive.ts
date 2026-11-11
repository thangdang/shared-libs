/**
 * Angular Analytics Directives - Nov 2026 Release
 * 
 * Directives for easy event tracking in templates.
 * 
 * Usage:
 * ```html
 * <button trackClick="buy_button" [trackCategory]="'product'" [trackValue]="price">
 *   Mua ngay
 * </button>
 * 
 * <a trackExternalClick="shopee" [trackUrl]="product.shopeeUrl">
 *   Xem trên Shopee
 * </a>
 * ```
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Directive, Input, HostListener, inject } from '@angular/core';
import { AnalyticsService } from './analytics.service';

// ═══════════════════════════════════════════════════════════════
//  CLICK TRACKING DIRECTIVE
// ═══════════════════════════════════════════════════════════════

/**
 * Track click events
 * 
 * Usage:
 * ```html
 * <button trackClick="subscribe_button">Subscribe</button>
 * ```
 */
@Directive({
  selector: '[trackClick]',
  standalone: true,
})
export class TrackClickDirective {
  private readonly analytics = inject(AnalyticsService);

  /** Event label */
  @Input({ required: true }) trackClick!: string;
  
  /** Event category */
  @Input() trackCategory?: string;
  
  /** Event value */
  @Input() trackValue?: number;

  @HostListener('click')
  onClick(): void {
    this.analytics.trackClick(this.trackClick, this.trackCategory, this.trackValue);
  }
}

// ═══════════════════════════════════════════════════════════════
//  EXTERNAL CLICK TRACKING DIRECTIVE
// ═══════════════════════════════════════════════════════════════

/**
 * Track clicks to external links (e.g., affiliate links)
 * 
 * Usage:
 * ```html
 * <a trackExternalClick="shopee" [trackUrl]="product.url" [href]="product.url">
 *   View on Shopee
 * </a>
 * ```
 */
@Directive({
  selector: '[trackExternalClick]',
  standalone: true,
})
export class TrackExternalClickDirective {
  private readonly analytics = inject(AnalyticsService);

  /** Platform/destination name */
  @Input({ required: true }) trackExternalClick!: string;
  
  /** Destination URL */
  @Input() trackUrl?: string;
  
  /** Item ID (if applicable) */
  @Input() trackItemId?: string;

  @HostListener('click')
  onClick(): void {
    this.analytics.trackEvent('external_click', {
      event_category: 'outbound',
      event_label: this.trackExternalClick,
      destination_url: this.trackUrl,
      item_id: this.trackItemId,
    } as Record<string, unknown>);
  }
}

// ═══════════════════════════════════════════════════════════════
//  VIEW TRACKING DIRECTIVE
// ═══════════════════════════════════════════════════════════════

/**
 * Track when element becomes visible (using IntersectionObserver)
 * 
 * Usage:
 * ```html
 * <div trackView="product_card" [trackItemId]="product.id">
 *   Product content
 * </div>
 * ```
 */
@Directive({
  selector: '[trackView]',
  standalone: true,
})
export class TrackViewDirective {
  private readonly analytics = inject(AnalyticsService);
  private tracked = false;

  /** Event label */
  @Input({ required: true }) trackView!: string;
  
  /** Item ID */
  @Input() trackItemId?: string;
  
  /** Event category */
  @Input() trackCategory?: string;

  // Note:  In a real implementation, you'd use IntersectionObserver
  // This is a simplified version that tracks on init
  ngOnInit(): void {
    if (!this.tracked) {
      this.analytics.trackEvent('view_content', {
        event_category: this.trackCategory || 'content',
        event_label: this.trackView,
        item_id: this.trackItemId,
      } as Record<string, unknown>);
      this.tracked = true;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
//  SHARE TRACKING DIRECTIVE
// ═══════════════════════════════════════════════════════════════

/**
 * Track share actions
 * 
 * Usage:
 * ```html
 * <button trackShare="facebook" [trackContentType]="'article'" [trackItemId]="article.id">
 *   Share on Facebook
 * </button>
 * ```
 */
@Directive({
  selector: '[trackShare]',
  standalone: true,
})
export class TrackShareDirective {
  private readonly analytics = inject(AnalyticsService);

  /** Share method (facebook, twitter, copy_link, etc.) */
  @Input({ required: true }) trackShare!: string;
  
  /** Content type (article, product, etc.) */
  @Input() trackContentType = 'content';
  
  /** Item ID */
  @Input() trackItemId?: string;

  @HostListener('click')
  onClick(): void {
    this.analytics.trackShare(
      this.trackShare,
      this.trackContentType,
      this.trackItemId || ''
    );
  }
}
