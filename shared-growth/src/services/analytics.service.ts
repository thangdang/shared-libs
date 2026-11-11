/**
 * Analytics Service - Shared Growth Infrastructure
 * User tracking, funnel analysis, and conversion metrics
 * For all 5 AI apps: TrendBrief, SmartBuy, FinTax, DoctorCar, CareMate
 */

export interface UserEvent {
  eventId: string;
  userId?: string;
  sessionId: string;
  eventType: EventType;
  eventName: string;
  properties: Record<string, any>;
  timestamp: Date;
  appId: AppId;
  platform: 'web' | 'mobile';
  userAgent: string;
  referrer?: string;
  utmParams?: UTMParams;
}

export type AppId = 'trendbrief' | 'smartbuy' | 'fintax' | 'doctorcar' | 'caremate';

export type EventType = 
  | 'page_view'
  | 'feature_use'
  | 'conversion'
  | 'engagement'
  | 'error'
  | 'performance'
  | 'custom';

export interface UTMParams {
  source?: string;
  medium?: string;
  campaign?: string;
  term?: string;
  content?: string;
}

export interface FunnelStep {
  stepId: string;
  stepName: string;
  stepOrder: number;
  requiredEvent: string;
  optionalEvents?: string[];
}

export interface Funnel {
  funnelId: string;
  funnelName: string;
  appId: AppId;
  steps: FunnelStep[];
  createdAt: Date;
  isActive: boolean;
}

export interface FunnelAnalysis {
  funnelId: string;
  dateRange: { start: Date; end: Date };
  totalUsers: number;
  stepMetrics: StepMetric[];
  overallConversionRate: number;
  averageTimeToConvert: number; // in hours
}

export interface StepMetric {
  stepId: string;
  stepName: string;
  usersEntered: number;
  usersCompleted: number;
  dropoffRate: number;
  averageTimeInStep: number; // in seconds
}

export interface UserSession {
  sessionId: string;
  userId?: string;
  appId: AppId;
  startTime: Date;
  endTime?: Date;
  pageViews: number;
  events: string[];
  isConverted: boolean;
  conversionType?: string;
  deviceInfo: DeviceInfo;
}

export interface DeviceInfo {
  type: 'desktop' | 'tablet' | 'mobile';
  os: string;
  browser: string;
  screenWidth: number;
  screenHeight: number;
}

export interface ConversionGoal {
  goalId: string;
  goalName: string;
  appId: AppId;
  triggerEvent: string;
  triggerConditions?: Record<string, any>;
  value?: number; // monetary value in VND
  isActive: boolean;
}

export interface ConversionReport {
  goalId: string;
  dateRange: { start: Date; end: Date };
  totalConversions: number;
  uniqueUsers: number;
  conversionRate: number;
  totalValue: number;
  bySource: Record<string, number>;
  byDay: { date: string; conversions: number }[];
}

export interface CohortAnalysis {
  cohortDate: string; // YYYY-MM format
  appId: AppId;
  totalUsers: number;
  retention: Record<string, number>; // week/month -> percentage
  revenuePerUser: number;
  lifetimeValue: number;
}

