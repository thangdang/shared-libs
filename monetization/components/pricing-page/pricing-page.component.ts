/**
 * Pricing Page Component
 * Task:  MON-013
 * 
 * Displays subscription tier comparison and pricing.
 * Supports Free, Basic, and Premium tiers.
 * Handles VNPay/MoMo payment initiation.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Component, OnInit, inject, signal, computed, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface SubscriptionTier {
  id: string;
  name: string;
  nameVi: string;
  price: number;
  priceMonthly: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
  featuresVi: string[];
  limits: {
    [key: string]: number | boolean | string;
  };
  isPopular?: boolean;
  savingsPercent?: number;
}

export interface CurrentSubscription {
  tierId: string;
  expiresAt: string;
  isActive: boolean;
}

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="pricing-page">
      <!-- Header -->
      <header class="pricing-header">
        <h1>Chọn gói phù hợp với bạn</h1>
        <p class="subtitle">Bắt đầu miễn phí, nâng cấp khi cần</p>
        
        <!-- Billing Toggle -->
        <div class="billing-toggle">
          <span [class.active]="billingCycle() === 'monthly'">Hàng tháng</span>
          <label class="toggle">
            <input 
              type="checkbox" 
              [checked]="billingCycle() === 'yearly'"
              (change)="toggleBillingCycle()"
            />
            <span class="slider"></span>
          </label>
          <span [class.active]="billingCycle() === 'yearly'">
            Hàng năm
            <span class="savings-badge">Tiết kiệm 20%</span>
          </span>
        </div>
      </header>

      <!-- Pricing Grid -->
      <div class="pricing-grid">
        <div 
          *ngFor="let tier of displayedTiers()"
          class="pricing-card"
          [class.popular]="tier.isPopular"
          [class.current]="currentSubscription()?.tierId === tier.id"
        >
          <!-- Popular Badge -->
          <div class="popular-badge" *ngIf="tier.isPopular">
            Phổ biến nhất
          </div>

          <!-- Current Badge -->
          <div class="current-badge" *ngIf="currentSubscription()?.tierId === tier.id">
            Gói hiện tại
          </div>

          <!-- Tier Info -->
          <div class="tier-header">
            <h2>{{ tier.nameVi }}</h2>
            <div class="price-display">
              <span class="price">{{ formatPrice(tier.price) }}</span>
              <span class="period">/{{ billingCycle() === 'monthly' ? 'tháng' : 'năm' }}</span>
            </div>
            <p class="monthly-equivalent" *ngIf="billingCycle() === 'yearly' && tier.price > 0">
              Tương đương {{ formatPrice(tier.priceMonthly) }}/tháng
            </p>
          </div>

          <!-- Features List -->
          <ul class="features-list">
            <li *ngFor="let feature of tier.featuresVi" class="feature-item">
              <span class="check-icon">✓</span>
              {{ feature }}
            </li>
          </ul>

          <!-- Action Button -->
          <div class="tier-action">
            <button 
              *ngIf="tier.price === 0"
              class="btn-secondary"
              disabled
            >
              Miễn phí
            </button>
            
            <button 
              *ngIf="tier.price > 0 && currentSubscription()?.tierId !== tier.id"
              class="btn-primary"
              [class.popular]="tier.isPopular"
              (click)="selectTier(tier)"
            >
              {{ currentSubscription()?.tierId === 'free' ? 'Nâng cấp' : 'Chuyển đổi' }}
            </button>

            <button 
              *ngIf="currentSubscription()?.tierId === tier.id"
              class="btn-current"
              disabled
            >
              Đang sử dụng
            </button>
          </div>

          <!-- Savings Badge (for yearly) -->
          <div class="savings-info" *ngIf="tier.savingsPercent && billingCycle() === 'yearly'">
            Tiết kiệm {{ tier.savingsPercent }}%
          </div>
        </div>
      </div>

      <!-- Feature Comparison Table -->
      <section class="comparison-section">
        <h2>So sánh chi tiết</h2>
        
        <div class="comparison-table">
          <table>
            <thead>
              <tr>
                <th>Tính năng</th>
                <th *ngFor="let tier of displayedTiers()">{{ tier.nameVi }}</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let feature of comparisonFeatures">
                <td class="feature-name">{{ feature.nameVi }}</td>
                <td *ngFor="let tier of displayedTiers()">
                  <span *ngIf="getFeatureValue(tier, feature.key) === true" class="check">✓</span>
                  <span *ngIf="getFeatureValue(tier, feature.key) === false" class="cross">✕</span>
                  <span *ngIf="typeof getFeatureValue(tier, feature.key) !== 'boolean'">
                    {{ getFeatureValue(tier, feature.key) }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- FAQ Section -->
      <section class="faq-section">
        <h2>Câu hỏi thường gặp</h2>
        
        <div class="faq-list">
          <div class="faq-item" *ngFor="let faq of faqs">
            <button 
              class="faq-question"
              (click)="toggleFaq(faq.id)"
              [class.open]="openFaq() === faq.id"
            >
              {{ faq.question }}
              <span class="arrow">{{ openFaq() === faq.id ? '−' : '+' }}</span>
            </button>
            <div class="faq-answer" *ngIf="openFaq() === faq.id">
              {{ faq.answer }}
            </div>
          </div>
        </div>
      </section>

      <!-- Money Back Guarantee -->
      <div class="guarantee-banner">
        <span class="guarantee-icon">🛡️</span>
        <div class="guarantee-content">
          <strong>Hoàn tiền trong 7 ngày</strong>
          <p>Không hài lòng? Hoàn tiền 100% trong 7 ngày đầu, không cần lý do.</p>
        </div>
      </div>

      <!-- Payment Methods -->
      <div class="payment-methods">
        <span class="label">Thanh toán qua:</span>
        <div class="methods">
          <img src="/assets/payment/vnpay.svg" alt="VNPay" />
          <img src="/assets/payment/momo.svg" alt="MoMo" />
          <img src="/assets/payment/visa.svg" alt="Visa" />
          <img src="/assets/payment/mastercard.svg" alt="Mastercard" />
        </div>
      </div>
    </div>
  `,
  styles: [`
    .pricing-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* Header */
    .pricing-header {
      text-align: center;
      margin-bottom: 48px;
    }

    .pricing-header h1 {
      font-size: 2rem;
      color: #f3f4f6;
      margin: 0 0 12px 0;
    }

    .subtitle {
      color: #9ca3af;
      font-size: 1.1rem;
      margin: 0 0 24px 0;
    }

    /* Billing Toggle */
    .billing-toggle {
      display: inline-flex;
      align-items: center;
      gap: 16px;
      background: rgba(255, 255, 255, 0.05);
      padding: 8px 20px;
      border-radius: 30px;
    }

    .billing-toggle span {
      color: #6b7280;
      font-size: 0.9rem;
      transition: color 0.2s;
    }

    .billing-toggle span.active {
      color: #f3f4f6;
      font-weight: 500;
    }

    .toggle {
      position: relative;
      width: 48px;
      height: 26px;
      cursor: pointer;
    }

    .toggle input {
      opacity: 0;
      width: 0;
      height: 0;
    }

    .slider {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: #374151;
      border-radius: 13px;
      transition: background 0.3s;
    }

    .slider::before {
      content: '';
      position: absolute;
      width: 20px;
      height: 20px;
      left: 3px;
      bottom: 3px;
      background: white;
      border-radius: 50%;
      transition: transform 0.3s;
    }

    .toggle input:checked + .slider {
      background: #3b82f6;
    }

    .toggle input:checked + .slider::before {
      transform: translateX(22px);
    }

    .savings-badge {
      background: #22c55e;
      color: white;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.7rem;
      margin-left: 6px;
    }

    /* Pricing Grid */
    .pricing-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
      margin-bottom: 64px;
    }

    .pricing-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 20px;
      padding: 32px 24px;
      position: relative;
      transition: all 0.3s;
    }

    .pricing-card:hover {
      transform: translateY(-4px);
      border-color: rgba(59, 130, 246, 0.3);
    }

    .pricing-card.popular {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
      transform: scale(1.02);
    }

    .pricing-card.current {
      border-color: #22c55e;
    }

    .popular-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: #3b82f6;
      color: white;
      padding: 4px 16px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 600;
    }

    .current-badge {
      position: absolute;
      top: -12px;
      right: 20px;
      background: #22c55e;
      color: white;
      padding: 4px 12px;
      border-radius: 10px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .tier-header {
      text-align: center;
      margin-bottom: 24px;
      padding-bottom: 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .tier-header h2 {
      font-size: 1.25rem;
      color: #f3f4f6;
      margin: 0 0 16px 0;
    }

    .price-display {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 4px;
    }

    .price {
      font-size: 2.5rem;
      font-weight: 700;
      color: #f3f4f6;
    }

    .period {
      color: #6b7280;
      font-size: 1rem;
    }

    .monthly-equivalent {
      color: #9ca3af;
      font-size: 0.85rem;
      margin: 8px 0 0 0;
    }

    /* Features List */
    .features-list {
      list-style: none;
      padding: 0;
      margin: 0 0 24px 0;
    }

    .feature-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #d1d5db;
      padding: 8px 0;
      font-size: 0.9rem;
    }

    .check-icon {
      color: #22c55e;
      font-weight: bold;
      flex-shrink: 0;
    }

    /* Action Buttons */
    .tier-action {
      margin-top: auto;
    }

    .btn-primary,
    .btn-secondary,
    .btn-current {
      width: 100%;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      border: none;
    }

    .btn-primary {
      background: #3b82f6;
      color: white;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    .btn-primary.popular {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
    }

    .btn-secondary {
      background: #374151;
      color: #9ca3af;
    }

    .btn-secondary:disabled,
    .btn-current:disabled {
      cursor: default;
      opacity: 0.7;
    }

    .btn-current {
      background: #22c55e;
      color: white;
    }

    .savings-info {
      text-align: center;
      margin-top: 12px;
      color: #22c55e;
      font-size: 0.85rem;
      font-weight: 500;
    }

    /* Comparison Table */
    .comparison-section {
      margin-bottom: 64px;
    }

    .comparison-section h2 {
      text-align: center;
      font-size: 1.5rem;
      color: #f3f4f6;
      margin: 0 0 32px 0;
    }

    .comparison-table {
      overflow-x: auto;
    }

    .comparison-table table {
      width: 100%;
      border-collapse: collapse;
    }

    .comparison-table th,
    .comparison-table td {
      padding: 16px;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }

    .comparison-table th {
      background: rgba(255, 255, 255, 0.05);
      color: #f3f4f6;
      font-weight: 600;
    }

    .comparison-table th:first-child,
    .comparison-table td.feature-name {
      text-align: left;
      color: #d1d5db;
    }

    .comparison-table .check {
      color: #22c55e;
      font-weight: bold;
    }

    .comparison-table .cross {
      color: #6b7280;
    }

    /* FAQ Section */
    .faq-section {
      margin-bottom: 64px;
    }

    .faq-section h2 {
      text-align: center;
      font-size: 1.5rem;
      color: #f3f4f6;
      margin: 0 0 32px 0;
    }

    .faq-list {
      max-width: 700px;
      margin: 0 auto;
    }

    .faq-item {
      margin-bottom: 12px;
    }

    .faq-question {
      width: 100%;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: none;
      border-radius: 10px;
      color: #f3f4f6;
      font-size: 1rem;
      text-align: left;
      cursor: pointer;
      transition: background 0.2s;
    }

    .faq-question:hover {
      background: rgba(255, 255, 255, 0.05);
    }

    .faq-question.open {
      border-radius: 10px 10px 0 0;
    }

    .arrow {
      font-size: 1.25rem;
      color: #6b7280;
    }

    .faq-answer {
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 0 0 10px 10px;
      color: #9ca3af;
      line-height: 1.6;
    }

    /* Guarantee Banner */
    .guarantee-banner {
      display: flex;
      align-items: center;
      gap: 16px;
      max-width: 600px;
      margin: 0 auto 32px;
      padding: 20px 24px;
      background: rgba(34, 197, 94, 0.1);
      border: 1px solid rgba(34, 197, 94, 0.3);
      border-radius: 12px;
    }

    .guarantee-icon {
      font-size: 2rem;
    }

    .guarantee-content strong {
      color: #22c55e;
      display: block;
      margin-bottom: 4px;
    }

    .guarantee-content p {
      color: #9ca3af;
      font-size: 0.9rem;
      margin: 0;
    }

    /* Payment Methods */
    .payment-methods {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 20px;
      flex-wrap: wrap;
    }

    .payment-methods .label {
      color: #6b7280;
      font-size: 0.9rem;
    }

    .payment-methods .methods {
      display: flex;
      gap: 16px;
    }

    .payment-methods img {
      height: 30px;
      opacity: 0.7;
      filter: grayscale(50%);
      transition: all 0.2s;
    }

    .payment-methods img:hover {
      opacity: 1;
      filter: grayscale(0%);
    }

    /* Responsive */
    @media (max-width: 768px) {
      .pricing-page {
        padding: 24px 16px;
      }

      .pricing-header h1 {
        font-size: 1.5rem;
      }

      .pricing-grid {
        grid-template-columns: 1fr;
      }

      .pricing-card.popular {
        transform: none;
      }

      .price {
        font-size: 2rem;
      }

      .guarantee-banner {
        flex-direction: column;
        text-align: center;
      }
    }
  `]
})
export class PricingPageComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);

  // Inputs
  appName = input<string>('App');

  // State
  tiers = signal<SubscriptionTier[]>([]);
  currentSubscription = signal<CurrentSubscription | null>(null);
  billingCycle = signal<'monthly' | 'yearly'>('monthly');
  openFaq = signal<string | null>(null);
  loading = signal(true);

  // Computed
  displayedTiers = computed(() => {
    const cycle = this.billingCycle();
    return this.tiers().filter(t => t.billingCycle === cycle || t.price === 0);
  });

  // Comparison features
  comparisonFeatures = [
    { key: 'searches', nameVi: 'Lượt tra cứu/ngày' },
    { key: 'history', nameVi: 'Lưu lịch sử' },
    { key: 'export', nameVi: 'Xuất dữ liệu' },
    { key: 'alerts', nameVi: 'Thông báo giá/tin' },
    { key: 'ads', nameVi: 'Không quảng cáo' },
    { key: 'support', nameVi: 'Hỗ trợ ưu tiên' },
    { key: 'apiAccess', nameVi: 'API access' },
  ];

  // FAQ Data
  faqs = [
    {
      id: 'payment',
      question: 'Thanh toán như thế nào?',
      answer: 'Chúng tôi hỗ trợ thanh toán qua VNPay, MoMo, và thẻ quốc tế (Visa/Mastercard).  Thanh toán được xử lý an toàn và tự động gia hạn mỗi kỳ.'
    },
    {
      id: 'cancel',
      question: 'Tôi có thể hủy bất cứ lúc nào không?',
      answer: 'Có, bạn có thể hủy đăng ký bất cứ lúc nào.  Sau khi hủy, bạn vẫn được sử dụng dịch vụ cho đến hết kỳ thanh toán hiện tại.'
    },
    {
      id: 'refund',
      question: 'Chính sách hoàn tiền như thế nào?',
      answer: 'Chúng tôi hoàn tiền 100% trong 7 ngày đầu tiên nếu bạn không hài lòng, không cần lý do.  Sau 7 ngày, không hỗ trợ hoàn tiền cho thời gian đã sử dụng.'
    },
    {
      id: 'upgrade',
      question: 'Tôi có thể nâng cấp/hạ cấp gói không?',
      answer: 'Có, bạn có thể thay đổi gói bất cứ lúc nào.  Khi nâng cấp, chênh lệch sẽ được tính theo ngày còn lại.  Khi hạ cấp, thay đổi có hiệu lực từ kỳ tiếp theo.'
    },
    {
      id: 'data',
      question: 'Dữ liệu của tôi có an toàn không?',
      answer: 'Dữ liệu của bạn được mã hóa và bảo vệ theo tiêu chuẩn ngành.  Chúng tôi không bán hoặc chia sẻ dữ liệu cá nhân cho bên thứ ba.'
    }
  ];

  ngOnInit(): void {
    this.loadTiers();
    this.loadCurrentSubscription();
  }

  private loadTiers(): void {
    // Default tiers if API fails
    const defaultTiers: SubscriptionTier[] = [
      {
        id: 'free',
        name: 'Free',
        nameVi: 'Miễn phí',
        price: 0,
        priceMonthly: 0,
        billingCycle: 'monthly',
        features: [
          'Basic search',
          '10 searches/day',
          'Standard support'
        ],
        featuresVi: [
          'Tra cứu cơ bản',
          '10 lượt tra cứu/ngày',
          'Hỗ trợ tiêu chuẩn'
        ],
        limits: {
          searches: 10,
          history: false,
          export: false,
          alerts: false,
          ads: false,
          support: 'Tiêu chuẩn',
          apiAccess: false
        }
      },
      {
        id: 'basic-monthly',
        name: 'Basic',
        nameVi: 'Cơ bản',
        price: 49000,
        priceMonthly: 49000,
        billingCycle: 'monthly',
        features: [
          'Unlimited searches',
          'Save history',
          'Export data',
          'Basic alerts'
        ],
        featuresVi: [
          'Tra cứu không giới hạn',
          'Lưu lịch sử tra cứu',
          'Xuất dữ liệu CSV',
          'Thông báo cơ bản'
        ],
        limits: {
          searches: 'Không giới hạn',
          history: true,
          export: true,
          alerts: true,
          ads: false,
          support: 'Email',
          apiAccess: false
        }
      },
      {
        id: 'basic-yearly',
        name: 'Basic',
        nameVi: 'Cơ bản',
        price: 470000,
        priceMonthly: 39000,
        billingCycle: 'yearly',
        savingsPercent: 20,
        features: [
          'Unlimited searches',
          'Save history',
          'Export data',
          'Basic alerts'
        ],
        featuresVi: [
          'Tra cứu không giới hạn',
          'Lưu lịch sử tra cứu',
          'Xuất dữ liệu CSV',
          'Thông báo cơ bản'
        ],
        limits: {
          searches: 'Không giới hạn',
          history: true,
          export: true,
          alerts: true,
          ads: false,
          support: 'Email',
          apiAccess: false
        }
      },
      {
        id: 'premium-monthly',
        name: 'Premium',
        nameVi: 'Cao cấp',
        price: 99000,
        priceMonthly: 99000,
        billingCycle: 'monthly',
        isPopular: true,
        features: [
          'Everything in Basic',
          'No ads',
          'Priority support',
          'Advanced alerts',
          'API access'
        ],
        featuresVi: [
          'Tất cả tính năng Cơ bản',
          'Không quảng cáo',
          'Hỗ trợ ưu tiên',
          'Thông báo nâng cao',
          'Truy cập API'
        ],
        limits: {
          searches: 'Không giới hạn',
          history: true,
          export: true,
          alerts: true,
          ads: true,
          support: 'Ưu tiên 24/7',
          apiAccess: true
        }
      },
      {
        id: 'premium-yearly',
        name: 'Premium',
        nameVi: 'Cao cấp',
        price: 950000,
        priceMonthly: 79000,
        billingCycle: 'yearly',
        savingsPercent: 20,
        isPopular: true,
        features: [
          'Everything in Basic',
          'No ads',
          'Priority support',
          'Advanced alerts',
          'API access'
        ],
        featuresVi: [
          'Tất cả tính năng Cơ bản',
          'Không quảng cáo',
          'Hỗ trợ ưu tiên',
          'Thông báo nâng cao',
          'Truy cập API'
        ],
        limits: {
          searches: 'Không giới hạn',
          history: true,
          export: true,
          alerts: true,
          ads: true,
          support: 'Ưu tiên 24/7',
          apiAccess: true
        }
      }
    ];

    this.http.get<{ tiers: SubscriptionTier[] }>(
      `${environment.apiUrl}/api/subscriptions/tiers`
    ).pipe(
      catchError(() => of({ tiers: defaultTiers }))
    ).subscribe(response => {
      this.tiers.set(response.tiers);
      this.loading.set(false);
    });
  }

  private loadCurrentSubscription(): void {
    this.http.get<CurrentSubscription>(
      `${environment.apiUrl}/api/subscriptions/current`
    ).pipe(
      catchError(() => of({ tierId: 'free', expiresAt: '', isActive: true }))
    ).subscribe(subscription => {
      this.currentSubscription.set(subscription);
    });
  }

  toggleBillingCycle(): void {
    this.billingCycle.update(c => c === 'monthly' ? 'yearly' : 'monthly');
  }

  selectTier(tier: SubscriptionTier): void {
    this.router.navigate(['/checkout'], {
      queryParams: { tier: tier.id }
    });
  }

  toggleFaq(faqId: string): void {
    this.openFaq.update(id => id === faqId ? null : faqId);
  }

  getFeatureValue(tier: SubscriptionTier, key: string): any {
    return tier.limits[key];
  }

  formatPrice(price: number): string {
    if (price === 0) return 'Miễn phí';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(price);
  }
}
