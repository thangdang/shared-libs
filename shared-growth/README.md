# Shared Growth Infrastructure

Thư viện hạ tầng tăng trưởng organic cho 5 ứng dụng AI:
- **TrendBrief** - Theo dõi xu hướng
- **SmartBuy** - So sánh mua sắm thông minh
- **FinTax** - Quản lý tài chính & thuế
- **DoctorCar** - Chăm sóc xe
- **CareMate** - Sức khỏe gia đình

## Tính năng

### Services

#### Analytics Service
- User tracking và session management
- Funnel analysis với predefined funnels cho từng app
- Conversion goals và metrics
- Cohort analysis
- Real-time active users

#### A/B Testing Service
- Experiment management
- Variant assignment (deterministic hashing)
- Statistical significance calculation
- Predefined growth experiments:
  - Landing page headline test
  - Pricing page layout test
  - Referral incentive test
  - Onboarding flow test
  - CTA button color test
  - Social proof test

#### Notification Service
- Push notifications (Web Push API)
- Email notifications
- In-app notifications
- Notification preferences
- Predefined templates:
  - Welcome/onboarding sequence
  - Referral notifications
  - Achievement notifications
  - Premium notifications
  - Re-engagement notifications
  - App-specific reminders

#### Referral Service
- Referral code generation
- Referral tracking
- Reward calculation (7-14 Premium days per referral)
- Referral history

#### Viral Service
- Achievement system
- Streak tracking
- Leaderboards
- Points system
- Social sharing

#### SEO Service
- Meta tags management
- Structured data (JSON-LD)
- Open Graph tags
- Sitemap generation
- Robots.txt management

#### Performance Service
- Core Web Vitals monitoring (LCP, FID, CLS)
- Performance metrics tracking
- Optimization recommendations

#### Web Push Service (OneSignal)
- OneSignal integration (free tier)
- App-specific alerts:
  - TrendBrief:  Breaking news alerts
  - SmartBuy:  Price drop alerts, flash sale alerts
  - FinTax:  Tax deadline reminders
  - DoctorCar:  Maintenance reminders
  - CareMate:  Medication reminders
- User segmentation by app, premium status, tags
- Scheduled notifications

#### Email Marketing Service (Mailerlite)
- Mailerlite integration (free tier up to 1000 subscribers)
- Welcome sequence (day 0, 1, 3, 7)
- Weekly digest templates (app-specific)
- Re-engagement campaigns (7-day, 14-day, 30-day)
- Subscriber management

#### OG Meta Service
- Dynamic Open Graph meta tags
- Twitter Card support
- App-specific OG configurations
- Helper methods for:
  - Price drop sharing (SmartBuy)
  - Article sharing (TrendBrief)
  - Tax result sharing (FinTax)
  - DTC code sharing (DoctorCar)
  - Drug info sharing (CareMate)

### Components (Angular 19+)

#### ReferralDashboardComponent
Dashboard quản lý referral đầy đủ với:
- Referral code display
- Stats (total, successful, pending, rewards)
- Conversion rate progress
- Referral history list
- How it works guide

#### ShareModalComponent
Modal chia sẻ social với các platforms:
- Facebook, Twitter, LinkedIn
- Zalo, Telegram, WhatsApp
- Email, Copy link

#### AchievementBadgeComponent
Hiển thị achievement/badge với:
- Rarity levels (common → legendary)
- Progress indicator
- Lock/unlock states
- Reward preview

#### StreakDisplayComponent
Hiển thị streak với 3 variants:
- `minimal`:  Compact icon + count
- `compact`:  Icon + count + history dots
- `full`:  Full stats + progress + weekly history

#### LeaderboardComponent
Bảng xếp hạng với:
- Top 3 podium
- Period switching (daily/weekly/monthly/all-time)
- Category tabs (points/streak/referrals)
- Rank change indicators

