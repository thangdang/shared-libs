/**
 * Pricing Page Component
 * 
 * Reusable pricing page for all apps
 * Tasks: MON-013
 */

import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface PricingTier {
  id: string;
  name: string;
  nameVi: string;
  price: {
    monthly: number;
    quarterly: number;
    yearly: number;
  };
  features: string[];
  featuresVi: string[];
  highlight?: boolean;
  badge?: string;
  description?: string;
}

export interface SubscribeEvent {
  tierId: string;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pricing-container">
      <div class="pricing-header">
        <h1 class="pricing-title">{{ title }}</h1>
        <p class="pricing-subtitle">{{ subtitle }}</p>
        
        <!-- Billing cycle toggle -->
        <div class="billing-toggle">
          <button 
            [class.active]="billingCycle() === 'monthly'"
            (click)="setBillingCycle('monthly')"
          >
            Tháng
          </button>
          <button 
            [class.active]="billingCycle() === 'quarterly'"
            (click)="setBillingCycle('quarterly')"
          >
            Quý
            <span class="discount-badge">-10%</span>
          </button>
          <button 
            [class.active]="billingCycle() === 'yearly'"
            (click)="setBillingCycle('yearly')"
          >
            Năm
            <span class="discount-badge">-20%</span>
          </button>
        </div>
      </div>

      <div class="pricing-grid">
        @for (tier of tiers; track tier.id) {
          <div 
            class="pricing-card"
            [class.highlighted]="tier.highlight"
            [class.current]="tier.id === currentTier"
          >
            @if (tier.badge) {
              <span class="tier-badge">{{ tier.badge }}</span>
            }
            
            <div class="tier-header">
              <h2 class="tier-name">{{ tier.nameVi }}</h2>
              <p class="tier-description">{{ tier.description }}</p>
            </div>

            <div class="tier-price">
              @if (tier.price.monthly === 0) {
                <span class="price-amount">Miễn phí</span>
              } @else {
                <span class="price-amount">{{ formatPrice(getPrice(tier)) }}</span>
                <span class="price-period">/{{ getPeriodLabel() }}</span>
              }
            </div>

            @if (tier.price.monthly > 0 && billingCycle() !== 'monthly') {
              <div class="price-savings">
                Tiết kiệm {{ formatPrice(getSavings(tier)) }}
              </div>
            }

            <ul class="tier-features">
              @for (feature of tier.featuresVi; track $index) {
                <li>
                  <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                  {{ feature }}
                </li>
              }
            </ul>

            <button 
              class="subscribe-btn"
              [class.primary]="tier.highlight"
              [class.current]="tier.id === currentTier"
              [disabled]="tier.id === currentTier || loading()"
              (click)="onSubscribe(tier)"
            >
              @if (loading() && selectedTier() === tier.id) {
                <span class="loading-spinner"></span>
              } @else if (tier.id === currentTier) {
                Gói hiện tại
              } @else if (tier.price.monthly === 0) {
                Bắt đầu miễn phí
              } @else {
                Đăng ký ngay
              }
            </button>
          </div>
        }
      </div>

