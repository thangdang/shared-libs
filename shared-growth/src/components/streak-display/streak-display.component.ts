import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastActiveDate: Date;
  streakHistory: StreakDay[];
  isAtRisk: boolean; // true if user hasn't logged in today
  nextMilestone: number;
  milestoneReward?: {
    type: 'premium_days' | 'badge';
    value: number;
  };
}

export interface StreakDay {
  date: Date;
  isActive: boolean;
  bonusEarned?: number;
}

@Component({
  selector: 'app-streak-display',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './streak-display.component.html',
  styleUrls: ['./streak-display.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StreakDisplayComponent {
  @Input() set streakData(value: StreakData | null) {
    this._streakData.set(value);
  }
  @Input() variant: 'compact' | 'full' | 'minimal' = 'compact';
  @Input() showHistory = true;
  @Input() historyDays = 7;

  @Output() streakClick = new EventEmitter<void>();
  @Output() claimReward = new EventEmitter<void>();

  private _streakData = signal<StreakData | null>(null);

  data = computed(() => this._streakData());

  progressToMilestone = computed(() => {
    const data = this._streakData();
    if (!data || !data.nextMilestone) return 0;
    const prevMilestone = this.getPreviousMilestone(data.nextMilestone);
    const progress = ((data.currentStreak - prevMilestone) / (data.nextMilestone - prevMilestone)) * 100;
    return Math.min(100, Math.max(0, progress));
  });

  recentHistory = computed(() => {
    const data = this._streakData();
    if (!data) return [];
    return data.streakHistory.slice(-this.historyDays);
  });

  private getPreviousMilestone(nextMilestone: number): number {
    const milestones = [0, 7, 14, 30, 60, 90, 180, 365];
    const idx = milestones.indexOf(nextMilestone);
    return idx > 0 ? milestones[idx - 1] : 0;
  }

  getDayLabel(date: Date): string {
    const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    return days[new Date(date).getDay()];
  }

  getDayNumber(date: Date): number {
    return new Date(date).getDate();
  }

  isToday(date: Date): boolean {
    const today = new Date();
    const d = new Date(date);
    return d.toDateString() === today.toDateString();
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  onStreakClick(): void {
    this.streakClick.emit();
  }

  onClaimReward(): void {
    this.claimReward.emit();
  }
}
