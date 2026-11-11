import { Component, Input, Output, EventEmitter, OnInit, OnDestroy, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number; // days of premium
  totalRewardsAvailable: number;
  referralHistory: ReferralHistoryItem[];
}

export interface ReferralHistoryItem {
  referralId: string;
  referredEmail: string;
  referredName?: string;
  status: 'pending' | 'completed' | 'expired';
  rewardDays: number;
  createdAt: Date;
  completedAt?: Date;
}

@Component({
  selector: 'app-referral-dashboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './referral-dashboard.component.html',
  styleUrls: ['./referral-dashboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ReferralDashboardComponent implements OnInit, OnDestroy {
  @Input() set stats(value: ReferralStats | null) {
    this._stats.set(value);
  }
  @Input() rewardDaysPerReferral = 7;
  @Input() appName = 'App';

  @Output() shareClicked = new EventEmitter<void>();
  @Output() copyCode = new EventEmitter<string>();
  @Output() viewDetails = new EventEmitter<string>();

  private _stats = signal<ReferralStats | null>(null);
  
  copied = signal(false);
  private copyTimeout: any;

  referralStats = computed(() => this._stats());
  
  completionRate = computed(() => {
    const stats = this._stats();
    if (!stats || stats.totalReferrals === 0) return 0;
    return Math.round((stats.successfulReferrals / stats.totalReferrals) * 100);
  });

  recentReferrals = computed(() => {
    const stats = this._stats();
    if (!stats) return [];
    return stats.referralHistory
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);
  });

  ngOnInit(): void {}

  ngOnDestroy(): void {
    if (this.copyTimeout) {
      clearTimeout(this.copyTimeout);
    }
  }

  async copyReferralCode(): void {
    const stats = this._stats();
    if (!stats) return;

    try {
      await navigator.clipboard.writeText(stats.referralCode);
      this.copied.set(true);
      this.copyCode.emit(stats.referralCode);

      if (this.copyTimeout) {
        clearTimeout(this.copyTimeout);
      }

      this.copyTimeout = setTimeout(() => {
        this.copied.set(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  }

  openShareModal(): void {
    this.shareClicked.emit();
  }

  viewReferralDetails(referralId: string): void {
    this.viewDetails.emit(referralId);
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      pending: 'Chờ xác nhận',
      completed: 'Hoàn thành',
      expired: 'Hết hạn'
    };
    return labels[status] || status;
  }

  getStatusClass(status: string): string {
    const classes: Record<string, string> = {
      pending: 'status-pending',
      completed: 'status-completed',
      expired: 'status-expired'
    };
    return classes[status] || '';
  }

  formatDate(date: Date | string): string {
    const d = new Date(date);
    return d.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (local.length <= 2) {
      return `${local[0]}***@${domain}`;
    }
    return `${local[0]}${local[1]}***@${domain}`;
  }
}