      <div class="pricing-footer">
        <p class="guarantee">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
            <polyline points="9 12 11 14 15 10"></polyline>
          </svg>
          Hoàn tiền trong 7 ngày nếu không hài lòng
        </p>
        <p class="payment-methods">
          Thanh toán qua:  VNPay • MoMo • ZaloPay • Chuyển khoản
        </p>
      </div>
    </div>
  `,
  styles: [`
    .pricing-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 2rem;
    }

    .pricing-header {
      text-align: center;
      margin-bottom: 3rem;
    }

    .pricing-title {
      font-size: 2.5rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text-primary, #1a1a1a);
    }

    .pricing-subtitle {
      font-size: 1.125rem;
      color: var(--text-secondary, #666);
      margin-bottom: 2rem;
    }

    .billing-toggle {
      display: inline-flex;
      background: var(--bg-secondary, #f5f5f5);
      border-radius: 8px;
      padding: 4px;
      gap: 4px;
    }

    .billing-toggle button {
      position: relative;
      padding: 0.75rem 1.5rem;
      border: none;
      background: transparent;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 500;
      color: var(--text-secondary, #666);
      transition: all 0.2s;
    }

    .billing-toggle button.active {
      background: white;
      color: var(--primary, #4f46e5);
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    .discount-badge {
      position: absolute;
      top: -8px;
      right: -8px;
      background: var(--success, #22c55e);
      color: white;
      font-size: 0.625rem;
      padding: 2px 6px;
      border-radius: 10px;
      font-weight: 600;
    }

    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 2rem;
      margin-bottom: 3rem;
    }

    .pricing-card {
      position: relative;
      background: white;
      border-radius: 16px;
      padding: 2rem;
      border: 1px solid var(--border, #e5e5e5);
      transition: transform 0.2s, box-shadow 0.2s;
    }

    .pricing-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px rgba(0,0,0,0.1);
    }

    .pricing-card.highlighted {
      border-color: var(--primary, #4f46e5);
      box-shadow: 0 8px 16px rgba(79, 70, 229, 0.15);
    }

    .pricing-card.current {
      background: var(--bg-tertiary, #f8f8f8);
    }

    .tier-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--primary, #4f46e5);
      color: white;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .tier-header {
      text-align: center;
      margin-bottom: 1.5rem;
    }

    .tier-name {
      font-size: 1.5rem;
      font-weight: 700;
      margin-bottom: 0.25rem;
    }

    .tier-description {
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
    }

    .tier-price {
      text-align: center;
      margin-bottom: 0.5rem;
    }

    .price-amount {
      font-size: 2.5rem;
      font-weight: 700;
      color: var(--text-primary, #1a1a1a);
    }

    .price-period {
      font-size: 1rem;
      color: var(--text-secondary, #666);
    }

    .price-savings {
      text-align: center;
      font-size: 0.875rem;
      color: var(--success, #22c55e);
      margin-bottom: 1.5rem;
    }

    .tier-features {
      list-style: none;
      padding: 0;
      margin: 0 0 2rem;
    }

    .tier-features li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.5rem 0;
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
    }

    .check-icon {
      width: 20px;
      height: 20px;
      color: var(--success, #22c55e);
      stroke-width: 2;
    }

    .subscribe-btn {
      width: 100%;
      padding: 1rem;
      border: 2px solid var(--border, #e5e5e5);
      border-radius: 8px;
      background: transparent;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .subscribe-btn:hover:not(:disabled) {
      border-color: var(--primary, #4f46e5);
      color: var(--primary, #4f46e5);
    }

    .subscribe-btn.primary {
      background: var(--primary, #4f46e5);
      border-color: var(--primary, #4f46e5);
      color: white;
    }

    .subscribe-btn.primary:hover:not(:disabled) {
      background: var(--primary-dark, #4338ca);
    }

    .subscribe-btn.current {
      background: var(--bg-secondary, #f5f5f5);
      color: var(--text-secondary, #666);
      cursor: default;
    }

    .subscribe-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .loading-spinner {
      display: inline-block;
      width: 20px;
      height: 20px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .pricing-footer {
      text-align: center;
      color: var(--text-secondary, #666);
    }

    .guarantee {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-bottom: 0.5rem;
    }

    .guarantee svg {
      width: 20px;
      height: 20px;
      color: var(--success, #22c55e);
    }

    .payment-methods {
      font-size: 0.875rem;
    }

    @media (max-width: 768px) {
      .pricing-container {
        padding: 1rem;
      }

      .pricing-title {
        font-size: 1.75rem;
      }

      .billing-toggle {
        flex-direction: column;
        width: 100%;
      }

      .billing-toggle button {
        width: 100%;
      }

      .pricing-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class PricingPageComponent implements OnInit {
  @Input() title = 'Chọn gói phù hợp với bạn';
  @Input() subtitle = 'Nâng cấp để mở khóa toàn bộ tính năng';
  @Input() tiers: PricingTier[] = [];
  @Input() currentTier?: string;
  @Input() appId = '';

  @Output() subscribe = new EventEmitter<SubscribeEvent>();

  billingCycle = signal<'monthly' | 'quarterly' | 'yearly'>('monthly');
  loading = signal(false);
  selectedTier = signal<string | null>(null);

  ngOnInit(): void {
    if (!this.tiers.length) {
      this.tiers = this.getDefaultTiers();
    }
  }

  setBillingCycle(cycle: 'monthly' | 'quarterly' | 'yearly'): void {
    this.billingCycle.set(cycle);
  }

  getPrice(tier: PricingTier): number {
    return tier.price[this.billingCycle()];
  }

  getSavings(tier: PricingTier): number {
    const monthlyTotal = tier.price.monthly * (this.billingCycle() === 'quarterly' ? 3 : 12);
    const actualPrice = this.getPrice(tier);
    return monthlyTotal - actualPrice;
  }

  getPeriodLabel(): string {
    switch (this.billingCycle()) {
      case 'quarterly': return 'quý';
      case 'yearly': return 'năm';
      default: return 'tháng';
    }
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  }

  onSubscribe(tier: PricingTier): void {
    this.selectedTier.set(tier.id);
    this.loading.set(true);
    
    this.subscribe.emit({
      tierId: tier.id,
      billingCycle: this.billingCycle()
    });
  }

  private getDefaultTiers(): PricingTier[] {
    return [
      {
        id: 'free',
        name: 'Free',
        nameVi: 'Miễn phí',
        price: { monthly: 0, quarterly: 0, yearly: 0 },
        features: [
          'Basic features',
          '100 API calls/month',
          'Community support',
          'Ads enabled'
        ],
        featuresVi: [
          'Tính năng cơ bản',
          '100 lượt gọi API/tháng',
          'Hỗ trợ cộng đồng',
          'Có quảng cáo'
        ],
        description: 'Trải nghiệm cơ bản'
      },
      {
        id: 'basic',
        name: 'Basic',
        nameVi: 'Cơ bản',
        price: { monthly: 49000, quarterly: 129000, yearly: 490000 },
        features: [
          'No ads',
          '1,000 API calls/month',
          'Extended history',
          'Email support'
        ],
        featuresVi: [
          'Không quảng cáo',
          '1.000 lượt gọi API/tháng',
          'Lịch sử mở rộng',
          'Hỗ trợ qua email'
        ],
        description: 'Không quảng cáo, nhiều tính năng hơn'
      },
      {
        id: 'premium',
        name: 'Premium',
        nameVi: 'Cao cấp',
        price: { monthly: 99000, quarterly: 269000, yearly: 990000 },
        features: [
          'All Basic features',
          'AI features enabled',
          '10,000 API calls/month',
          'Priority support'
        ],
        featuresVi: [
          'Tất cả tính năng Cơ bản',
          'Bật tính năng AI',
          '10.000 lượt gọi API/tháng',
          'Hỗ trợ ưu tiên'
        ],
        description: 'Đầy đủ tính năng AI',
        highlight: true,
        badge: 'Phổ biến nhất'
      },
      {
        id: 'enterprise',
        name: 'Enterprise',
        nameVi: 'Doanh nghiệp',
        price: { monthly: 499000, quarterly: 1299000, yearly: 4990000 },
        features: [
          'All Premium features',
          'Unlimited API calls',
          'API access',
          'Custom reports',
          'Dedicated support'
        ],
        featuresVi: [
          'Tất cả tính năng Cao cấp',
          'Không giới hạn API',
          'Truy cập API',
          'Báo cáo tùy chỉnh',
          'Hỗ trợ riêng'
        ],
        description: 'Không giới hạn, tùy chỉnh hoàn toàn'
      }
    ];
  }
}
