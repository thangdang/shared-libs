/**
 * Email Marketing Service - Shared Growth Infrastructure
 * Email automation, welcome sequences, digests, and re-engagement
 * For all 5 AI apps: TrendBrief, SmartBuy, FinTax, DoctorCar, CareMate
 * 
 * Integration: Mailerlite (free tier - 1000 subscribers)
 */

import { AppId } from './analytics.service';

export interface EmailSubscriber {
  subscriberId: string;
  email: string;
  name?: string;
  appId: AppId;
  status: 'pending' | 'active' | 'unsubscribed' | 'bounced';
  subscribedAt: Date;
  confirmedAt?: Date;
  unsubscribedAt?: Date;
  source: 'signup' | 'referral' | 'landing' | 'popup' | 'import';
  tags: string[];
  customFields: Record<string, any>;
  lastEmailSentAt?: Date;
  lastEmailOpenedAt?: Date;
  lastEmailClickedAt?: Date;
  emailsSent: number;
  emailsOpened: number;
  emailsClicked: number;
}

export interface EmailCampaign {
  campaignId: string;
  name: string;
  subject: string;
  preheader?: string;
  appId: AppId | 'all';
  type: 'regular' | 'automated' | 'transactional';
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  htmlContent: string;
  textContent: string;
  segments: string[];
  scheduledAt?: Date;
  sentAt?: Date;
  stats?: CampaignStats;
}

export interface CampaignStats {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  unsubscribed: number;
  openRate: number;
  clickRate: number;
}

export interface EmailSequence {
  sequenceId: string;
  name: string;
  appId: AppId | 'all';
  trigger: SequenceTrigger;
  steps: SequenceStep[];
  isActive: boolean;
}

export type SequenceTrigger = 
  | { type: 'signup'; delay?: number }
  | { type: 'tag_added'; tagName: string }
  | { type: 'purchase'; productType?: string }
  | { type: 'inactivity'; days: number }
  | { type: 'custom'; event: string };

export interface SequenceStep {
  stepId: string;
  stepOrder: number;
  delayDays: number;
  delayHours: number;
  subject: string;
  templateId: string;
  conditions?: StepCondition[];
}

export interface StepCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';
  value: any;
}

export interface EmailTemplate {
  templateId: string;
  name: string;
  appId: AppId | 'all';
  category: 'welcome' | 'digest' | 'transactional' | 'promotional' | 're-engagement';
  subject: string;
  preheader?: string;
  htmlContent: string;
  textContent: string;
  variables: string[];
}

