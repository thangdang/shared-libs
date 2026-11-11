/**
 * Premium Badge Component
 * Task:  MON-016
 * 
 * Visual badge indicator for premium subscription status.
 * Multiple sizes and styles for different use cases.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeSize = 'xs' | 'sm' | 'md' | 'lg';
export type BadgeVariant = 'default' | 'outline' | 'glow' | 'minimal';
export type TierType = 'free' | 'basic' | 'premium' | 'enterprise';

@Component({
  selector: 'app-premium-badge',
  standalone: true,
  imports: [CommonModule],
  template: `
    <span 
      class="premium-badge"
      [class]="badgeClasses()"
      [attr.title]="tooltipText()"
    >
      <span class="badge-icon" *ngIf="showIcon()">{{ tierIcon() }}</span>
      <span class="badge-text" *ngIf="showText()">{{ tierLabel() }}</span>
    </span>
  `,
  styles: [`
    .premium-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 600;
      white-space: nowrap;
      vertical-align: middle;
    }

    /* Sizes */
    .premium-badge.size-xs {
      padding: 2px 6px;
      font-size: 0.65rem;
      border-radius: 4px;
    }

    .premium-badge.size-sm {
      padding: 3px 8px;
      font-size: 0.75rem;
      border-radius: 6px;
    }

    .premium-badge.size-md {
      padding: 4px 12px;
      font-size: 0.85rem;
      border-radius: 8px;
    }

    .premium-badge.size-lg {
      padding: 6px 16px;
      font-size: 1rem;
      border-radius: 10px;
    }

    /* Free Tier - Default */
    .premium-badge.tier-free.variant-default {
      background: rgba(107, 114, 128, 0.2);
      color: #9ca3af;
    }

    .premium-badge.tier-free.variant-outline {
      background: transparent;
      border: 1px solid rgba(107, 114, 128, 0.3);
      color: #9ca3af;
    }

    .premium-badge.tier-free.variant-minimal {
      background: transparent;
      color: #9ca3af;
    }

    /* Basic Tier - Blue */
    .premium-badge.tier-basic.variant-default {
      background: rgba(59, 130, 246, 0.2);
      color: #60a5fa;
    }

    .premium-badge.tier-basic.variant-outline {
      background: transparent;
      border: 1px solid rgba(59, 130, 246, 0.4);
      color: #60a5fa;
    }

    .premium-badge.tier-basic.variant-glow {
      background: linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(37, 99, 235, 0.3));
      color: #60a5fa;
      box-shadow: 0 0 12px rgba(59, 130, 246, 0.3);
    }

    .premium-badge.tier-basic.variant-minimal {
      background: transparent;
      color: #60a5fa;
    }

    /* Premium Tier - Gold */
    .premium-badge.tier-premium.variant-default {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.2), rgba(217, 119, 6, 0.2));
      color: #fbbf24;
    }

    .premium-badge.tier-premium.variant-outline {
      background: transparent;
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #fbbf24;
    }

    .premium-badge.tier-premium.variant-glow {
      background: linear-gradient(135deg, rgba(245, 158, 11, 0.3), rgba(217, 119, 6, 0.3));
      color: #fbbf24;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.4);
    }

    .premium-badge.tier-premium.variant-minimal {
      background: transparent;
      color: #fbbf24;
    }

    /* Enterprise Tier - Purple */
    .premium-badge.tier-enterprise.variant-default {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.2), rgba(109, 40, 217, 0.2));
      color: #a78bfa;
    }

    .premium-badge.tier-enterprise.variant-outline {
      background: transparent;
      border: 1px solid rgba(139, 92, 246, 0.4);
      color: #a78bfa;
    }

    .premium-badge.tier-enterprise.variant-glow {
      background: linear-gradient(135deg, rgba(139, 92, 246, 0.3), rgba(109, 40, 217, 0.3));
      color: #a78bfa;
      box-shadow: 0 0 12px rgba(139, 92, 246, 0.4);
    }

    .premium-badge.tier-enterprise.variant-minimal {
      background: transparent;
      color: #a78bfa;
    }

    /* Icon */
    .badge-icon {
      font-style: normal;
      line-height: 1;
    }

    .size-xs .badge-icon {
      font-size: 0.7rem;
    }

    .size-sm .badge-icon {
      font-size: 0.8rem;
    }

    .size-md .badge-icon {
      font-size: 0.9rem;
    }

    .size-lg .badge-icon {
      font-size: 1rem;
    }

    /* Icon-only mode */
    .premium-badge.icon-only {
      padding: 4px;
      border-radius: 50%;
    }

    .premium-badge.icon-only.size-xs {
      padding: 2px;
    }

    .premium-badge.icon-only.size-sm {
      padding: 3px;
    }

    .premium-badge.icon-only.size-lg {
      padding: 6px;
    }
  `]
})
export class PremiumBadgeComponent {
  // Inputs
  tier = input<TierType>('free');
  size = input<BadgeSize>('sm');
  variant = input<BadgeVariant>('default');
  iconOnly = input<boolean>(false);
  customLabel = input<string | null>(null);
  customIcon = input<string | null>(null);

  // Computed
  badgeClasses = computed(() => {
    const classes = [
      `tier-${this.tier()}`,
      `size-${this.size()}`,
      `variant-${this.variant()}`
    ];
    if (this.iconOnly()) {
      classes.push('icon-only');
    }
    return classes.join(' ');
  });

  tierIcon = computed(() => {
    if (this.customIcon()) return this.customIcon();
    
    const icons: Record<TierType, string> = {
      'free': '🆓',
      'basic': '⭐',
      'premium': '👑',
      'enterprise': '💎'
    };
    return icons[this.tier()];
  });

  tierLabel = computed(() => {
    if (this.customLabel()) return this.customLabel();
    
    const labels: Record<TierType, string> = {
      'free': 'Miễn phí',
      'basic': 'Cơ bản',
      'premium': 'Premium',
      'enterprise': 'Enterprise'
    };
    return labels[this.tier()];
  });

  tooltipText = computed(() => {
    const tooltips: Record<TierType, string> = {
      'free': 'Gói miễn phí',
      'basic': 'Gói cơ bản',
      'premium': 'Gói cao cấp',
      'enterprise': 'Gói doanh nghiệp'
    };
    return tooltips[this.tier()];
  });

  showIcon = computed(() => true);
  showText = computed(() => !this.iconOnly());
}