// Predefined funnels for each app
export const APP_FUNNELS: Record<AppId, Funnel[]> = {
  trendbrief: [
    {
      funnelId: 'tb-onboarding',
      funnelName: 'Onboarding Flow',
      appId: 'trendbrief',
      steps: [
        { stepId: 'landing', stepName: 'Landing Page', stepOrder: 1, requiredEvent: 'page_view_landing' },
        { stepId: 'signup', stepName: 'Sign Up', stepOrder: 2, requiredEvent: 'signup_started' },
        { stepId: 'verify', stepName: 'Email Verified', stepOrder: 3, requiredEvent: 'email_verified' },
        { stepId: 'first-brief', stepName: 'First Brief Read', stepOrder: 4, requiredEvent: 'brief_read' }
      ],
      createdAt: new Date(),
      isActive: true
    },
    {
      funnelId: 'tb-premium',
      funnelName: 'Premium Conversion',
      appId: 'trendbrief',
      steps: [
        { stepId: 'pricing', stepName: 'Pricing Page', stepOrder: 1, requiredEvent: 'page_view_pricing' },
        { stepId: 'select', stepName: 'Plan Selected', stepOrder: 2, requiredEvent: 'plan_selected' },
        { stepId: 'payment', stepName: 'Payment Started', stepOrder: 3, requiredEvent: 'payment_started' },
        { stepId: 'success', stepName: 'Payment Success', stepOrder: 4, requiredEvent: 'payment_success' }
      ],
      createdAt: new Date(),
      isActive: true
    }
  ],
  smartbuy: [
    {
      funnelId: 'sb-onboarding',
      funnelName: 'Onboarding Flow',
      appId: 'smartbuy',
      steps: [
        { stepId: 'landing', stepName: 'Landing Page', stepOrder: 1, requiredEvent: 'page_view_landing' },
        { stepId: 'signup', stepName: 'Sign Up', stepOrder: 2, requiredEvent: 'signup_started' },
        { stepId: 'first-compare', stepName: 'First Comparison', stepOrder: 3, requiredEvent: 'comparison_created' }
      ],
      createdAt: new Date(),
      isActive: true
    },
    {
      funnelId: 'sb-premium',
      funnelName: 'Premium Conversion',
      appId: 'smartbuy',
      steps: [
        { stepId: 'limit-hit', stepName: 'Free Limit Hit', stepOrder: 1, requiredEvent: 'free_limit_reached' },
        { stepId: 'pricing', stepName: 'Pricing Page', stepOrder: 2, requiredEvent: 'page_view_pricing' },
        { stepId: 'payment', stepName: 'Payment Started', stepOrder: 3, requiredEvent: 'payment_started' },
        { stepId: 'success', stepName: 'Payment Success', stepOrder: 4, requiredEvent: 'payment_success' }
      ],
      createdAt: new Date(),
      isActive: true
    }
  ],
  fintax: [
    {
      funnelId: 'ft-onboarding',
      funnelName: 'Onboarding Flow',
      appId: 'fintax',
      steps: [
        { stepId: 'landing', stepName: 'Landing Page', stepOrder: 1, requiredEvent: 'page_view_landing' },
        { stepId: 'signup', stepName: 'Sign Up', stepOrder: 2, requiredEvent: 'signup_started' },
        { stepId: 'profile', stepName: 'Tax Profile Setup', stepOrder: 3, requiredEvent: 'tax_profile_created' },
        { stepId: 'first-calc', stepName: 'First Calculation', stepOrder: 4, requiredEvent: 'tax_calculated' }
      ],
      createdAt: new Date(),
      isActive: true
    },
    {
      funnelId: 'ft-premium',
      funnelName: 'Premium Conversion',
      appId: 'fintax',
      steps: [
        { stepId: 'pricing', stepName: 'Pricing Page', stepOrder: 1, requiredEvent: 'page_view_pricing' },
        { stepId: 'select', stepName: 'Plan Selected', stepOrder: 2, requiredEvent: 'plan_selected' },
        { stepId: 'payment', stepName: 'Payment Started', stepOrder: 3, requiredEvent: 'payment_started' },
        { stepId: 'success', stepName: 'Payment Success', stepOrder: 4, requiredEvent: 'payment_success' }
      ],
      createdAt: new Date(),
      isActive: true
    }
  ],
  doctorcar: [
    {
      funnelId: 'dc-onboarding',
      funnelName: 'Onboarding Flow',
      appId: 'doctorcar',
      steps: [
        { stepId: 'landing', stepName: 'Landing Page', stepOrder: 1, requiredEvent: 'page_view_landing' },
        { stepId: 'signup', stepName: 'Sign Up', stepOrder: 2, requiredEvent: 'signup_started' },
        { stepId: 'add-car', stepName: 'First Car Added', stepOrder: 3, requiredEvent: 'car_added' },
        { stepId: 'first-log', stepName: 'First Maintenance Log', stepOrder: 4, requiredEvent: 'maintenance_logged' }
      ],
      createdAt: new Date(),
      isActive: true
    },
    {
      funnelId: 'dc-premium',
      funnelName: 'Premium Conversion',
      appId: 'doctorcar',
      steps: [
        { stepId: 'reminder', stepName: 'Maintenance Reminder', stepOrder: 1, requiredEvent: 'reminder_received' },
        { stepId: 'pricing', stepName: 'Pricing Page', stepOrder: 2, requiredEvent: 'page_view_pricing' },
        { stepId: 'payment', stepName: 'Payment Started', stepOrder: 3, requiredEvent: 'payment_started' },
        { stepId: 'success', stepName: 'Payment Success', stepOrder: 4, requiredEvent: 'payment_success' }
      ],
      createdAt: new Date(),
      isActive: true
    }
  ],
  caremate: [
    {
      funnelId: 'cm-onboarding',
      funnelName: 'Onboarding Flow',
      appId: 'caremate',
      steps: [
        { stepId: 'landing', stepName: 'Landing Page', stepOrder: 1, requiredEvent: 'page_view_landing' },
        { stepId: 'signup', stepName: 'Sign Up', stepOrder: 2, requiredEvent: 'signup_started' },
        { stepId: 'add-member', stepName: 'First Family Member', stepOrder: 3, requiredEvent: 'family_member_added' },
        { stepId: 'first-record', stepName: 'First Health Record', stepOrder: 4, requiredEvent: 'health_record_created' }
      ],
      createdAt: new Date(),
      isActive: true
    },
    {
      funnelId: 'cm-premium',
      funnelName: 'Premium Conversion',
      appId: 'caremate',
      steps: [
        { stepId: 'limit-hit', stepName: 'Free Limit Hit', stepOrder: 1, requiredEvent: 'free_limit_reached' },
        { stepId: 'pricing', stepName: 'Pricing Page', stepOrder: 2, requiredEvent: 'page_view_pricing' },
        { stepId: 'payment', stepName: 'Payment Started', stepOrder: 3, requiredEvent: 'payment_started' },
        { stepId: 'success', stepName: 'Payment Success', stepOrder: 4, requiredEvent: 'payment_success' }
      ],
      createdAt: new Date(),
      isActive: true
    }
  ]
};

