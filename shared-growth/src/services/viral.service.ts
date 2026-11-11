/**
 * Viral Features Service - Shared across all 5 apps
 * Handles social sharing, achievements, and viral loops
 */

import { v4 as uuidv4 } from 'uuid';

export interface ShareableContent {
  id: string;
  type: 'achievement' | 'milestone' | 'insight' | 'result' | 'streak';
  appId: string;
  userId: string;
  title: string;
  description: string;
  imageUrl?: string;
  stats?: Record<string, number | string>;
  createdAt: Date;
}

export interface Achievement {
  id: string;
  appId: string;
  code: string;
  name: string;
  description: string;
  icon: string;
  category: 'starter' | 'regular' | 'power_user' | 'viral' | 'premium';
  points: number;
  requirement: {
    type: string;
    value: number;
  };
  isShareable: boolean;
}

export interface UserAchievement {
  id: string;
  userId: string;
  achievementId: string;
  unlockedAt: Date;
  shared: boolean;
  sharedPlatforms: string[];
}

export interface ViralStats {
  totalShares: number;
  sharesByPlatform: Record<string, number>;
  viralCoefficient: number;
  achievementsUnlocked: number;
  shareStreak: number;
}

export class ViralService {
  /**
   * Achievement definitions for each app
   */
  private readonly ACHIEVEMENTS: Achievement[] = [
    // TrendBrief Achievements
    { id: '1', appId: 'trendbrief', code: 'first_brief', name: 'Độc giả mới', description: 'Đọc bản tóm tắt đầu tiên', icon: '📰', category: 'starter', points: 10, requirement: { type: 'briefs_read', value: 1 }, isShareable: true },
    { id: '2', appId: 'trendbrief', code: 'news_addict', name: 'Nghiện tin tức', description: 'Đọc 100 bản tóm tắt', icon: '🔥', category: 'power_user', points: 100, requirement: { type: 'briefs_read', value: 100 }, isShareable: true },
    { id: '3', appId: 'trendbrief', code: 'early_bird', name: 'Dậy sớm', description: 'Đọc tin trước 6h sáng', icon: '🌅', category: 'regular', points: 25, requirement: { type: 'early_read', value: 1 }, isShareable: true },
    
    // SmartBuy Achievements
    { id: '10', appId: 'smartbuy', code: 'first_save', name: 'Tiết kiệm đầu tiên', description: 'Tìm được deal tiết kiệm đầu tiên', icon: '💰', category: 'starter', points: 10, requirement: { type: 'deals_found', value: 1 }, isShareable: true },
    { id: '11', appId: 'smartbuy', code: 'deal_hunter', name: 'Thợ săn deal', description: 'Tiết kiệm được 1 triệu đồng', icon: '🎯', category: 'power_user', points: 100, requirement: { type: 'total_saved', value: 1000000 }, isShareable: true },
    { id: '12', appId: 'smartbuy', code: 'price_tracker', name: 'Theo dõi giá', description: 'Theo dõi 10 sản phẩm', icon: '📊', category: 'regular', points: 30, requirement: { type: 'products_tracked', value: 10 }, isShareable: true },
    
    // FinTax Achievements
    { id: '20', appId: 'fintax', code: 'first_expense', name: 'Quản lý tài chính', description: 'Ghi nhận chi tiêu đầu tiên', icon: '💳', category: 'starter', points: 10, requirement: { type: 'expenses_logged', value: 1 }, isShareable: true },
    { id: '21', appId: 'fintax', code: 'budget_master', name: 'Bậc thầy ngân sách', description: 'Giữ ngân sách 3 tháng liên tiếp', icon: '🏆', category: 'power_user', points: 150, requirement: { type: 'budget_streak_months', value: 3 }, isShareable: true },
    { id: '22', appId: 'fintax', code: 'tax_ready', name: 'Sẵn sàng nộp thuế', description: 'Hoàn thành hồ sơ thuế', icon: '📋', category: 'regular', points: 50, requirement: { type: 'tax_profile_complete', value: 1 }, isShareable: true },
    
    // DoctorCar Achievements
    { id: '30', appId: 'doctorcar', code: 'first_car', name: 'Chủ xe mới', description: 'Thêm xe đầu tiên', icon: '🚗', category: 'starter', points: 10, requirement: { type: 'cars_added', value: 1 }, isShareable: true },
    { id: '31', appId: 'doctorcar', code: 'maintenance_pro', name: 'Chăm xe đúng cách', description: 'Hoàn thành 10 lần bảo dưỡng', icon: '🔧', category: 'power_user', points: 100, requirement: { type: 'maintenance_completed', value: 10 }, isShareable: true },
    { id: '32', appId: 'doctorcar', code: 'cost_tracker', name: 'Kiểm soát chi phí', description: 'Ghi nhận chi phí 6 tháng', icon: '📈', category: 'regular', points: 50, requirement: { type: 'cost_months_tracked', value: 6 }, isShareable: true },
    
    // CareMate Achievements
    { id: '40', appId: 'caremate', code: 'family_start', name: 'Gia đình khỏe mạnh', description: 'Thêm thành viên đầu tiên', icon: '👨‍👩‍👧', category: 'starter', points: 10, requirement: { type: 'members_added', value: 1 }, isShareable: true },
    { id: '41', appId: 'caremate', code: 'vaccination_hero', name: 'Tiêm chủng đầy đủ', description: 'Hoàn thành 10 mũi tiêm', icon: '💉', category: 'power_user', points: 100, requirement: { type: 'vaccinations_completed', value: 10 }, isShareable: true },
    { id: '42', appId: 'caremate', code: 'health_recorder', name: 'Lưu trữ hồ sơ', description: 'Lưu 20 hồ sơ sức khỏe', icon: '📋', category: 'regular', points: 50, requirement: { type: 'records_saved', value: 20 }, isShareable: true },
    
    // Cross-app viral achievements
    { id: '100', appId: 'all', code: 'first_referral', name: 'Người giới thiệu', description: 'Giới thiệu thành công 1 người', icon: '🤝', category: 'viral', points: 50, requirement: { type: 'referrals', value: 1 }, isShareable: true },
    { id: '101', appId: 'all', code: 'viral_star', name: 'Ngôi sao viral', description: 'Giới thiệu 10 người', icon: '⭐', category: 'viral', points: 200, requirement: { type: 'referrals', value: 10 }, isShareable: true },
    { id: '102', appId: 'all', code: 'share_master', name: 'Chia sẻ nhiệt tình', description: 'Chia sẻ 50 lần', icon: '📢', category: 'viral', points: 100, requirement: { type: 'shares', value: 50 }, isShareable: true }
  ];

