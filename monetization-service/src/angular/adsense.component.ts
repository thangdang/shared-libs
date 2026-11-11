/**
 * AdSense Component - Angular Component for displaying Google AdSense ads
 * Only shows ads for free tier users
 */

import {
  Component,
  Input,
  OnInit,
  OnDestroy,
  ElementRef,
  inject,
  signal,
  effect,
  PLATFORM_ID
} from '@angular/core';
import { isPlatformBrowser, NgIf, NgClass } from '@angular/common';
import { MonetizationService } from './monetization.service';
import { AdPlacement, AdConfig } from '../types';

@Component({
  selector: 'lib-adsense',
  standalone: true,
  imports: [NgIf, NgClass],
  template: `
    @if (shouldShow() && adConfig()) {
      <div 
        class="adsense-container"
        [ngClass]="containerClass()"
        [attr.data-placement]="placement"
      >
        <ins 
          class="adsbygoogle"
          [style.display]="'block'"
          [attr.data-ad-client]="adConfig()?.clientId"
          [attr.data-ad-slot]="adConfig()?.slot"
          [attr.data-ad-format]="adConfig()?.format"
          [attr.data-full-width-responsive]="adConfig()?.responsive ? 'true' : 'false'"
          [attr.data-adtest]="adConfig()?.testMode ? 'on' : 'off'"
        ></ins>
        @if (adConfig()?.testMode) {
          <div class="test-mode-indicator">
            <span>Ad Placeholder (Test Mode)</span>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .adsense-container {
      width: 100%;
      min-height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f5f5f5;
      border-radius: 4px;
      overflow: hidden;
    }

    .adsense-container.header {
      min-height: 90px;
      margin-bottom: 16px;
    }

    .adsense-container.sidebar {
      min-height: 250px;
      margin-bottom: 16px;
    }

    .adsense-container.in-content {
      min-height: 250px;
      margin: 24px 0;
    }

    .adsense-container.footer {
      min-height: 90px;
      margin-top: 16px;
    }

    .adsense-container.interstitial {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 9999;
      background: rgba(0, 0, 0, 0.8);
      min-height: 100vh;
    }

    .test-mode-indicator {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      padding: 8px 16px;
      background: rgba(0, 0, 0, 0.7);
      color: #fff;
      border-radius: 4px;
      font-size: 12px;
    }

    .adsbygoogle {
      display: block;
      width: 100%;
    }
  `]
})
export class AdsenseComponent implements OnInit, OnDestroy {
  private monetization = inject(MonetizationService);
  private elementRef = inject(ElementRef);
  private platformId = inject(PLATFORM_ID);

  @Input({ required: true }) placement!: AdPlacement;
  @Input() customClass = '';

  // Signals for reactive state
  readonly shouldShow = signal(false);
  readonly adConfig = signal<AdConfig | null>(null);
  readonly containerClass = signal<string>('');

  private adLoaded = false;

  constructor() {
    // Effect to update ad visibility when subscription changes
    effect(() => {
      const showAds = this.monetization.shouldShowAds();
      this.shouldShow.set(showAds);
      
      if (showAds) {
        this.adConfig.set(this.monetization.getAdConfig(this.placement));
      } else {
        this.adConfig.set(null);
      }
    });
  }

  ngOnInit(): void {
    this.containerClass.set(this.getContainerClass());
    
    if (isPlatformBrowser(this.platformId)) {
      this.loadAdSenseScript();
    }
  }

  ngOnDestroy(): void {
    // Cleanup if needed
  }

  private getContainerClass(): string {
    const placementClass = this.placement.toLowerCase().replace('_', '-');
    return `${placementClass} ${this.customClass}`.trim();
  }

  private loadAdSenseScript(): void {
    if (this.adLoaded) return;

    const config = this.adConfig();
    if (!config || !config.clientId) return;

    // Check if script already exists
    const existingScript = document.querySelector(
      'script[src*="pagead2.googlesyndication.com"]'
    );

    if (!existingScript) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.clientId}`;
      script.async = true;
      script.crossOrigin = 'anonymous';
      document.head.appendChild(script);
    }

    // Push ad after script loads
    setTimeout(() => {
      try {
        ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        this.adLoaded = true;
      } catch (e) {
        console.warn('AdSense push failed:', e);
      }
    }, 100);
  }
}
