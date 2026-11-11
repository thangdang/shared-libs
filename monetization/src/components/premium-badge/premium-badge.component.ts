/**
 * MON-016:  Premium Badge Component
 * 
 * Displays premium/subscription status badge.
 * Can be used in headers, profiles, and feature cards.
 */

import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

export type BadgeVariant = 'default' | 'compact' | 'inline' | 'icon-only';
export type BadgeTier = 'free' | 'basic' | 'premium' | 'enterprise';

@Component({
  selector: 'app-premium-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './premium-badge.component.html',
  styleUrl: './premium-badge.component.scss'
})
export class PremiumBadgeComponent {
  @Input() tier: BadgeTier = 'free';
  @Input() variant: BadgeVariant = 'default';

  getTierIcon(): string {
    const icons: Record<BadgeTier, string> = {
      free: '○',
      basic: '◆',
      premium: '★',
      enterprise: '◈'
    };
    return icons[this.tier];
  }

  getTierLabel(): string {
    const labels: Record<BadgeTier, string> = {
      free: 'Miễn phí',
      basic: 'Basic',
      premium: 'Premium',
      enterprise: 'Enterprise'
    };
    return labels[this.tier];
  }
}

export default PremiumBadgeComponent;