// Conversion goals for each app
export const CONVERSION_GOALS: ConversionGoal[] = [
  // TrendBrief
  { goalId: 'tb-signup', goalName: 'User Signup', appId: 'trendbrief', triggerEvent: 'signup_completed', isActive: true },
  { goalId: 'tb-premium', goalName: 'Premium Subscription', appId: 'trendbrief', triggerEvent: 'payment_success', value: 99000, isActive: true },
  { goalId: 'tb-referral', goalName: 'Referral Sent', appId: 'trendbrief', triggerEvent: 'referral_sent', isActive: true },
  
  // SmartBuy
  { goalId: 'sb-signup', goalName: 'User Signup', appId: 'smartbuy', triggerEvent: 'signup_completed', isActive: true },
  { goalId: 'sb-premium', goalName: 'Premium Subscription', appId: 'smartbuy', triggerEvent: 'payment_success', value: 99000, isActive: true },
  { goalId: 'sb-comparison', goalName: 'Comparison Created', appId: 'smartbuy', triggerEvent: 'comparison_created', isActive: true },
  
  // FinTax
  { goalId: 'ft-signup', goalName: 'User Signup', appId: 'fintax', triggerEvent: 'signup_completed', isActive: true },
  { goalId: 'ft-premium', goalName: 'Premium Subscription', appId: 'fintax', triggerEvent: 'payment_success', value: 99000, isActive: true },
  { goalId: 'ft-calculation', goalName: 'Tax Calculated', appId: 'fintax', triggerEvent: 'tax_calculated', isActive: true },
  
  // DoctorCar
  { goalId: 'dc-signup', goalName: 'User Signup', appId: 'doctorcar', triggerEvent: 'signup_completed', isActive: true },
  { goalId: 'dc-premium', goalName: 'Premium Subscription', appId: 'doctorcar', triggerEvent: 'payment_success', value: 99000, isActive: true },
  { goalId: 'dc-car-added', goalName: 'Car Added', appId: 'doctorcar', triggerEvent: 'car_added', isActive: true },
  
  // CareMate
  { goalId: 'cm-signup', goalName: 'User Signup', appId: 'caremate', triggerEvent: 'signup_completed', isActive: true },
  { goalId: 'cm-premium', goalName: 'Premium Subscription', appId: 'caremate', triggerEvent: 'payment_success', value: 99000, isActive: true },
  { goalId: 'cm-family', goalName: 'Family Member Added', appId: 'caremate', triggerEvent: 'family_member_added', isActive: true }
];

class AnalyticsService {
  private sessionId: string;
  private userId?: string;
  private appId: AppId;
  private eventQueue: UserEvent[] = [];
  private flushInterval: number = 5000; // 5 seconds
  private maxQueueSize: number = 50;
  private sessionStartTime: Date;
  private pageViewCount: number = 0;

  constructor() {
    this.sessionId = this.generateSessionId();
    this.appId = this.detectAppId();
    this.sessionStartTime = new Date();
    this.initializeSession();
    this.setupAutoFlush();
    this.setupPageVisibilityTracking();
  }

