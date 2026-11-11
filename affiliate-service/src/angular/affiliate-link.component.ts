/**
 * Affiliate Link Component
 * Displays a product link with affiliate tracking
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  OnInit,
  signal,
  computed,
  ChangeDetectionStrategy
} from '@angular/core';
import { NgIf, NgClass, CurrencyPipe } from '@angular/common';
import { AffiliateAngularService } from './affiliate.service';
import { AffiliatePlatform, AffiliateLink } from '../types';

@Component({
  selector: 'lib-affiliate-link',
  standalone: true,
  imports: [NgIf, NgClass, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [href]="trackingUrl()"
      target="_blank"
      rel="noopener noreferrer"
      class="affiliate-link"
      [ngClass]="variant"
      (click)="onLinkClick($event)"
    >
      @if (showLogo) {
        <img
          [src]="platformLogo()"
          [alt]="platformName()"
          class="platform-logo"
        />
      }
      
      <div class="link-content">
        @if (productName) {
          <span class="product-name">{{ productName }}</span>
        }
        
        @if (price) {
          <span class="product-price">
            {{ price | currency:'VND':'symbol':'1.0-0':'vi' }}
          </span>
        }
        
        <span class="cta-text">
          <ng-content>Xem trên {{ platformName() }}</ng-content>
        </span>
      </div>

      <svg class="external-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 012 14.75v-8.5A2.25 2.25 0 014.25 4h5a.75.75 0 010 1.5h-5z" clip-rule="evenodd"/>
        <path fill-rule="evenodd" d="M6.194 12.753a.75.75 0 001.06.053L16.5 4.44v2.81a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75h-4.5a.75.75 0 000 1.5h2.553l-9.056 8.194a.75.75 0 00-.053 1.06z" clip-rule="evenodd"/>
      </svg>
    </a>
  `,
  styles: [`
    .affiliate-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 10px 16px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      text-decoration: none;
      color: #1f2937;
      transition: all 0.2s ease;
      cursor: pointer;
    }

    .affiliate-link:hover {
      border-color: var(--platform-color, #3b82f6);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    .affiliate-link.button {
      background: var(--platform-color, #3b82f6);
      color: #fff;
      border: none;
      font-weight: 600;
    }

    .affiliate-link.button:hover {
      filter: brightness(1.1);
    }

    .affiliate-link.compact {
      padding: 6px 12px;
      font-size: 14px;
    }

    .affiliate-link.full-width {
      width: 100%;
      justify-content: center;
    }

    .platform-logo {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    .link-content {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .product-name {
      font-size: 14px;
      font-weight: 500;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 200px;
    }

    .product-price {
      font-size: 16px;
      font-weight: 700;
      color: #dc2626;
    }

    .affiliate-link.button .product-price {
      color: #fef08a;
    }

    .cta-text {
      font-size: 13px;
    }

    .external-icon {
      width: 16px;
      height: 16px;
      opacity: 0.6;
      flex-shrink: 0;
    }
  `]
})
export class AffiliateLinkComponent implements OnInit {
  private affiliateService = inject(AffiliateAngularService);

  @Input({ required: true }) url!: string;
  @Input() productName?: string;
  @Input() price?: number;
  @Input() platform?: AffiliatePlatform;
  @Input() variant: 'default' | 'button' | 'compact' | 'full-width' = 'default';
  @Input() showLogo = true;

  @Output() clicked = new EventEmitter<{ url: string; platform: AffiliatePlatform | null }>();

  private _link = signal<AffiliateLink | null>(null);
  private _platform = signal<AffiliatePlatform | null>(null);

  readonly trackingUrl = computed(() => {
    const link = this._link();
    if (link) {
      return this.affiliateService.getTrackingUrl(link.id);
    }
    return this.url;
  });

  readonly platformName = computed(() => {
    const platform = this._platform();
    return platform ? this.affiliateService.getPlatformName(platform) : 'Cửa hàng';
  });

  readonly platformLogo = computed(() => {
    const platform = this._platform();
    return platform ? this.affiliateService.getPlatformLogo(platform) : '';
  });

  ngOnInit(): void {
    // Detect platform
    this._platform.set(
      this.platform || this.affiliateService.detectPlatform(this.url)
    );

    // Generate affiliate link
    this.affiliateService.generateLink({
      originalUrl: this.url,
      platform: this._platform() || undefined,
      productName: this.productName
    }).subscribe(link => {
      if (link) {
        this._link.set(link);
      }
    });
  }

  onLinkClick(event: MouseEvent): void {
    const platform = this._platform();
    this.clicked.emit({ url: this.url, platform });

    // Track click
    const link = this._link();
    if (link) {
      this.affiliateService.trackClick(link.id);
    }
  }
}
