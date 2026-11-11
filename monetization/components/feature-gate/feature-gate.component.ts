/**
 * Feature Gate Component
 * Task:  MON-017
 * 
 * UI component that restricts access to premium features.
 * Shows blur/lock overlay for non-subscribers.
 * Displays upgrade CTA for gated content.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Component, input, output, computed, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export type GateStyle = 'blur' | 'lock' | 'overlay' | 'inline';
export type RequiredTier = 'basic' | 'premium' | 'enterprise';

interface UserSubscription {
  tierId: string;
  isActive: boolean;
}

@Component({
  selector: 'app-feature-gate',
  standalone: true,
  imports: [CommonModule],
  template: `
    <!-- If user has access, show content normally -->
    <ng-container *ngIf="hasAccess()">
      <ng-content></ng-content>
    </ng-container>

    <!-- If user doesn't have access, show gated view -->
    <div class="feature-gate" *ngIf="!hasAccess()" [class]="gateClasses()">
      
      <!-- Blur Style -->
      <div class="gated-content blur-style" *ngIf="style() === 'blur'">
        <div class="blur-overlay">
          <ng-content select="[preview]"></ng-content>
        </div>
        <div class="gate-cta">
          <div class="lock-icon">🔒</div>
          <h3>{{ title() }}</h3>
          <p>{{ description() }}</p>
          <button class="btn-upgrade" (click)="onUpgradeClick()">
            {{ ctaText() }}
          </button>
        </div>
      </div>

      <!-- Lock Style -->
      <div class="gated-content lock-style" *ngIf="style() === 'lock'">
        <div class="lock-box">
          <div class="lock-icon-large">🔐</div>
          <h3>{{ title() }}</h3>
          <p>{{ description() }}</p>
          <button class="btn-upgrade" (click)="onUpgradeClick()">
            {{ ctaText() }}
          </button>
          <p class="tier-hint">
            Yêu cầu gói <strong>{{ requiredTierLabel() }}</strong> trở lên
          </p>
        </div>
      </div>

      <!-- Overlay Style -->
      <div class="gated-content overlay-style" *ngIf="style() === 'overlay'">
        <div class="content-preview">
          <ng-content select="[preview]"></ng-content>
        </div>
        <div class="overlay-cta">
          <span class="premium-tag">{{ requiredTierLabel() }}</span>
          <h4>{{ title() }}</h4>
          <button class="btn-upgrade-small" (click)="onUpgradeClick()">
            Nâng cấp
          </button>
        </div>
      </div>

      <!-- Inline Style (compact) -->
      <div class="gated-content inline-style" *ngIf="style() === 'inline'">
        <span class="inline-lock">🔒</span>
        <span class="inline-text">{{ title() }}</span>
        <button class="btn-inline-upgrade" (click)="onUpgradeClick()">
          Mở khóa
        </button>
      </div>
    </div>
  `,
  styles: [`
    .feature-gate {
      position: relative;
    }

    /* Blur Style */
    .blur-style {
      position: relative;
    }

    .blur-overlay {
      filter: blur(8px);
      pointer-events: none;
      user-select: none;
      opacity: 0.7;
    }

    .blur-style .gate-cta {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      background: rgba(17, 24, 39, 0.95);
      padding: 32px 40px;
      border-radius: 16px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      max-width: 360px;
      z-index: 10;
    }

    .lock-icon {
      font-size: 2.5rem;
      margin-bottom: 12px;
    }

    .gate-cta h3 {
      color: #f3f4f6;
      font-size: 1.25rem;
      margin: 0 0 8px 0;
    }

    .gate-cta p {
      color: #9ca3af;
      margin: 0 0 20px 0;
      font-size: 0.9rem;
      line-height: 1.5;
    }

    /* Lock Style */
    .lock-style {
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 200px;
      background: rgba(255, 255, 255, 0.02);
      border: 2px dashed rgba(255, 255, 255, 0.1);
      border-radius: 16px;
    }

    .lock-box {
      text-align: center;
      padding: 40px;
    }

    .lock-icon-large {
      font-size: 4rem;
      margin-bottom: 16px;
    }

    .lock-box h3 {
      color: #f3f4f6;
      font-size: 1.25rem;
      margin: 0 0 8px 0;
    }

    .lock-box p {
      color: #9ca3af;
      margin: 0 0 20px 0;
      max-width: 280px;
    }

    .tier-hint {
      color: #6b7280;
      font-size: 0.8rem;
      margin-top: 16px !important;
      margin-bottom: 0 !important;
    }

    .tier-hint strong {
      color: #fbbf24;
    }

    /* Overlay Style */
    .overlay-style {
      position: relative;
    }

    .content-preview {
      opacity: 0.4;
      pointer-events: none;
    }

    .overlay-cta {
      position: absolute;
      top: 0;
      right: 0;
      background: rgba(17, 24, 39, 0.9);
      padding: 12px 16px;
      border-radius: 0 0 0 12px;
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .premium-tag {
      background: linear-gradient(135deg, #fbbf24, #f59e0b);
      color: #111827;
      padding: 4px 10px;
      border-radius: 4px;
      font-size: 0.7rem;
      font-weight: 700;
      text-transform: uppercase;
    }

    .overlay-cta h4 {
      color: #f3f4f6;
      font-size: 0.9rem;
      margin: 0;
    }

    .btn-upgrade-small {
      padding: 6px 14px;
      background: #3b82f6;
      border: none;
      border-radius: 6px;
      color: white;
      font-size: 0.8rem;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-upgrade-small:hover {
      background: #2563eb;
    }

    /* Inline Style */
    .inline-style {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
    }

    .inline-lock {
      font-size: 0.9rem;
    }

    .inline-text {
      color: #9ca3af;
      font-size: 0.85rem;
    }

    .btn-inline-upgrade {
      padding: 4px 10px;
      background: rgba(59, 130, 246, 0.2);
      border: none;
      border-radius: 4px;
      color: #60a5fa;
      font-size: 0.8rem;
      cursor: pointer;
    }

    .btn-inline-upgrade:hover {
      background: rgba(59, 130, 246, 0.3);
    }

    /* Common Upgrade Button */
    .btn-upgrade {
      padding: 12px 28px;
      background: linear-gradient(135deg, #3b82f6, #2563eb);
      border: none;
      border-radius: 8px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-upgrade:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
    }

    /* Responsive */
    @media (max-width: 640px) {
      .blur-style .gate-cta {
        padding: 24px;
        max-width: 90%;
      }

      .lock-box {
        padding: 24px;
      }

      .overlay-cta {
        flex-wrap: wrap;
        gap: 8px;
      }

      .overlay-cta h4 {
        width: 100%;
        order: 1;
      }
    }
  `]
})
export class FeatureGateComponent implements OnInit {
  private router = inject(Router);
  private http = inject(HttpClient);

  // Inputs
  feature = input.required<string>();
  requiredTier = input<RequiredTier>('premium');
  style = input<GateStyle>('blur');
  title = input<string>('Tính năng cao cấp');
  description = input<string>('Nâng cấp gói để sử dụng tính năng này.');
  ctaText = input<string>('Nâng cấp ngay');
  redirectUrl = input<string>('/pricing');

  // Outputs
  upgrade = output<void>();

  // State
  private userSubscription = signal<UserSubscription | null>(null);
  loading = signal(true);

  // Tier hierarchy for comparison
  private tierHierarchy: Record<string, number> = {
    'free': 0,
    'basic': 1,
    'premium': 2,
    'enterprise': 3
  };

  ngOnInit(): void {
    this.loadUserSubscription();
  }

  private loadUserSubscription(): void {
    this.http.get<UserSubscription>(
      `${environment.apiUrl}/api/subscriptions/current`
    ).pipe(
      catchError(() => of({ tierId: 'free', isActive: true }))
    ).subscribe(sub => {
      this.userSubscription.set(sub);
      this.loading.set(false);
    });
  }

  // Computed
  hasAccess = computed(() => {
    const sub = this.userSubscription();
    if (!sub || !sub.isActive) return false;

    const userTierLevel = this.tierHierarchy[sub.tierId] ?? 0;
    const requiredLevel = this.tierHierarchy[this.requiredTier()] ?? 0;

    return userTierLevel >= requiredLevel;
  });

  gateClasses = computed(() => {
    return `gate-${this.style()}`;
  });

  requiredTierLabel = computed(() => {
    const labels: Record<RequiredTier, string> = {
      'basic': 'Cơ bản',
      'premium': 'Premium',
      'enterprise': 'Enterprise'
    };
    return labels[this.requiredTier()];
  });

  onUpgradeClick(): void {
    this.upgrade.emit();
    this.router.navigate([this.redirectUrl()], {
      queryParams: {
        feature: this.feature(),
        required: this.requiredTier()
      }
    });
  }
}