  /**
   * Initialize analytics session
   */
  private initializeSession(): void {
    // Restore session if exists
    const existingSession = sessionStorage.getItem('analytics_session');
    if (existingSession) {
      const session = JSON.parse(existingSession);
      if (Date.now() - session.startTime < 30 * 60 * 1000) { // 30 min timeout
        this.sessionId = session.sessionId;
        this.sessionStartTime = new Date(session.startTime);
        this.pageViewCount = session.pageViewCount || 0;
      }
    }

    // Restore user ID if logged in
    const storedUserId = localStorage.getItem('user_id');
    if (storedUserId) {
      this.userId = storedUserId;
    }

    // Track session start
    this.track('session_start', {
      referrer: document.referrer,
      utmParams: this.parseUTMParams(),
      landingPage: window.location.pathname
    });
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Detect which app is being used
   */
  private detectAppId(): AppId {
    const hostname = window.location.hostname;
    if (hostname.includes('trendbrief')) return 'trendbrief';
    if (hostname.includes('smartbuy')) return 'smartbuy';
    if (hostname.includes('fintax')) return 'fintax';
    if (hostname.includes('doctorcar')) return 'doctorcar';
    if (hostname.includes('caremate')) return 'caremate';
    return 'trendbrief'; // default
  }

  /**
   * Parse UTM parameters from URL
   */
  private parseUTMParams(): UTMParams | undefined {
    const params = new URLSearchParams(window.location.search);
    const utm: UTMParams = {};
    
    if (params.get('utm_source')) utm.source = params.get('utm_source')!;
    if (params.get('utm_medium')) utm.medium = params.get('utm_medium')!;
    if (params.get('utm_campaign')) utm.campaign = params.get('utm_campaign')!;
    if (params.get('utm_term')) utm.term = params.get('utm_term')!;
    if (params.get('utm_content')) utm.content = params.get('utm_content')!;
    
    return Object.keys(utm).length > 0 ? utm : undefined;
  }

  /**
   * Get device information
   */
  private getDeviceInfo(): DeviceInfo {
    const ua = navigator.userAgent;
    let type: 'desktop' | 'tablet' | 'mobile' = 'desktop';
    
    if (/tablet|ipad|playbook|silk/i.test(ua)) {
      type = 'tablet';
    } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
      type = 'mobile';
    }

    let os = 'Unknown';
    if (/windows/i.test(ua)) os = 'Windows';
    else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
    else if (/linux/i.test(ua)) os = 'Linux';
    else if (/android/i.test(ua)) os = 'Android';
    else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';

    let browser = 'Unknown';
    if (/chrome/i.test(ua) && !/edge/i.test(ua)) browser = 'Chrome';
    else if (/firefox/i.test(ua)) browser = 'Firefox';
    else if (/safari/i.test(ua) && !/chrome/i.test(ua)) browser = 'Safari';
    else if (/edge/i.test(ua)) browser = 'Edge';

    return {
      type,
      os,
      browser,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height
    };
  }

  /**
   * Set user ID after login
   */
  setUserId(userId: string): void {
    this.userId = userId;
    localStorage.setItem('user_id', userId);
    this.track('user_identified', { userId });
  }

  /**
   * Clear user ID on logout
   */
  clearUserId(): void {
    this.userId = undefined;
    localStorage.removeItem('user_id');
  }

  /**
   * Track page view
   */
  trackPageView(pageName: string, properties: Record<string, any> = {}): void {
    this.pageViewCount++;
    this.track(`page_view_${pageName}`, {
      ...properties,
      pageTitle: document.title,
      pagePath: window.location.pathname,
      pageUrl: window.location.href,
      pageViewNumber: this.pageViewCount
    }, 'page_view');
    
    this.saveSession();
  }

  /**
   * Track feature usage
   */
  trackFeatureUse(featureName: string, properties: Record<string, any> = {}): void {
    this.track(`feature_${featureName}`, properties, 'feature_use');
  }

  /**
   * Track conversion event
   */
  trackConversion(conversionName: string, value?: number, properties: Record<string, any> = {}): void {
    this.track(conversionName, {
      ...properties,
      conversionValue: value,
      currency: 'VND'
    }, 'conversion');
  }

  /**
   * Track engagement event
   */
  trackEngagement(action: string, properties: Record<string, any> = {}): void {
    this.track(`engagement_${action}`, properties, 'engagement');
  }

  /**
   * Track error
   */
  trackError(errorName: string, errorDetails: Record<string, any> = {}): void {
    this.track(`error_${errorName}`, errorDetails, 'error');
  }

