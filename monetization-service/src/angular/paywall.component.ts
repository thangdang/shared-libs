/**
 * Paywall Component - Blocks content for free users with upgrade prompt
 * Wraps premium content and shows upgrade CTA for free tier
 */

import {
  Component,
  Input,
  Output,
  EventEmitter,
  inject,
  computed,
  ContentChild,
  TemplateRef
} from '@angular/core';
import { NgIf, NgTemplateOutlet } from '@angular/common';
import { MonetizationService } from './monetization.service';
import { formatVND } from '../pricing';

@Component({
  selector: 'lib-paywall',
  standalone: true,
  imports: [NgIf, NgTemplateOutlet],
  template: `
    @if (isPremium()) {
      <!-- Premium users see full content -->
      <ng-content></ng-content>
    } @else {
      <!-- Free users see blurred preview + paywall -->
      <div class="paywall-container">
        @if (showPreview) {
          <div class="preview-content" [class.blurred]="blurPreview">
            <ng-content select="[preview]"></ng-content>
          </div>
        }
        
        <div class="paywall-overlay" [class.with-preview]="showPreview">
          <div class="paywall-content">
            <div class="lock-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            </div>
            
            <h3 class="paywall-title">{{ title }}</h3>
            <p class="paywall-description">{{ description }}</p>
            
            <div class="pricing-info">
              <span class="price">{{ formattedPrice }}</span>
              <span class="period">/tháng</span>
            </div>
            
            <ul class="benefits-list">
              @for (benefit of benefits; track benefit) {
                <li>
                  <svg class="check-icon" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                  </svg>
                  {{ benefit }}
                </li>
              }
            </ul>
            
            <button class="upgrade-btn" (click)="onUpgrade()">
              Nâng cấp Premium
            </button>
            
            <p class="guarantee">
              <svg viewBox="0 0 20 20" fill="currentColor" class="shield-icon">
                <path fill-rule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
              </svg>
              Hoàn tiền trong 7 ngày nếu không hài lòng
            </p>
          </div>
        </div>
      </div>
    }
  `,
  styles: [`
    .paywall-container {
      position: relative;
      min-height: 300px;
    }

    .preview-content {
      position: relative;
    }

    .preview-content.blurred {
      filter: blur(8px);
      pointer-events: none;
      user-select: none;
    }

    .paywall-overlay {
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
      border-radius: 16px;
      padding: 48px 24px;
    }

    .paywall-overlay.with-preview {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(4px);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
      max-width: 400px;
      width: 90%;
    }

    .paywall-content {
      text-align: center;
      max-width: 360px;
    }

    .lock-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 24px;
      color: #3b82f6;
      background: #eff6ff;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .lock-icon svg {
      width: 32px;
      height: 32px;
    }

    .paywall-title {
      font-size: 24px;
      font-weight: 700;
      color: #1f2937;
      margin: 0 0 12px;
    }

    .paywall-description {
      font-size: 16px;
      color: #6b7280;
      margin: 0 0 24px;
      line-height: 1.5;
    }

    .pricing-info {
      margin-bottom: 24px;
    }

    .price {
      font-size: 32px;
      font-weight: 800;
      color: #1f2937;
    }

    .period {
      font-size: 16px;
      color: #6b7280;
    }

    .benefits-list {
      list-style: none;
      padding: 0;
      margin: 0 0 24px;
      text-align: left;
    }

    .benefits-list li {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 0;
      font-size: 14px;
      color: #374151;
    }

    .check-icon {
      width: 18px;
      height: 18px;
      color: #10b981;
      flex-shrink: 0;
    }

    .upgrade-btn {
      width: 100%;
      padding: 16px 24px;
      background: linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%);
      color: #fff;
      border: none;
      border-radius: 12px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .upgrade-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.4);
    }

    .guarantee {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 16px;
      font-size: 13px;
      color: #6b7280;
    }

    .shield-icon {
      width: 16px;
      height: 16px;
      color: #10b981;
    }
  `]
})
export class PaywallComponent {
  private monetization = inject(MonetizationService);

  @Input() title = 'Nội dung Premium';
  @Input() description = 'Nâng cấp để truy cập toàn bộ nội dung và tính năng cao cấp.';
  @Input() showPreview = false;
  @Input() blurPreview = true;
  @Input() benefits: string[] = [
    'Truy cập không giới hạn',
    'Không quảng cáo',
    'Tính năng nâng cao',
    'Hỗ trợ ưu tiên'
  ];

  @Output() upgrade = new EventEmitter<void>();

  readonly isPremium = computed(() => this.monetization.isPremium());
  readonly formattedPrice = formatVND(99000);

  onUpgrade(): void {
    this.upgrade.emit();
  }
}
