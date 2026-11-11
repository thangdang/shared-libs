import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  avatarUrl?: string;
  score: number;
  badge?: string;
  isCurrentUser: boolean;
  streak?: number;
  referrals?: number;
  previousRank?: number; // for showing rank change
}

export interface LeaderboardData {
  period: 'daily' | 'weekly' | 'monthly' | 'all_time';
  category: 'points' | 'streak' | 'referrals';
  entries: LeaderboardEntry[];
  currentUserEntry?: LeaderboardEntry;
  totalParticipants: number;
  lastUpdated: Date;
}

@Component({
  selector: 'app-leaderboard',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './leaderboard.component.html',
  styleUrls: ['./leaderboard.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeaderboardComponent {
  @Input() set data(value: LeaderboardData | null) {
    this._data.set(value);
  }
  @Input() maxEntries = 10;
  @Input() showCurrentUser = true;
  @Input() enablePeriodSwitch = true;

  @Output() periodChange = new EventEmitter<'daily' | 'weekly' | 'monthly' | 'all_time'>();
  @Output() categoryChange = new EventEmitter<'points' | 'streak' | 'referrals'>();
  @Output() userClick = new EventEmitter<string>();
  @Output() viewAll = new EventEmitter<void>();

  private _data = signal<LeaderboardData | null>(null);

  leaderboardData = computed(() => this._data());

  displayEntries = computed(() => {
    const data = this._data();
    if (!data) return [];
    return data.entries.slice(0, this.maxEntries);
  });

  topThree = computed(() => {
    return this.displayEntries().slice(0, 3);
  });

  restEntries = computed(() => {
    return this.displayEntries().slice(3);
  });

  periods: { value: 'daily' | 'weekly' | 'monthly' | 'all_time'; label: string }[] = [
    { value: 'daily', label: 'Hôm nay' },
    { value: 'weekly', label: 'Tuần này' },
    { value: 'monthly', label: 'Tháng này' },
    { value: 'all_time', label: 'Tổng' }
  ];

  categories: { value: 'points' | 'streak' | 'referrals'; label: string; icon: string }[] = [
    { value: 'points', label: 'Điểm', icon: 'fas fa-star' },
    { value: 'streak', label: 'Chuỗi ngày', icon: 'fas fa-fire' },
    { value: 'referrals', label: 'Giới thiệu', icon: 'fas fa-users' }
  ];

  onPeriodChange(period: 'daily' | 'weekly' | 'monthly' | 'all_time'): void {
    this.periodChange.emit(period);
  }

  onCategoryChange(category: 'points' | 'streak' | 'referrals'): void {
    this.categoryChange.emit(category);
  }

  onUserClick(userId: string): void {
    this.userClick.emit(userId);
  }

  onViewAll(): void {
    this.viewAll.emit();
  }

  getRankIcon(rank: number): string {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return '';
  }

  getRankChange(entry: LeaderboardEntry): { direction: 'up' | 'down' | 'same'; value: number } {
    if (!entry.previousRank) return { direction: 'same', value: 0 };
    const diff = entry.previousRank - entry.rank;
    if (diff > 0) return { direction: 'up', value: diff };
    if (diff < 0) return { direction: 'down', value: Math.abs(diff) };
    return { direction: 'same', value: 0 };
  }

  formatScore(score: number): string {
    if (score >= 1000000) {
      return (score / 1000000).toFixed(1) + 'M';
    }
    if (score >= 1000) {
      return (score / 1000).toFixed(1) + 'K';
    }
    return score.toString();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  getInitial(name: string): string {
    return name.charAt(0).toUpperCase();
  }
}