#### SocialShareButtonsComponent (GRW-016)
Nút chia sẻ social cho VN market:
- Zalo (priority), Facebook, Telegram, Twitter, LinkedIn
- Copy to clipboard
- 3 layouts:  horizontal, vertical, compact
- 3 sizes:  small, medium, large
- Analytics tracking

#### ShareCardComponent (GRW-017, GRW-018)
Tạo ảnh chia sẻ cho:
- Price drop cards (SmartBuy)
- Tax result cards (FinTax)
- DTC code cards (DoctorCar)
- Drug info cards (CareMate)
- News article cards (TrendBrief)
- Download as PNG (html2canvas)
- Integrated social share buttons

#### FAQPageComponent (GRW-004)
Trang FAQ đầy đủ tính năng:
- Category filtering
- Search functionality
- Accordion UI
- Schema.org FAQPage markup for SEO
- Feedback (helpful/not helpful)
- Related links
- Vietnamese language

#### HowToGuideComponent (GRW-005)
Component hướng dẫn step-by-step:
- Numbered steps with progress
- Images/videos per step
- Tips and warnings
- Duration per step
- Schema.org HowTo markup for SEO
- Prerequisites and tools needed
- Related guides

## Sử dụng

### Import Services

```typescript
import { 
  analyticsService, 
  trackPageView, 
  trackConversion,
  abTestingService,
  getVariant,
  notificationService,
  referralService,
  viralService,
  webPushService,
  emailMarketingService,
  OGMetaService
} from '@aivn/shared-growth';

// Track page view
trackPageView('landing');

// Track conversion
trackConversion('signup_completed');

// Get A/B test variant
const variant = getVariant('exp-landing-headline');

// Check achievement
viralService.checkAndUnlockAchievement('first_login');

// Send push notification
webPushService.sendPriceDropAlert({
  productName: 'iPhone 15',
  currentPrice: 22990000,
  discountPercent: 15,
  productUrl: 'https://...'
});

// Add to email sequence
emailMarketingService.addToWelcomeSequence('user@email.com', 'trendbrief', true);
```

### Import Components

```typescript
import {
  ReferralDashboardComponent,
  ShareModalComponent,
  AchievementBadgeComponent,
  StreakDisplayComponent,
  LeaderboardComponent,
  SocialShareButtonsComponent,
  ShareCardComponent,
  FAQPageComponent,
  HowToGuideComponent
} from '@aivn/shared-growth';

@Component({
  imports: [
    ReferralDashboardComponent,
    ShareModalComponent,
    AchievementBadgeComponent,
    StreakDisplayComponent,
    LeaderboardComponent,
    SocialShareButtonsComponent,
    ShareCardComponent,
    FAQPageComponent,
    HowToGuideComponent
  ]
})
export class MyFeatureComponent {}
```

### Template Usage