  /**
   * Track performance metric
   */
  trackPerformance(metricName: string, value: number, properties: Record<string, any> = {}): void {
    this.track(`perf_${metricName}`, {
      ...properties,
      metricValue: value
    }, 'performance');
  }

  /**
   * Generic track method
   */
  track(eventName: string, properties: Record<string, any> = {}, eventType: EventType = 'custom'): void {
    const event: UserEvent = {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId: this.userId,
      sessionId: this.sessionId,
      eventType,
      eventName,
      properties,
      timestamp: new Date(),
      appId: this.appId,
      platform: 'web',
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      utmParams: this.parseUTMParams()
    };

    this.eventQueue.push(event);

    if (this.eventQueue.length >= this.maxQueueSize) {
      this.flush();
    }
  }

  /**
   * Setup automatic flush interval
   */
  private setupAutoFlush(): void {
    setInterval(() => {
      if (this.eventQueue.length > 0) {
        this.flush();
      }
    }, this.flushInterval);
  }

  /**
   * Setup page visibility tracking for session end
   */
  private setupPageVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        this.track('session_pause', {
          duration: Date.now() - this.sessionStartTime.getTime()
        });
        this.flush();
      } else {
        this.track('session_resume', {});
      }
    });

    window.addEventListener('beforeunload', () => {
      this.track('session_end', {
        duration: Date.now() - this.sessionStartTime.getTime(),
        pageViews: this.pageViewCount
      });
      this.flush();
    });
  }

  /**
   * Save session to storage
   */
  private saveSession(): void {
    sessionStorage.setItem('analytics_session', JSON.stringify({
      sessionId: this.sessionId,
      startTime: this.sessionStartTime.getTime(),
      pageViewCount: this.pageViewCount
    }));
  }

  /**
   * Flush event queue to server
   */
  async flush(): Promise<void> {
    if (this.eventQueue.length === 0) return;

    const eventsToSend = [...this.eventQueue];
    this.eventQueue = [];

    try {
      // Use sendBeacon for reliability during page unload
      if (navigator.sendBeacon) {
        navigator.sendBeacon(
          '/api/analytics/events',
          JSON.stringify({ events: eventsToSend })
        );
      } else {
        await fetch('/api/analytics/events', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ events: eventsToSend }),
          keepalive: true
        });
      }
    } catch (error) {
      // Re-queue events on failure
      this.eventQueue = [...eventsToSend, ...this.eventQueue];
      console.error('Analytics flush failed:', error);
    }
  }

  /**
   * Get funnel analysis for a specific funnel
   */
  async getFunnelAnalysis(funnelId: string, dateRange: { start: Date; end: Date }): Promise<FunnelAnalysis> {
    const response = await fetch('/api/analytics/funnel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ funnelId, dateRange })
    });
    return response.json();
  }

  /**
   * Get conversion report for a goal
   */
  async getConversionReport(goalId: string, dateRange: { start: Date; end: Date }): Promise<ConversionReport> {
    const response = await fetch('/api/analytics/conversion', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ goalId, dateRange })
    });
    return response.json();
  }

  /**
   * Get cohort analysis
   */
  async getCohortAnalysis(appId: AppId, months: number = 6): Promise<CohortAnalysis[]> {
    const response = await fetch(`/api/analytics/cohort?appId=${appId}&months=${months}`);
    return response.json();
  }

  /**
   * Get real-time active users
   */
  async getRealTimeUsers(): Promise<{ count: number; byPage: Record<string, number> }> {
    const response = await fetch('/api/analytics/realtime');
    return response.json();
  }

  /**
   * Get user journey for debugging
   */
  async getUserJourney(userId: string): Promise<UserEvent[]> {
    const response = await fetch(`/api/analytics/journey/${userId}`);
    return response.json();
  }
}

// Singleton instance
export const analyticsService = new AnalyticsService();

// Convenience exports for common tracking
export const trackPageView = (pageName: string, props?: Record<string, any>) => 
  analyticsService.trackPageView(pageName, props);

export const trackFeature = (featureName: string, props?: Record<string, any>) => 
  analyticsService.trackFeatureUse(featureName, props);

export const trackConversion = (name: string, value?: number, props?: Record<string, any>) => 
  analyticsService.trackConversion(name, value, props);

export const trackEngagement = (action: string, props?: Record<string, any>) => 
  analyticsService.trackEngagement(action, props);

export const trackError = (name: string, details?: Record<string, any>) => 
  analyticsService.trackError(name, details);
