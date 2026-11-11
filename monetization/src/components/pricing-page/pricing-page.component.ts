/**
 * MON-013:  Pricing Page Component
 * Displays subscription tiers with feature comparison
 */

import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SubscriptionService, SubscriptionTier, SUBSCRIPTION_TIERS } from '../../services/subscription.service';

@Component({
  selector: 'app-pricing-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './pricing-page.component.html',
  styleUrl: './pricing-page.component.scss'
})
export class PricingPageComponent implements OnInit {
  private router = inject(Router);
  
  billingPeriod = signal<'monthly' | 'yearly'>('monthly');
  currentTierId = signal<string>('free');
  isLoading = signal(false);
  
  displayTiers = computed(() => {
    const period = this.billingPeriod();
    return SUBSCRIPTION_TIERS.filter(tier => 
      tier.price === 0 || tier.period === period
    );
  });

  ngOnInit(): void {
    // Load current user's subscription tier
    this.loadCurrentTier();
  }

  private async loadCurrentTier(): Promise<void> {
    // In real app, fetch from API
    this.currentTierId.set('free');
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      minimumFractionDigits: 0
    }).format(price);
  }

  isUpgrade(tier: SubscriptionTier): boolean {
    const currentTier = SUBSCRIPTION_TIERS.find(t => t.id === this.currentTierId());
    return tier.priority > (currentTier?.priority || 0);
  }

  selectTier(tier: SubscriptionTier): void {
    if (tier.price === 0) {
      // Free tier - just update
      this.currentTierId.set(tier.id);
      return;
    }
    
    // Navigate to checkout
    this.router.navigate(['/checkout'], {
      queryParams: { tierId: tier.id }
    });
  }
}

export default PricingPageComponent;