```html
<!-- Referral Dashboard -->
<app-referral-dashboard
  [stats]="referralStats"
  [rewardDaysPerReferral]="7"
  [appName]="'TrendBrief'"
  (shareClicked)="openShareModal()"
  (copyCode)="onCodeCopied($event)">
</app-referral-dashboard>

<!-- Share Modal -->
<app-share-modal
  [isOpen]="showShareModal"
  [shareOptions]="shareOptions"
  [platforms]="['facebook', 'zalo', 'telegram', 'twitter', 'email', 'copy']"
  (closed)="showShareModal = false"
  (shared)="onShared($event)">
</app-share-modal>

<!-- Achievement Badge -->
<app-achievement-badge
  [achievement]="achievement"
  [size]="'medium'"
  (badgeClick)="showAchievementDetails($event)">
</app-achievement-badge>

<!-- Streak Display -->
<app-streak-display
  [streakData]="userStreak"
  [variant]="'compact'"
  (streakClick)="showStreakDetails()">
</app-streak-display>

<!-- Leaderboard -->
<app-leaderboard
  [data]="leaderboardData"
  [maxEntries]="10"
  (periodChange)="onPeriodChange($event)"
  (categoryChange)="onCategoryChange($event)"
  (userClick)="viewUserProfile($event)">
</app-leaderboard>

<!-- Social Share Buttons -->
<app-social-share-buttons
  [content]="shareContent"
  [platforms]="['zalo', 'facebook', 'telegram', 'copy']"
  layout="horizontal"
  size="medium"
  [showLabels]="true">
</app-social-share-buttons>

<!-- Share Card (Price Drop) -->
<app-share-card
  variant="price-drop"
  [data]="priceDropData"
  [showWatermark]="true"
  [showActions]="true">
</app-share-card>

<!-- FAQ Page -->
<app-faq-page
  [appName]="'SmartBuy'"
  [faqs]="faqList"
  [categories]="faqCategories"
  [showSearch]="true"
  [showFeedback]="true"
  contactEmail="support@smartbuy.vn">
</app-faq-page>

<!-- How-To Guide -->
<app-how-to-guide
  [guide]="howToGuide"
  [showProgress]="true"
  [showTableOfContents]="true">
</app-how-to-guide>
```

## Task Coverage (Phase 7 - Growth)

| Task ID | Description | Status |
|---------|-------------|--------|
| GRW-001 | Schema markup (all apps) | ✅ seo.service.ts |
| GRW-002 | Sitemap.xml (auto-update) | ✅ seo.service.ts |
| GRW-003 | Core Web Vitals (LCP < 2.5s) | ✅ performance.service.ts |
| GRW-004 | FAQ pages (all apps) | ✅ faq-page.component |
| GRW-005 | "How to" guides | ✅ how-to-guide.component |
| GRW-006 | Internal linking | 📝 App-level |
| GRW-007 | Referral tracking system | ✅ referral.service.ts |
| GRW-008 | Referral code generator | ✅ referral.service.ts |
| GRW-009 | Referral dashboard UI | ✅ referral-dashboard.component |
| GRW-010 | Referral rewards logic | ✅ referral.service.ts |
| GRW-011 | Points system | ✅ viral.service.ts |
| GRW-012 | Daily streak system | ✅ viral.service.ts |
| GRW-013 | Daily missions | ✅ viral.service.ts |
| GRW-014 | Gamification UI components | ✅ achievement-badge, streak-display, leaderboard |
| GRW-015 | Points redemption (Premium) | ✅ viral.service.ts |
| GRW-016 | Social sharing buttons | ✅ social-share-buttons.component |
| GRW-017 | Price drop share cards | ✅ share-card.component |
| GRW-018 | Result share cards | ✅ share-card.component |
| GRW-019 | Open Graph meta tags | ✅ og-meta.service.ts |
| GRW-020 | Mailerlite setup | ✅ email-marketing.service.ts |
| GRW-021 | Welcome email sequence | ✅ email-marketing.service.ts |
| GRW-022 | Weekly digest template | ✅ email-marketing.service.ts |
| GRW-023 | Re-engagement emails | ✅ email-marketing.service.ts |
| GRW-024 | OneSignal setup | ✅ web-push.service.ts |
| GRW-025 | Price drop alerts | ✅ web-push.service.ts |
| GRW-026 | Deadline reminders | ✅ web-push.service.ts |
| GRW-027 | Breaking news alerts | ✅ web-push.service.ts |

## Pricing Model

- **Free**:  Tính năng cơ bản
- **Premium**:  99.000đ/tháng - Tất cả tính năng

## Growth Strategy

100% organic growth:
1. **SEO** - Content marketing, structured data, FAQ, How-to guides
2. **Referral** - Word-of-mouth với rewards (7-14 Premium days)
3. **Viral** - Gamification, achievements, leaderboards, social sharing
4. **Retention** - Streaks, push notifications, email re-engagement

## License

Private - Internal use only