  /**
   * Get achievements for a specific app
   */
  getAppAchievements(appId: string): Achievement[] {
    return this.ACHIEVEMENTS.filter(a => a.appId === appId || a.appId === 'all');
  }

  /**
   * Check if user has unlocked an achievement
   */
  checkAchievement(
    achievement: Achievement,
    userStats: Record<string, number>
  ): boolean {
    const currentValue = userStats[achievement.requirement.type] || 0;
    return currentValue >= achievement.requirement.value;
  }

  /**
   * Create shareable content for an achievement
   */
  createShareableAchievement(
    userId: string,
    achievement: Achievement,
    appId: string
  ): ShareableContent {
    return {
      id: uuidv4(),
      type: 'achievement',
      appId,
      userId,
      title: `🏆 Đạt được "${achievement.name}"`,
      description: achievement.description,
      stats: {
        points: achievement.points,
        category: achievement.category
      },
      createdAt: new Date()
    };
  }

  /**
   * Create shareable milestone content
   */
  createShareableMilestone(
    userId: string,
    appId: string,
    milestoneType: string,
    value: number,
    unit: string
  ): ShareableContent {
    const titles: Record<string, Record<string, string>> = {
      'trendbrief': {
        'briefs_read': `📚 Đã đọc ${value} bản tin tóm tắt!`,
        'time_saved': `⏱️ Tiết kiệm ${value} ${unit} đọc tin!`
      },
      'smartbuy': {
        'money_saved': `💰 Tiết kiệm ${value.toLocaleString('vi-VN')} đ!`,
        'deals_found': `🎯 Tìm được ${value} deal tốt!`
      },
      'fintax': {
        'expenses_tracked': `📊 Theo dõi ${value} khoản chi tiêu!`,
        'budget_saved': `💵 Tiết kiệm ${value.toLocaleString('vi-VN')} đ theo ngân sách!`
      },
      'doctorcar': {
        'maintenance_done': `🔧 Hoàn thành ${value} lần bảo dưỡng!`,
        'km_tracked': `🛣️ Theo dõi ${value.toLocaleString('vi-VN')} km!`
      },
      'caremate': {
        'vaccinations': `💉 Hoàn thành ${value} mũi tiêm chủng!`,
        'health_records': `📋 Lưu ${value} hồ sơ sức khỏe!`
      }
    };

    const appTitles = titles[appId] || {};
    const title = appTitles[milestoneType] || `🎉 Cột mốc mới: ${value} ${unit}`;

    return {
      id: uuidv4(),
      type: 'milestone',
      appId,
      userId,
      title,
      description: `Đạt được trên ${this.getAppName(appId)}`,
      stats: { [milestoneType]: value },
      createdAt: new Date()
    };
  }

