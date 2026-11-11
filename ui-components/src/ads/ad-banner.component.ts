/**
 * Ad Banner Component
 * 
 * Reusable ad display component with premium user exemption
 * Tasks: MON-024, MON-025
 */

import { 
  Component, 
  Input, 
  OnInit, 
  OnDestroy, 
  ChangeDetectionStrategy, 
  signal, 
  inject,
  ElementRef,
  AfterViewInit,
  PLATFORM_ID
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';

export type AdSize = 'banner' | 'leaderboard' | 'rectangle' | 'skyscraper' | 'mobile';

interface AdConfig {
  width: number;
  height: number;
  slot: string;
}

@Component({
  selector: 'app-ad-banner',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (!isPremium && !adBlocked()) {
      <div 
        class="ad-container"
        [class]="'ad-' + size"
        [style.width.px]="adConfig.width"
        [style.height.px]="adConfig.height"
      >
        @if (loading()) {
          <div class="ad-placeholder">
            <div class="ad-skeleton"></div>
          </div>
        } @else if (error()) {
          <!-- Show fallback or nothing on error -->
        } @else {
          <div #adSlot class="ad-slot" [id]="'ad-slot-' + adId"></div>
        }
        
        <span class="ad-label">Quảng cáo</span>
      </div>
    }
  `,
  styles: [`
    .ad-container {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--bg-secondary, #f5f5f5);
      border-radius: 4px;
      overflow: hidden;
    }

    .ad-banner {
      max-width: 100%;
    }

    .ad-leaderboard {
      width: 728px;
      height: 90px;
    }

    .ad-rectangle {
      width: 300px;
      height: 250px;
    }

    .ad-skyscraper {
      width: 160px;
      height: 600px;
    }

    .ad-mobile {
      width: 320px;
      height: 50px;
    }

    .ad-placeholder {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ad-skeleton {
      width: 80%;
      height: 60%;
      background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
      border-radius: 4px;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .ad-slot {
      width: 100%;
      height: 100%;
    }

    .ad-label {
      position: absolute;
      top: 4px;
      right: 4px;
      font-size: 9px;
      color: var(--text-tertiary, #999);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    @media (max-width: 768px) {
      .ad-leaderboard {
        width: 320px;
        height: 50px;
      }

      .ad-rectangle {
        width: 300px;
        height: 250px;
      }

      .ad-skyscraper {
        display: none;
      }
    }
  `]
})
export class AdBannerComponent implements OnInit, AfterViewInit, OnDestroy {
  @Input() size: AdSize = 'banner';
  @Input() isPremium = false;
  @Input() adUnit = '';

  private platformId = inject(PLATFORM_ID);
  private elementRef = inject(ElementRef);

  adId = Math.random().toString(36).substring(7);
  loading = signal(true);
  error = signal(false);
  adBlocked = signal(false);

  private observer?: IntersectionObserver;
  private loadTimeout?: ReturnType<typeof setTimeout>;

  readonly AD_CONFIGS: Record<AdSize, AdConfig> = {
    banner: { width: 468, height: 60, slot: 'banner-slot' },
    leaderboard: { width: 728, height: 90, slot: 'leaderboard-slot' },
    rectangle: { width: 300, height: 250, slot: 'rectangle-slot' },
    skyscraper: { width: 160, height: 600, slot: 'skyscraper-slot' },
    mobile: { width: 320, height: 50, slot: 'mobile-slot' }
  };

  get adConfig(): AdConfig {
    return this.AD_CONFIGS[this.size];
  }

  ngOnInit(): void {
    if (this.isPremium) return;

    // Check for ad blocker
    this.detectAdBlocker();
  }

  ngAfterViewInit(): void {
    if (this.isPremium || !isPlatformBrowser(this.platformId)) return;

    // Use Intersection Observer for lazy loading
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    if (this.loadTimeout) {
      clearTimeout(this.loadTimeout);
    }
  }

  private setupIntersectionObserver(): void {
    if (!('IntersectionObserver' in window)) {
      this.loadAd();
      return;
    }

    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          this.loadAd();
          this.observer?.disconnect();
        }
      },
      { rootMargin: '100px' }
    );

    this.observer.observe(this.elementRef.nativeElement);
  }

  private async loadAd(): Promise<void> {
    if (this.adBlocked()) return;

    try {
      // Simulate ad loading (replace with actual Google AdSense or similar)
      this.loadTimeout = setTimeout(() => {
        this.loading.set(false);
        this.initGoogleAd();
      }, 500);
    } catch (err) {
      console.error('Ad loading error:', err);
      this.error.set(true);
      this.loading.set(false);
    }
  }

  private initGoogleAd(): void {
    // Google AdSense integration
    if (typeof (window as any).adsbygoogle !== 'undefined') {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
      } catch (e) {
        console.error('AdSense error:', e);
        this.error.set(true);
      }
    }
  }

  private detectAdBlocker(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    // Simple ad blocker detection
    const testAd = document.createElement('div');
    testAd.innerHTML = '&nbsp;';
    testAd.className = 'adsbox ad-banner pub_300x250';
    testAd.style.cssText = 'position:absolute;left:-10000px;top:-10000px;';
    document.body.appendChild(testAd);

    setTimeout(() => {
      if (testAd.offsetHeight === 0) {
        this.adBlocked.set(true);
      }
      testAd.remove();
    }, 100);
  }
}

/**
 * Ad-Free Zone Component
 * Shows content without ads for premium users
 */
@Component({
  selector: 'app-ad-free-zone',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ad-free-zone" [class.premium]="isPremium">
      <ng-content></ng-content>
      
      @if (!isPremium && showUpgradeHint) {
        <div class="upgrade-hint">
          <span>Bạn muốn bỏ quảng cáo?</span>
          <a [href]="upgradeUrl">Nâng cấp Premium</a>
        </div>
      }
    </div>
  `,
  styles: [`
    .ad-free-zone {
      position: relative;
    }

    .upgrade-hint {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      padding: 0.5rem;
      background: var(--bg-secondary, #f5f5f5);
      border-radius: 4px;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }

    .upgrade-hint a {
      color: var(--primary, #4f46e5);
      text-decoration: none;
      font-weight: 500;
    }

    .upgrade-hint a:hover {
      text-decoration: underline;
    }
  `]
})
export class AdFreeZoneComponent {
  @Input() isPremium = false;
  @Input() showUpgradeHint = true;
  @Input() upgradeUrl = '/pricing';
}
