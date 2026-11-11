/**
 * Affiliate Button Component
 * Call-to-action button for purchasing via affiliate link
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
  selector: 'lib-affiliate-button',
  standalone: true,
  imports: [NgIf, NgClass, CurrencyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [href]="trackingUrl()"
      target="_blank"
      rel="noopener noreferrer"
      class="affiliate-button"
      [ngClass]="[size, variant]"
      [style.--platform-color]="platformColor()"
      (click)="onButtonClick($event)"
    >
      @if (showPlatformBadge) {
        <span class="platform-badge">
          <img [src]="platformLogo()" [alt]="platformName()" />
        </span>
      }

      <span class="button-content">
        @if (price && showPrice) {
          <span class="price">
            {{ price | currency:'VND':'symbol':'1.0-0':'vi' }}
          </span>
        }
        
        <span class="cta">
          <ng-content>{{ ctaText }}</ng-content>
        </span>

        @if (originalPrice && originalPrice > (price || 0)) {
          <span class="discount-badge">
            -{{ discountPercent() }}%
          </span>
        }
      </span>

      <svg class="arrow-icon" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M3 10a.75.75 0 01.75-.75h10.638L10.23 5.29a.75.75 0 111.04-1.08l5.5 5.25a.75.75 0 010 1.08l-5.5 5.25a.75.75 0 11-1.04-1.08l4.158-3.96H3.75A.75.75 0 013 10z" clip-rule="evenodd"/>
      </svg>
    </a>
  `,
  styles: [`
    .affiliate-button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 14px 24px;
      background: var(--platform-color, linear-gradient(135deg, #ee4d2d 0%, #f4511e 100%));
      color: #fff;
      border-radius: 10px;
      text-decoration: none;
      font-weight: 600;
      transition: all 0.2s ease;
      cursor: pointer;
      position: relative;
      overflow: hidden;
    }

    .affiliate-button:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
    }

    .affiliate-button:active {
      transform: translateY(0);
    }

    /* Sizes */
    .affiliate-button.small {
      padding: 10px 16px;
      font-size: 14px;
    }

    .affiliate-button.large {
      padding: 18px 32px;
      font-size: 18px;
    }

    .affiliate-button.full {
      width: 100%;
    }

    /* Variants */
    .affiliate-button.outlined {
      background: transparent;
      border: 2px solid var(--platform-color, #ee4d2d);
      color: var(--platform-color, #ee4d2d);
    }

    .affiliate-button.outlined:hover {
      background: var(--platform-color, #ee4d2d);
      color: #fff;
    }

    .platform-badge {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      background: rgba(255, 255, 255, 0.2);
      border-radius: 6px;
    }

    .platform-badge img {
      width: 20px;
      height: 20px;
      object-fit: contain;
    }

    .button-content {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: 2px;
    }

    .price {
      font-size: 20px;
      font-weight: 800;
    }

    .affiliate-button.small .price {
      font-size: 16px;
    }

    .affiliate-button.large .price {
      font-size: 24px;
    }

    .cta {
      font-size: 14px;
      opacity: 0.9;
    }

    .discount-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: #fbbf24;
      color: #92400e;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: 700;
    }

    .arrow-icon {
      width: 20px;
      height: 20px;
      transition: transform 0.2s ease;
    }

    .affiliate-button:hover .arrow-icon {
      transform: translateX(4px);
    }
  `]
})
export class AffiliateButtonComponent implements OnInit {
  private affiliateService = inject(AffiliateAngularService);

  @Input({ required: true }) url!: string;
  @Input() price?: number;
  @Input() originalPrice?: number;
  @Input() platform?: AffiliatePlatform;
  @Input() size: 'small' | 'medium' | 'large' | 'full' = 'medium';
  @Input() variant: 'solid' | 'outlined' = 'solid';
  @Input() showPrice = true;
  @Input() showPlatformBadge = false;
  @Input() ctaText = 'Mua ngay';

  @Output() clicked = new EventEmitter<void>();

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

  readonly platformColor = computed(() => {
    const platform = this._platform();
    return platform ? this.affiliateService.getPlatformColor(platform) : '#ee4d2d';
  });

  readonly discountPercent = computed(() => {
    if (!this.originalPrice || !this.price || this.originalPrice <= this.price) {
      return 0;
    }
    return Math.round((1 - this.price / this.originalPrice) * 100);
  });

  ngOnInit(): void {
    // Detect platform
    this._platform.set(
      this.platform || this.affiliateService.detectPlatform(this.url)
    );

    // Generate affiliate link
    this.affiliateService.generateLink({
      originalUrl: this.url,
      platform: this._platform() || undefined
    }).subscribe(link => {
      if (link) {
        this._link.set(link);
      }
    });
  }

  onButtonClick(event: MouseEvent): void {
    this.clicked.emit();

    // Track click
    const link = this._link();
    if (link) {
      this.affiliateService.trackClick(link.id, {
        price: this.price,
        originalPrice: this.originalPrice
      });
    }
  }
}