  /**
   * Generate social share URLs
   */
  generateShareUrls(
    content: ShareableContent,
    referralCode?: string
  ): Record<string, string> {
    const baseUrl = `https://${content.appId}.vn`;
    const shareUrl = referralCode 
      ? `${baseUrl}/share/${content.id}?ref=${referralCode}`
      : `${baseUrl}/share/${content.id}`;
    
    const text = encodeURIComponent(`${content.title} ${content.description}`);
    const encodedUrl = encodeURIComponent(shareUrl);

    return {
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${text}`,
      twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodedUrl}`,
      zalo: `https://zalo.me/share?url=${encodedUrl}&title=${text}`,
      copy: shareUrl
    };
  }

  /**
   * Calculate viral coefficient
   * K = (invites sent per user) × (conversion rate)
   */
  calculateViralCoefficient(
    totalUsers: number,
    totalInvitesSent: number,
    totalConversions: number
  ): number {
    if (totalUsers === 0) return 0;
    const invitesPerUser = totalInvitesSent / totalUsers;
    const conversionRate = totalInvitesSent > 0 ? totalConversions / totalInvitesSent : 0;
    return invitesPerUser * conversionRate;
  }

  /**
   * Get app display name
   */
  private getAppName(appId: string): string {
    const names: Record<string, string> = {
      'trendbrief': 'TrendBrief AI',
      'smartbuy': 'SmartBuy AI',
      'fintax': 'FinTax AI',
      'doctorcar': 'DoctorCar AI',
      'caremate': 'CareMate AI'
    };
    return names[appId] || appId;
  }

  /**
   * Create streak shareable content
   */
  createStreakShareable(
    userId: string,
    appId: string,
    streakDays: number,
    streakType: string
  ): ShareableContent {
    const streakEmojis = ['🔥', '⚡', '💪', '🌟', '🚀'];
    const emoji = streakEmojis[Math.min(Math.floor(streakDays / 7), streakEmojis.length - 1)];

    return {
      id: uuidv4(),
      type: 'streak',
      appId,
      userId,
      title: `${emoji} ${streakDays} ngày liên tiếp!`,
      description: `Duy trì ${streakType} trên ${this.getAppName(appId)}`,
      stats: {
        days: streakDays,
        type: streakType
      },
      createdAt: new Date()
    };
  }
}

export const viralService = new ViralService();
