/**
 * MON-015:  My Subscription Page Component
 * 
 * Shows current subscription status, usage, and management options.
 */

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil } from 'rxjs';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionInfo {
  id: string;
  tier: {
    id: string;
    name: string;
    features: string[];
  };
  status: 'active' | 'expired' | 'cancelled' | 'pending';
  start_date: string;
  end_date: string;
  next_billing_date?: string;
  auto_renew: boolean;
  payment_method?: string;
  usage?: UsageInfo;
}

export interface UsageInfo {
  api_calls?: { used: number; limit: number };
  storage?: { used: number; limit: number };
  exports?: { used: number; limit: number };
}

// ============================================================================
// Component
// ============================================================================

@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './my-subscription.component.html',
  styleUrl: './my-subscription.component.scss'
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  @Input() apiEndpoint = '/api/subscription';
  
  @Output() upgrade = new EventEmitter<void>();
  @Output() managePayment = new EventEmitter<void>();
  @Output() viewHistory = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  subscription: SubscriptionInfo | null = null;
  loading = true;
  showCancelModal = false;

  ngOnInit(): void {
    this.loadSubscription();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async loadSubscription(): Promise<void> {
    this.loading = true;
    
    try {
      const response = await fetch(`${this.apiEndpoint}/current`);
      const result = await response.json();
      
      if (result.success && result.data) {
        this.subscription = result.data;
      }
    } catch (error) {
      console.error('Failed to load subscription:', error);
    } finally {
      this.loading = false;
    }
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      active: 'Đang hoạt động',
      expired: 'Đã hết hạn',
      cancelled: 'Đã hủy',
      pending: 'Đang chờ'
    };
    return labels[status] || status;
  }

  getDaysRemaining(): number {
    if (!this.subscription?.end_date) return 0;
    const end = new Date(this.subscription.end_date);
    const now = new Date();
    const diff = end.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }

  formatDate(dateStr: string): string {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  getUsagePercent(usage: { used: number; limit: number }): number {
    if (!usage.limit) return 0;
    return Math.min(100, (usage.used / usage.limit) * 100);
  }

  async toggleAutoRenew(): Promise<void> {
    if (!this.subscription) return;

    try {
      const response = await fetch(`${this.apiEndpoint}/auto-renew`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !this.subscription.auto_renew })
      });

      const result = await response.json();
      if (result.success) {
        this.subscription.auto_renew = !this.subscription.auto_renew;
      }
    } catch (error) {
      console.error('Failed to toggle auto-renew:', error);
    }
  }

  confirmCancel(): void {
    this.showCancelModal = true;
  }

  async cancelSubscription(): Promise<void> {
    try {
      const response = await fetch(`${this.apiEndpoint}/cancel`, {
        method: 'POST'
      });

      const result = await response.json();
      if (result.success) {
        this.showCancelModal = false;
        this.cancelled.emit();
        await this.loadSubscription();
      }
    } catch (error) {
      console.error('Failed to cancel subscription:', error);
    }
  }
}

export default MySubscriptionComponent;
