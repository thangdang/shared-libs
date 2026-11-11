/**
 * Pricing Card Component - Displays subscription tier pricing
 * Used in pricing pages across all apps
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  computed
} from '@angular/core';
import { NgIf, NgFor, NgClass } from '@angular/common';
import { MonetizationService } from './monetization.service';
import { SubscriptionTier } from '../types';
import { PRICING_CONFIG, formatVND } from '../pricing';

@Component({
  selector: 'lib-pricing-card',
  standalone: true,
  imports: [NgIf, NgFor, NgClass],
  template: `
    <div 
      class="pricing-card"
      [ngClass]="{
        'popular': tier === 'premium',
        'current': isCurrentTier()
      }"
    >
      @if (tier === 'premium') {
        <div class="popular-badge">Phổ biến nhất</div>
      }
      
      <div class="tier-header">
        <h3 class="tier-name">{{ tierConfig().name }}</h3>
        <div class="tier-price">
          <span class="amount">{{ formatPrice(tierConfig().price.monthly) }}</span>
          <span class="period">/tháng</span>
        </div>
        @if (tierConfig().price.monthly > 0) {
          <div class="yearly-price">
            hoặc {{ formatPrice(tierConfig().price.yearly) }}/năm
            <span class="savings">(Tiết kiệm {{ yearlySavings() }})</span>
          </div>
        }
      </div>

      <div class="tier-description">
        {{ tierConfig().description }}
      </div>

      <ul class="feature-list">
        @for (feature of tierConfig().features; track feature) {
          <li class="feature-item">
            <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
            </svg>
            <span>{{ getFeatureLabel(feature) }}</span>
          </li>
        }
      </ul>

      <div class="card-actions">
        @if (isCurrentTier()) {
          <button class="btn btn-current" disabled>
            Gói hiện tại
          </button>
        } @else if (tier === 'free') {
          <button 
            class="btn btn-secondary"
            (click)="onDowngrade()"
            [disabled]="loading"
          >
            {{ loading ? 'Đang xử lý...' : 'Chuyển về Free' }}
          </button>
        } @else {
          <button 
            class="btn btn-primary"
            (click)="onUpgrade()"
            [disabled]="loading"
          >
            {{ loading ? 'Đang xử lý...' : 'Nâng cấp ngay' }}
          </button>
        }
      </div>
    </div>
  `,
  styles: [`
    .pricing-card {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      padding: 32px;
      position: relative;
      transition: all 0.3s ease;
    }

    .pricing-card:hover {
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.1);
      transform: translateY(-4px);
    }

    .pricing-card.popular {
      border-color: #3b82f6;
      box-shadow: 0 4px 20px rgba(59, 130, 246, 0.2);
    }

    .pricing-card.current {
      border-color: #10b981;
    }

    .popular-badge {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #fff;
      padding: 6px 16px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 600;
    }

    .tier-header {
      text-align: center;
      margin-bottom: 24px;
    }

    .tier-name {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 16px;
    }

    .tier-price {
      display: flex;
      align-items: baseline;
      justify-content: center;
      gap: 4px;
    }

    .amount {
      font-size: 36px;
      font-weight: 800;
      color: #1f2937;
    }

    .period {
      font-size: 16px;
      color: #6b7280;
    }

    .yearly-price {
      margin-top: 8px;
      font-size: 14px;
      color: #6b7280;
    }

    .savings {
      color: #10b981;
      font-weight: 600;
    }

    .tier-description {
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      margin-bottom: 24px;
      line-height: 1.5;
    }

    .feature-list {
      list-style: none;
      padding: 0;
      margin: 0 0 32px;
    }

    .feature-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
      border-bottom: 1px solid #f3f4f6;
      font-size: 14px;
      color: #374151;
    }

    .feature-item:last-child {
      border-bottom: none;
    }

    .check-icon {
      width: 20px;
      height: 20px;
      color: #10b981;
      flex-shrink: 0;
    }

    .card-actions {
      text-align: center;
    }

    .btn {
      width: 100%;
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
    }

    .btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .btn-primary {
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #fff;
    }

    .btn-primary:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    .btn-secondary {
      background: #f3f4f6;
      color: #374151;
    }

    .btn-secondary:hover:not(:disabled) {
      background: #e5e7eb;
    }

    .btn-current {
      background: #d1fae5;
      color: #059669;
    }
  `]
})
export class PricingCardComponent {
  private monetization = inject(MonetizationService);

  @Input({ required: true }) tier!: 'free' | 'premium';
  @Input() loading = false;
  @Output() upgrade = new EventEmitter<void>();
  @Output() downgrade = new EventEmitter<void>();

  readonly tierConfig = computed(() => {
    return this.tier === 'premium' 
      ? PRICING_CONFIG.tiers.premium 
      : PRICING_CONFIG.tiers.free;
  });

  readonly isCurrentTier = computed(() => {
    const subscription = this.monetization.subscription();
    if (!subscription) return this.tier === 'free';
    return subscription.tier === (this.tier === 'premium' ? SubscriptionTier.PREMIUM : SubscriptionTier.FREE);
  });

  readonly yearlySavings = computed(() => {
    const config = this.tierConfig();
    const monthlyCost = config.price.monthly * 12;
    const yearlyCost = config.price.yearly;
    const savings = monthlyCost - yearlyCost;
    return formatVND(savings);
  });

  formatPrice(amount: number): string {
    return formatVND(amount);
  }

  getFeatureLabel(feature: string): string {
    const featureLabels: Record<string, string> = {
      // Common features
      'basic_content': 'Truy cập nội dung cơ bản',
      'limited_history': 'Lịch sử 7 ngày',
      'ads_supported': 'Có hiển thị quảng cáo',
      'full_content': 'Truy cập toàn bộ nội dung',
      'unlimited_history': 'Lịch sử không giới hạn',
      'no_ads': 'Không quảng cáo',
      'priority_support': 'Hỗ trợ ưu tiên',
      'export_data': 'Xuất dữ liệu',
      'advanced_analytics': 'Phân tích nâng cao',
      
      // TrendBrief features
      'basic_summaries': 'Tóm tắt tin cơ bản',
      'premium_summaries': 'Tóm tắt chi tiết Premium',
      'custom_topics': 'Chủ đề tùy chỉnh',
      
      // SmartBuy features
      'price_tracking': 'Theo dõi giá cơ bản',
      'advanced_tracking': 'Theo dõi giá nâng cao',
      'price_alerts': 'Cảnh báo giá',
      
      // FinTax features
      'basic_calculator': 'Công cụ tính thuế cơ bản',
      'advanced_calculator': 'Công cụ tính thuế nâng cao',
      'tax_reports': 'Báo cáo thuế chi tiết',
      
      // DoctorCar features
      'basic_diagnosis': 'Chẩn đoán cơ bản',
      'detailed_diagnosis': 'Chẩn đoán chi tiết',
      'maintenance_schedule': 'Lịch bảo dưỡng',
      
      // CareMate features
      'basic_reminders': 'Nhắc nhở cơ bản',
      'advanced_reminders': 'Nhắc nhở nâng cao',
      'family_sharing': 'Chia sẻ gia đình'
    };

    return featureLabels[feature] || feature;
  }

  onUpgrade(): void {
    this.upgrade.emit();
  }

  onDowngrade(): void {
    this.downgrade.emit();
  }
}
