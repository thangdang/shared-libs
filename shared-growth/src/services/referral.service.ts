/**
 * Referral Service - Shared across all 5 apps
 * Handles referral code generation, tracking, and rewards
 */

import { v4 as uuidv4 } from 'uuid';

export interface ReferralCode {
  id: string;
  code: string;
  userId: string;
  appId: string;
  createdAt: Date;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  isActive: boolean;
}

export interface ReferralReward {
  id: string;
  referrerId: string;
  referredId: string;
  referralCodeId: string;
  appId: string;
  rewardType: 'premium_days' | 'discount' | 'feature_unlock';
  rewardValue: number;
  status: 'pending' | 'granted' | 'expired';
  createdAt: Date;
  grantedAt?: Date;
}

export interface ReferralStats {
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
  currentStreak: number;
}

export class ReferralService {
  private readonly CODE_LENGTH = 8;
  private readonly CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  
  // Reward configuration per app
  private readonly REWARDS_CONFIG: Record<string, {
    referrerReward: number;
    referredReward: number;
    rewardType: 'premium_days' | 'discount';
  }> = {
    'trendbrief': { referrerReward: 7, referredReward: 3, rewardType: 'premium_days' },
    'smartbuy': { referrerReward: 7, referredReward: 3, rewardType: 'premium_days' },
    'fintax': { referrerReward: 14, referredReward: 7, rewardType: 'premium_days' },
    'doctorcar': { referrerReward: 7, referredReward: 3, rewardType: 'premium_days' },
    'caremate': { referrerReward: 7, referredReward: 3, rewardType: 'premium_days' }
  };

  /**
   * Generate a unique referral code for a user
   */
  generateReferralCode(userId: string, appId: string): ReferralCode {
    const code = this.createUniqueCode();
    
    return {
      id: uuidv4(),
      code,
      userId,
      appId,
      createdAt: new Date(),
      currentUses: 0,
      isActive: true
    };
  }

  /**
   * Create a unique alphanumeric code
   */
  private createUniqueCode(): string {
    let code = '';
    for (let i = 0; i < this.CODE_LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * this.CODE_CHARS.length);
      code += this.CODE_CHARS[randomIndex];
    }
    return code;
  }

  /**
   * Validate a referral code
   */
  validateReferralCode(
    code: ReferralCode,
    newUserId: string
  ): { valid: boolean; error?: string } {
    if (!code.isActive) {
      return { valid: false, error: 'Mã giới thiệu không còn hoạt động' };
    }

    if (code.expiresAt && new Date() > code.expiresAt) {
      return { valid: false, error: 'Mã giới thiệu đã hết hạn' };
    }

    if (code.maxUses && code.currentUses >= code.maxUses) {
      return { valid: false, error: 'Mã giới thiệu đã đạt giới hạn sử dụng' };
    }

    if (code.userId === newUserId) {
      return { valid: false, error: 'Không thể sử dụng mã giới thiệu của chính mình' };
    }

    return { valid: true };
  }

  /**
   * Process a successful referral
   */
  processReferral(
    referralCode: ReferralCode,
    newUserId: string
  ): { referrerReward: ReferralReward; referredReward: ReferralReward } {
    const config = this.REWARDS_CONFIG[referralCode.appId] || this.REWARDS_CONFIG['trendbrief'];

    const referrerReward: ReferralReward = {
      id: uuidv4(),
      referrerId: referralCode.userId,
      referredId: newUserId,
      referralCodeId: referralCode.id,
      appId: referralCode.appId,
      rewardType: config.rewardType,
      rewardValue: config.referrerReward,
      status: 'pending',
      createdAt: new Date()
    };

    const referredReward: ReferralReward = {
      id: uuidv4(),
      referrerId: referralCode.userId,
      referredId: newUserId,
      referralCodeId: referralCode.id,
      appId: referralCode.appId,
      rewardType: config.rewardType,
      rewardValue: config.referredReward,
      status: 'granted',
      createdAt: new Date(),
      grantedAt: new Date()
    };

    return { referrerReward, referredReward };
  }

  /**
   * Calculate referral statistics for a user
   */
  calculateStats(rewards: ReferralReward[], userId: string): ReferralStats {
    const userReferrals = rewards.filter(r => r.referrerId === userId);
    
    return {
      totalReferrals: userReferrals.length,
      successfulReferrals: userReferrals.filter(r => r.status === 'granted').length,
      pendingReferrals: userReferrals.filter(r => r.status === 'pending').length,
      totalRewardsEarned: userReferrals
        .filter(r => r.status === 'granted')
        .reduce((sum, r) => sum + r.rewardValue, 0),
      currentStreak: this.calculateStreak(userReferrals)
    };
  }

  /**
   * Calculate referral streak (consecutive days with referrals)
   */
  private calculateStreak(rewards: ReferralReward[]): number {
    if (rewards.length === 0) return 0;

    const sortedDates = rewards
      .map(r => new Date(r.createdAt).toDateString())
      .filter((date, index, self) => self.indexOf(date) === index)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

    let streak = 1;
    const today = new Date().toDateString();
    
    if (sortedDates[0] !== today) return 0;

    for (let i = 1; i < sortedDates.length; i++) {
      const prevDate = new Date(sortedDates[i - 1]);
      const currDate = new Date(sortedDates[i]);
      const diffDays = Math.floor((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  }

  /**
   * Generate shareable referral link
   */
  generateShareLink(code: string, appId: string): string {
    const appDomains: Record<string, string> = {
      'trendbrief': 'trendbrief.vn',
      'smartbuy': 'smartbuy.vn',
      'fintax': 'fintax.vn',
      'doctorcar': 'doctorcar.vn',
      'caremate': 'caremate.vn'
    };

    const domain = appDomains[appId] || `${appId}.app`;
    return `https://${domain}/ref/${code}`;
  }

  /**
   * Generate share message for different platforms
   */
  generateShareMessage(
    appId: string,
    code: string,
    platform: 'zalo' | 'facebook' | 'copy'
  ): string {
    const appNames: Record<string, string> = {
      'trendbrief': 'TrendBrief AI',
      'smartbuy': 'SmartBuy AI',
      'fintax': 'FinTax AI',
      'doctorcar': 'DoctorCar AI',
      'caremate': 'CareMate AI'
    };

    const appDescriptions: Record<string, string> = {
      'trendbrief': 'tóm tắt tin tức thông minh',
      'smartbuy': 'so sánh giá và tìm deal tốt nhất',
      'fintax': 'quản lý tài chính và thuế cá nhân',
      'doctorcar': 'chăm sóc và bảo dưỡng xe hơi',
      'caremate': 'chăm sóc sức khỏe gia đình'
    };

    const appName = appNames[appId] || appId;
    const description = appDescriptions[appId] || '';
    const link = this.generateShareLink(code, appId);

    const messages: Record<string, string> = {
      zalo: `🎁 Mình đang dùng ${appName} - ${description}.  Rất hay!  Đăng ký qua link này để được tặng Premium miễn phí:  ${link}`,
      facebook: `Khám phá ${appName} - ứng dụng ${description} cực kỳ hữu ích!  Dùng mã ${code} để nhận Premium miễn phí 🎉\n\n${link}`,
      copy: `${appName} - ${description}\nMã giới thiệu: ${code}\nLink: ${link}`
    };

    return messages[platform] || messages.copy;
  }
}

export const referralService = new ReferralService();
