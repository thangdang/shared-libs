import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface Achievement {
  achievementId: string;
  name: string;
  description: string;
  iconClass: string;
  category: 'engagement' | 'referral' | 'premium' | 'milestone' | 'streak';
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  isUnlocked: boolean;
  unlockedAt?: Date;
  progress?: number; // 0-100 for partial progress
  requirement?: string;
  reward?: {
    type: 'premium_days' | 'badge' | 'title';
    value: number | string;
  };
}

@Component({
  selector: 'app-achievement-badge',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './achievement-badge.component.html',
  styleUrls: ['./achievement-badge.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AchievementBadgeComponent {
  @Input() achievement!: Achievement;
  @Input() size: 'small' | 'medium' | 'large' = 'medium';
  @Input() showDetails = true;
  @Input() animated = true;

  @Output() badgeClick = new EventEmitter<Achievement>();

  get rarityLabel(): string {
    const labels: Record<string, string> = {
      common: 'Thường',
      uncommon: 'Không phổ biến',
      rare: 'Hiếm',
      epic: 'Sử thi',
      legendary: 'Huyền thoại'
    };
    return labels[this.achievement.rarity] || '';
  }

  get categoryLabel(): string {
    const labels: Record<string, string> = {
      engagement: 'Tương tác',
      referral: 'Giới thiệu',
      premium: 'Premium',
      milestone: 'Cột mốc',
      streak: 'Chuỗi ngày'
    };
    return labels[this.achievement.category] || '';
  }

  formatDate(date?: Date): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  onBadgeClick(): void {
    this.badgeClick.emit(this.achievement);
  }
}
