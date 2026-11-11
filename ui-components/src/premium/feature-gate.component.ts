/**
 * Feature Gate Component
 * 
 * Shows locked/blurred content for non-premium users
 * Tasks: MON-017
 */

import { 
  Component, 
  Input, 
  Output, 
  EventEmitter,
  ChangeDetectionStrategy 
} from '@angular/core';
import { CommonModule } from '@angular/common';

export type GateStyle = 'blur' | 'overlay' | 'lock' | 'minimal';

@Component({
  selector: 'app-feature-gate',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div 
      class="feature-gate" 
      [class.locked]="!hasAccess"
      [class]="'style-' + style"
    >
      <!-- Content (blurred/locked if no access) -->
      <div class="gated-content">
        <ng-content></ng-content>
      </div>

      <!-- Overlay for non-premium users -->
      @if (!hasAccess) {
        <div class="gate-overlay">
          <div class="gate-content">
            @switch (style) {
              @case ('lock') {
                <div class="lock-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                  </svg>
                </div>
              }
              @case ('minimal') {
                <div class="premium-badge">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/>
                  </svg>
                  Premium
                </div>
              }
              @default {
                <div class="upgrade-prompt">
                  <h3>{{ title }}</h3>
                  <p>{{ description }}</p>
                  <button class="upgrade-btn" (click)="onUpgrade()">
                    {{ buttonText }}
                  </button>
                  @if (showPriceHint && priceHint) {
                    <span class="price-hint">{{ priceHint }}</span>
                  }
                </div>
              }
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .feature-gate {
      position: relative;
      overflow: hidden;
    }

    .gated-content {
      transition: filter 0.3s ease;
    }

    /* Blur style */
    .feature-gate.locked.style-blur .gated-content {
      filter: blur(8px);
      user-select: none;
      pointer-events: none;
    }

    /* Overlay style */
    .feature-gate.locked.style-overlay .gated-content {
      opacity: 0.3;
      user-select: none;
      pointer-events: none;
    }

    /* Lock style */
    .feature-gate.locked.style-lock .gated-content {
      filter: grayscale(100%) blur(2px);
      user-select: none;
      pointer-events: none;
    }

    /* Minimal style */
    .feature-gate.locked.style-minimal .gated-content {
      opacity: 0.5;
      user-select: none;
      pointer-events: none;
    }

    .gate-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255, 255, 255, 0.7);
      backdrop-filter: blur(2px);
      z-index: 10;
    }

    .style-minimal .gate-overlay {
      background: transparent;
      backdrop-filter: none;
    }

    .gate-content {
      text-align: center;
      padding: 2rem;
    }

    .lock-icon {
      width: 64px;
      height: 64px;
      margin: 0 auto 1rem;
      color: var(--text-secondary, #666);
    }

    .lock-icon svg {
      width: 100%;
      height: 100%;
      stroke-width: 1.5;
    }

    .premium-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 0.5rem 1rem;
      border-radius: 20px;
      font-size: 0.875rem;
      font-weight: 600;
    }

    .premium-badge svg {
      width: 16px;
      height: 16px;
    }

    .upgrade-prompt h3 {
      font-size: 1.25rem;
      font-weight: 600;
      margin-bottom: 0.5rem;
      color: var(--text-primary, #1a1a1a);
    }

    .upgrade-prompt p {
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
      margin-bottom: 1rem;
      max-width: 300px;
    }

    .upgrade-btn {
      padding: 0.75rem 2rem;
      background: var(--primary, #4f46e5);
      color: white;
      border: none;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .upgrade-btn:hover {
      background: var(--primary-dark, #4338ca);
    }

    .price-hint {
      display: block;
      margin-top: 0.5rem;
      font-size: 0.75rem;
      color: var(--text-tertiary, #999);
    }
  `]
})
export class FeatureGateComponent {
  @Input() hasAccess = false;
  @Input() style: GateStyle = 'blur';
  @Input() title = 'Tính năng Premium';
  @Input() description = 'Nâng cấp để mở khóa tính năng này';
  @Input() buttonText = 'Nâng cấp ngay';
  @Input() showPriceHint = true;
  @Input() priceHint = 'Chỉ từ 49.000đ/tháng';
  @Input() requiredTier = 'premium';

  @Output() upgrade = new EventEmitter<string>();

  onUpgrade(): void {
    this.upgrade.emit(this.requiredTier);
  }
}

/**
 * Premium Badge Component
 */
@Component({
  selector: 'app-premium-badge',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span 
      class="premium-badge"
      [class.small]="size === 'small'"
      [class.large]="size === 'large'"
    >
      <svg viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2L15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2z"/>
      </svg>
      @if (showLabel) {
        <span>{{ label }}</span>
      }
    </span>
  `,
  styles: [`
    .premium-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.25rem;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      color: white;
      padding: 0.25rem 0.5rem;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }

    .premium-badge svg {
      width: 12px;
      height: 12px;
    }

    .premium-badge.small {
      padding: 0.125rem 0.375rem;
      font-size: 0.625rem;
    }

    .premium-badge.small svg {
      width: 10px;
      height: 10px;
    }

    .premium-badge.large {
      padding: 0.375rem 0.75rem;
      font-size: 0.875rem;
      border-radius: 6px;
    }

    .premium-badge.large svg {
      width: 16px;
      height: 16px;
    }
  `]
})
export class PremiumBadgeComponent {
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showLabel = true;
  @Input() label = 'Premium';
}