// Welcome Email Sequence Templates
export const WELCOME_SEQUENCE_TEMPLATES: EmailTemplate[] = [
  // Day 0 - Welcome
  {
    templateId: 'welcome-day0',
    name: 'Welcome Email',
    appId: 'all',
    category: 'welcome',
    subject: 'Chào mừng {{name}} đến với {{appName}}! 🎉',
    preheader: 'Cảm ơn bạn đã đăng ký. Khám phá những tính năng tuyệt vời ngay!',
    variables: ['name', 'appName', 'loginUrl', 'featuresUrl'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#3b82f6,#2563eb);">
        <h1 style="color:white;font-size:28px;margin:0;">Chào mừng đến với {{appName}}! 🎉</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 30px;">
        <p style="font-size:18px;color:#111827;margin:0 0 20px;">Xin chào {{name}},</p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Cảm ơn bạn đã đăng ký {{appName}}!  Chúng tôi rất vui được chào đón bạn.
        </p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 30px;">
          Bắt đầu khám phá các tính năng ngay hôm nay và tận dụng tối đa {{appName}}.
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:#3b82f6;border-radius:8px;">
              <a href="{{loginUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Bắt đầu ngay →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:30px;background:#f9fafb;text-align:center;">
        <p style="font-size:14px;color:#6b7280;margin:0;">
          Bạn nhận được email này vì đã đăng ký {{appName}}.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Chào mừng đến với {{appName}}!

Xin chào {{name}},

Cảm ơn bạn đã đăng ký {{appName}}!  Chúng tôi rất vui được chào đón bạn.

Bắt đầu ngay: {{loginUrl}}

---
Bạn nhận được email này vì đã đăng ký {{appName}}.`
  },

  // Day 1 - Feature Introduction
  {
    templateId: 'welcome-day1',
    name: 'Feature Introduction',
    appId: 'all',
    category: 'welcome',
    subject: '{{name}}, khám phá 3 tính năng hàng đầu của {{appName}}',
    preheader: 'Những tính năng này sẽ giúp bạn tiết kiệm thời gian mỗi ngày',
    variables: ['name', 'appName', 'feature1', 'feature2', 'feature3', 'tutorialUrl'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;">
        <p style="font-size:18px;color:#111827;margin:0 0 20px;">Xin chào {{name}},</p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 30px;">
          Hôm nay, chúng tôi muốn giới thiệu 3 tính năng hàng đầu của {{appName}} mà nhiều người dùng yêu thích:
        </p>
        
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:30px;">
          <tr>
            <td style="padding:20px;background:#f0fdf4;border-radius:12px;margin-bottom:16px;">
              <p style="font-size:24px;margin:0 0 10px;">1️⃣</p>
              <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 8px;">{{feature1}}</p>
            </td>
          </tr>
          <tr><td style="height:16px;"></td></tr>
          <tr>
            <td style="padding:20px;background:#eff6ff;border-radius:12px;margin-bottom:16px;">
              <p style="font-size:24px;margin:0 0 10px;">2️⃣</p>
              <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 8px;">{{feature2}}</p>
            </td>
          </tr>
          <tr><td style="height:16px;"></td></tr>
          <tr>
            <td style="padding:20px;background:#fef3c7;border-radius:12px;">
              <p style="font-size:24px;margin:0 0 10px;">3️⃣</p>
              <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 8px;">{{feature3}}</p>
            </td>
          </tr>
        </table>

        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:#3b82f6;border-radius:8px;">
              <a href="{{tutorialUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Xem hướng dẫn chi tiết →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Xin chào {{name}},

Hôm nay, chúng tôi muốn giới thiệu 3 tính năng hàng đầu của {{appName}}:

1️⃣ {{feature1}}
2️⃣ {{feature2}}
3️⃣ {{feature3}}

Xem hướng dẫn: {{tutorialUrl}}`
  },

  // Day 3 - Tips & Tricks
  {
    templateId: 'welcome-day3',
    name: 'Tips & Tricks',
    appId: 'all',
    category: 'welcome',
    subject: '💡 5 mẹo để sử dụng {{appName}} hiệu quả hơn',
    preheader: 'Những bí quyết từ người dùng chuyên nghiệp',
    variables: ['name', 'appName', 'tip1', 'tip2', 'tip3', 'tip4', 'tip5', 'communityUrl'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;">
        <p style="font-size:18px;color:#111827;margin:0 0 20px;">Xin chào {{name}},</p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 30px;">
          Sau 3 ngày sử dụng {{appName}}, đây là một số mẹo hay từ cộng đồng:
        </p>
        
        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 15px;">💡 <strong>Mẹo 1:</strong> {{tip1}}</p>
        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 15px;">💡 <strong>Mẹo 2:</strong> {{tip2}}</p>
        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 15px;">💡 <strong>Mẹo 3:</strong> {{tip3}}</p>
        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 15px;">💡 <strong>Mẹo 4:</strong> {{tip4}}</p>
        <p style="font-size:15px;color:#374151;line-height:1.8;margin:0 0 30px;">💡 <strong>Mẹo 5:</strong> {{tip5}}</p>

        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Có câu hỏi?  Tham gia cộng đồng để được hỗ trợ nhanh nhất!
        </p>
        
        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:#10b981;border-radius:8px;">
              <a href="{{communityUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Tham gia cộng đồng →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Xin chào {{name}},

Sau 3 ngày sử dụng {{appName}}, đây là một số mẹo hay:

💡 Mẹo 1: {{tip1}}
💡 Mẹo 2: {{tip2}}
💡 Mẹo 3: {{tip3}}
💡 Mẹo 4: {{tip4}}
💡 Mẹo 5: {{tip5}}

Tham gia cộng đồng: {{communityUrl}}`
  },

  // Day 7 - Premium Upsell
  {
    templateId: 'welcome-day7',
    name: 'Premium Upsell',
    appId: 'all',
    category: 'welcome',
    subject: '🎁 {{name}}, nhận 7 ngày Premium miễn phí!',
    preheader: 'Trải nghiệm tất cả tính năng cao cấp không giới hạn',
    variables: ['name', 'appName', 'premiumBenefit1', 'premiumBenefit2', 'premiumBenefit3', 'upgradeUrl'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#f59e0b,#d97706);">
        <p style="font-size:48px;margin:0 0 10px;">🎁</p>
        <h1 style="color:white;font-size:24px;margin:0;">7 ngày Premium miễn phí!</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 30px;">
        <p style="font-size:18px;color:#111827;margin:0 0 20px;">Xin chào {{name}},</p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 30px;">
          Bạn đã sử dụng {{appName}} được 1 tuần rồi!  Để cảm ơn bạn, chúng tôi tặng bạn 7 ngày dùng thử Premium hoàn toàn miễn phí.
        </p>
        
        <p style="font-size:16px;font-weight:600;color:#111827;margin:0 0 15px;">
          Với Premium, bạn sẽ có:
        </p>
        
        <p style="font-size:15px;color:#374151;margin:0 0 12px;">✅ {{premiumBenefit1}}</p>
        <p style="font-size:15px;color:#374151;margin:0 0 12px;">✅ {{premiumBenefit2}}</p>
        <p style="font-size:15px;color:#374151;margin:0 0 30px;">✅ {{premiumBenefit3}}</p>

        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:linear-gradient(135deg,#f59e0b,#d97706);border-radius:8px;">
              <a href="{{upgradeUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Kích hoạt Premium miễn phí →
              </a>
            </td>
          </tr>
        </table>
        
        <p style="font-size:14px;color:#9ca3af;text-align:center;margin:20px 0 0;">
          *Không cần thẻ tín dụng.  Tự động hết hạn sau 7 ngày.
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Xin chào {{name}},

Bạn đã sử dụng {{appName}} được 1 tuần!  Để cảm ơn bạn, chúng tôi tặng 7 ngày Premium miễn phí.

Với Premium, bạn sẽ có:
✅ {{premiumBenefit1}}
✅ {{premiumBenefit2}}
✅ {{premiumBenefit3}}

Kích hoạt ngay: {{upgradeUrl}}

*Không cần thẻ tín dụng.`
  }
];

// Weekly Digest Template
export const WEEKLY_DIGEST_TEMPLATE: EmailTemplate = {
  templateId: 'weekly-digest',
  name: 'Weekly Digest',
  appId: 'all',
  category: 'digest',
  subject: '📬 Bản tin tuần {{weekNumber}} - {{appName}}',
  preheader: 'Những điều bạn có thể đã bỏ lỡ tuần này',
  variables: ['name', 'appName', 'weekNumber', 'highlights', 'topItems', 'statsHtml', 'appUrl'],
  htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:30px;text-align:center;background:#111827;">
        <h1 style="color:white;font-size:22px;margin:0;">📬 Bản tin tuần {{weekNumber}}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:30px;">
        <p style="font-size:16px;color:#111827;margin:0 0 20px;">Xin chào {{name}},</p>
        <p style="font-size:15px;color:#4b5563;line-height:1.6;margin:0 0 30px;">
          Đây là những điểm nổi bật của tuần này từ {{appName}}:
        </p>
        
        <h2 style="font-size:18px;color:#111827;margin:0 0 15px;border-bottom:2px solid #e5e7eb;padding-bottom:10px;">
          🌟 Điểm nổi bật
        </h2>
        {{highlights}}
        
        <h2 style="font-size:18px;color:#111827;margin:30px 0 15px;border-bottom:2px solid #e5e7eb;padding-bottom:10px;">
          📊 Thống kê của bạn
        </h2>
        {{statsHtml}}
        
        <h2 style="font-size:18px;color:#111827;margin:30px 0 15px;border-bottom:2px solid #e5e7eb;padding-bottom:10px;">
          🔥 Top tuần này
        </h2>
        {{topItems}}
        
        <table cellpadding="0" cellspacing="0" style="margin:30px auto 0;">
          <tr>
            <td style="background:#3b82f6;border-radius:8px;">
              <a href="{{appUrl}}" style="display:inline-block;padding:14px 28px;color:white;text-decoration:none;font-weight:600;font-size:15px;">
                Xem thêm →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
  textContent: `Bản tin tuần {{weekNumber}} - {{appName}}

Xin chào {{name}},

Đây là những điểm nổi bật của tuần này:

{{highlights}}

Xem thêm: {{appUrl}}`
};

// Re-engagement Templates
export const REENGAGEMENT_TEMPLATES: EmailTemplate[] = [
  // 7 days inactive
  {
    templateId: 'reengagement-7days',
    name: '7 Day Re-engagement',
    appId: 'all',
    category: 're-engagement',
    subject: '{{name}}, chúng tôi nhớ bạn! 😊',
    preheader: 'Đã 7 ngày rồi bạn chưa ghé thăm',
    variables: ['name', 'appName', 'lastActivity', 'newFeature', 'returnUrl'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;text-align:center;">
        <p style="font-size:64px;margin:0 0 20px;">😊</p>
        <h1 style="font-size:24px;color:#111827;margin:0 0 10px;">Chúng tôi nhớ bạn!</h1>
        <p style="font-size:16px;color:#6b7280;margin:0;">Đã 7 ngày rồi bạn chưa ghé thăm {{appName}}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:0 30px 40px;">
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Xin chào {{name}},
        </p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Hoạt động cuối cùng của bạn là vào {{lastActivity}}.  Kể từ đó, chúng tôi đã có một số cập nhật mới:
        </p>
        
        <div style="background:#f0fdf4;border-radius:12px;padding:20px;margin:0 0 30px;">
          <p style="font-size:16px;font-weight:600;color:#059669;margin:0 0 8px;">🆕 Tính năng mới</p>
          <p style="font-size:15px;color:#374151;margin:0;">{{newFeature}}</p>
        </div>

        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:#3b82f6;border-radius:8px;">
              <a href="{{returnUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Quay lại {{appName}} →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Chúng tôi nhớ bạn!

Xin chào {{name}},

Đã 7 ngày rồi bạn chưa ghé thăm {{appName}}.

Tính năng mới: {{newFeature}}

Quay lại ngay: {{returnUrl}}`
  },

  // 30 days inactive - Special offer
  {
    templateId: 'reengagement-30days',
    name: '30 Day Re-engagement',
    appId: 'all',
    category: 're-engagement',
    subject: '🎁 {{name}}, quay lại nhận ưu đãi đặc biệt!',
    preheader: '14 ngày Premium miễn phí dành riêng cho bạn',
    variables: ['name', 'appName', 'specialOfferUrl', 'expiryDate'],
    htmlContent: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f9fafb;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:white;">
    <tr>
      <td style="padding:40px 30px;text-align:center;background:linear-gradient(135deg,#7c3aed,#5b21b6);">
        <p style="font-size:64px;margin:0 0 15px;">🎁</p>
        <h1 style="font-size:26px;color:white;margin:0 0 10px;">Ưu đãi đặc biệt!</h1>
        <p style="font-size:40px;font-weight:800;color:#fde68a;margin:0;">14 NGÀY PREMIUM</p>
        <p style="font-size:18px;color:white;margin:10px 0 0;">MIỄN PHÍ</p>
      </td>
    </tr>
    <tr>
      <td style="padding:40px 30px;">
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Xin chào {{name}},
        </p>
        <p style="font-size:16px;color:#4b5563;line-height:1.6;margin:0 0 20px;">
          Chúng tôi rất nhớ bạn và muốn mời bạn quay lại {{appName}} với một ưu đãi đặc biệt:  <strong>14 ngày Premium hoàn toàn miễn phí!</strong>
        </p>
        <p style="font-size:15px;color:#dc2626;font-weight:600;margin:0 0 30px;">
          ⏰ Ưu đãi hết hạn: {{expiryDate}}
        </p>

        <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#5b21b6);border-radius:8px;">
              <a href="{{specialOfferUrl}}" style="display:inline-block;padding:16px 32px;color:white;text-decoration:none;font-weight:600;font-size:16px;">
                Nhận ưu đãi ngay →
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
    textContent: `Ưu đãi đặc biệt dành cho bạn!

Xin chào {{name}},

Chúng tôi mời bạn quay lại {{appName}} với 14 ngày Premium miễn phí!

⏰ Ưu đãi hết hạn: {{expiryDate}}

Nhận ưu đãi: {{specialOfferUrl}}`
  }
];

class EmailMarketingService {
  private apiKey: string = '';
  private baseUrl = 'https://api.mailerlite.com/api/v2';
  private appId: AppId;

  constructor() {
    this.appId = this.detectAppId();
  }

  private detectAppId(): AppId {
    const hostname = typeof window !== 'undefined' ? window.location.hostname : '';
    if (hostname.includes('trendbrief')) return 'trendbrief';
    if (hostname.includes('smartbuy')) return 'smartbuy';
    if (hostname.includes('fintax')) return 'fintax';
    if (hostname.includes('doctorcar')) return 'doctorcar';
    if (hostname.includes('caremate')) return 'caremate';
    return 'trendbrief';
  }

  /**
   * Initialize with API key
   */
  initialize(apiKey: string): void {
    this.apiKey = apiKey;
  }

  /**
   * Add subscriber
   */
  async addSubscriber(email: string, name?: string, tags?: string[]): Promise<EmailSubscriber | null> {
    try {
      const response = await fetch(`${this.baseUrl}/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': this.apiKey
        },
        body: JSON.stringify({
          email,
          name,
          fields: {
            app_id: this.appId
          },
          groups: tags
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to add subscriber: ${response.statusText}`);
      }

      const data = await response.json();
      return this.mapToSubscriber(data);
    } catch (error) {
      console.error('Add subscriber failed:', error);
      return null;
    }
  }

  /**
   * Update subscriber
   */
  async updateSubscriber(email: string, updates: Partial<EmailSubscriber>): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/subscribers/${email}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'X-MailerLite-ApiKey': this.apiKey
        },
        body: JSON.stringify({
          name: updates.name,
          fields: updates.customFields
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Update subscriber failed:', error);
      return false;
    }
  }

  /**
   * Add tag to subscriber
   */
  async addTag(email: string, tag: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/subscribers/${email}/groups/${tag}`, {
        method: 'POST',
        headers: {
          'X-MailerLite-ApiKey': this.apiKey
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Add tag failed:', error);
      return false;
    }
  }

  /**
   * Send transactional email
   */
  async sendEmail(
    to: string,
    templateId: string,
    variables: Record<string, string>
  ): Promise<boolean> {
    // In production, this would use Mailerlite's transactional API
    // For now, we'll simulate the send
    console.log('Sending email:', { to, templateId, variables });
    
    try {
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template not found: ${templateId}`);
      }

      // Replace variables in template
      let html = template.htmlContent;
      let text = template.textContent;
      let subject = template.subject;

      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{${key}}}`, 'g');
        html = html.replace(regex, value);
        text = text.replace(regex, value);
        subject = subject.replace(regex, value);
      }

      // Send via API
      const response = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to,
          subject,
          html,
          text
        })
      });

      return response.ok;
    } catch (error) {
      console.error('Send email failed:', error);
      return false;
    }
  }

  /**
   * Start welcome sequence for new subscriber
   */
  async startWelcomeSequence(email: string, name: string): Promise<void> {
    await this.addTag(email, 'welcome-sequence');
    
    // Send immediate welcome email
    await this.sendEmail(email, 'welcome-day0', {
      name,
      appName: this.getAppName(),
      loginUrl: this.getAppUrl(),
      featuresUrl: `${this.getAppUrl()}/features`
    });
  }

  /**
   * Send weekly digest
   */
  async sendWeeklyDigest(
    email: string,
    name: string,
    highlights: string,
    topItems: string,
    statsHtml: string
  ): Promise<boolean> {
    const weekNumber = this.getWeekNumber();
    
    return this.sendEmail(email, 'weekly-digest', {
      name,
      appName: this.getAppName(),
      weekNumber: weekNumber.toString(),
      highlights,
      topItems,
      statsHtml,
      appUrl: this.getAppUrl()
    });
  }

  /**
   * Trigger re-engagement email
   */
  async sendReengagementEmail(
    email: string,
    name: string,
    daysInactive: number,
    lastActivity: string
  ): Promise<boolean> {
    const templateId = daysInactive >= 30 ? 'reengagement-30days' : 'reengagement-7days';
    
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 7);

    return this.sendEmail(email, templateId, {
      name,
      appName: this.getAppName(),
      lastActivity,
      newFeature: this.getNewFeatureDescription(),
      returnUrl: this.getAppUrl(),
      specialOfferUrl: `${this.getAppUrl()}/reactivate?offer=14days`,
      expiryDate: expiryDate.toLocaleDateString('vi-VN')
    });
  }

  /**
   * Get template by ID
   */
  private getTemplate(templateId: string): EmailTemplate | undefined {
    const allTemplates = [
      ...WELCOME_SEQUENCE_TEMPLATES,
      WEEKLY_DIGEST_TEMPLATE,
      ...REENGAGEMENT_TEMPLATES
    ];
    return allTemplates.find(t => t.templateId === templateId);
  }

  /**
   * Map API response to subscriber
   */
  private mapToSubscriber(data: any): EmailSubscriber {
    return {
      subscriberId: data.id,
      email: data.email,
      name: data.name,
      appId: this.appId,
      status: data.status || 'active',
      subscribedAt: new Date(data.date_subscribe),
      confirmedAt: data.date_confirmed ? new Date(data.date_confirmed) : undefined,
      source: 'signup',
      tags: data.groups?.map((g: any) => g.name) || [],
      customFields: data.fields || {},
      emailsSent: data.sent || 0,
      emailsOpened: data.opened || 0,
      emailsClicked: data.clicked || 0
    };
  }

  /**
   * Get current week number
   */
  private getWeekNumber(): number {
    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - start.getTime();
    const oneWeek = 604800000;
    return Math.ceil(diff / oneWeek);
  }

  /**
   * Get app name for templates
   */
  private getAppName(): string {
    const names: Record<AppId, string> = {
      trendbrief: 'TrendBrief',
      smartbuy: 'SmartBuy',
      fintax: 'FinTax',
      doctorcar: 'DoctorCar',
      caremate: 'CareMate'
    };
    return names[this.appId];
  }

  /**
   * Get app URL
   */
  private getAppUrl(): string {
    const urls: Record<AppId, string> = {
      trendbrief: 'https://trendbrief.vn',
      smartbuy: 'https://smartbuy.vn',
      fintax: 'https://fintax.vn',
      doctorcar: 'https://doctorcar.vn',
      caremate: 'https://caremate.vn'
    };
    return urls[this.appId];
  }

  /**
   * Get new feature description for re-engagement
   */
  private getNewFeatureDescription(): string {
    const features: Record<AppId, string> = {
      trendbrief: 'Theo dõi xu hướng theo ngành với thông báo realtime',
      smartbuy: 'So sánh giá từ 10+ sàn TMĐT với biểu đồ lịch sử giá',
      fintax: 'Máy tính thuế TNCN 2026 với các khoản giảm trừ mới nhất',
      doctorcar: 'Tra cứu mã lỗi DTC với hướng dẫn chi tiết bằng tiếng Việt',
      caremate: 'Quản lý lịch tiêm chủng cho cả gia đình với nhắc nhở tự động'
    };
    return features[this.appId];
  }
}

// Singleton instance
export const emailMarketingService = new EmailMarketingService();

// Convenience exports
export const addEmailSubscriber = (email: string, name?: string, tags?: string[]) =>
  emailMarketingService.addSubscriber(email, name, tags);

export const startWelcomeSequence = (email: string, name: string) =>
  emailMarketingService.startWelcomeSequence(email, name);

export const sendWeeklyDigest = (
  email: string,
  name: string,
  highlights: string,
  topItems: string,
  statsHtml: string
) => emailMarketingService.sendWeeklyDigest(email, name, highlights, topItems, statsHtml);
