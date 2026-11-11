/**
 * A/B Testing Service - Shared Growth Infrastructure
 * Experiment management, variant assignment, and statistical analysis
 * For all 5 AI apps: TrendBrief, SmartBuy, FinTax, DoctorCar, CareMate
 */

import { analyticsService, AppId } from './analytics.service';

export interface Experiment {
  experimentId: string;
  name: string;
  description: string;
  appId: AppId | 'all';
  hypothesis: string;
  primaryMetric: string;
  secondaryMetrics?: string[];
  variants: Variant[];
  targetAudience?: AudienceFilter;
  trafficAllocation: number; // 0-100 percentage
  status: ExperimentStatus;
  startDate?: Date;
  endDate?: Date;
  createdAt: Date;
  updatedAt: Date;
  minimumSampleSize: number;
  confidenceLevel: number; // typically 0.95
}

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed' | 'archived';

export interface Variant {
  variantId: string;
  name: string;
  description?: string;
  weight: number; // percentage allocation (all variants should sum to 100)
  isControl: boolean;
  config: Record<string, any>; // variant-specific configuration
}

export interface AudienceFilter {
  userType?: 'new' | 'returning' | 'premium' | 'free' | 'all';
  minSessionCount?: number;
  maxSessionCount?: number;
  registeredAfter?: Date;
  registeredBefore?: Date;
  customFilter?: (userId: string, userData: any) => boolean;
}

export interface ExperimentAssignment {
  experimentId: string;
  variantId: string;
  userId: string;
  assignedAt: Date;
  isEligible: boolean;
}

export interface ExperimentResult {
  experimentId: string;
  variantId: string;
  sampleSize: number;
  conversions: number;
  conversionRate: number;
  confidenceInterval: [number, number];
  standardError: number;
}

export interface ExperimentAnalysis {
  experimentId: string;
  analysisDate: Date;
  totalParticipants: number;
  variantResults: ExperimentResult[];
  winner?: string;
  statisticalSignificance: number;
  relativeUplift?: number;
  recommendedAction: 'continue' | 'stop_winner' | 'stop_no_effect' | 'need_more_data';
  powerAnalysis: {
    currentPower: number;
    estimatedDaysToSignificance: number;
  };
}

// Predefined experiments for organic growth
export const GROWTH_EXPERIMENTS: Experiment[] = [
  // Landing page headline test
  {
    experimentId: 'exp-landing-headline',
    name: 'Landing Page Headline',
    description: 'Test different value propositions on landing page',
    appId: 'all',
    hypothesis: 'A benefit-focused headline will increase signup rate by 15%',
    primaryMetric: 'signup_rate',
    secondaryMetrics: ['bounce_rate', 'time_on_page'],
    variants: [
      {
        variantId: 'control',
        name: 'Control',
        description: 'Current headline',
        weight: 50,
        isControl: true,
        config: { headline: 'default' }
      },
      {
        variantId: 'benefit',
        name: 'Benefit Focus',
        description: 'Benefit-focused headline',
        weight: 50,
        isControl: false,
        config: { headline: 'benefit' }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 1000,
    confidenceLevel: 0.95
  },

  // Pricing page layout test
  {
    experimentId: 'exp-pricing-layout',
    name: 'Pricing Page Layout',
    description: 'Test horizontal vs vertical pricing comparison',
    appId: 'all',
    hypothesis: 'Horizontal layout will increase premium conversion by 10%',
    primaryMetric: 'premium_conversion_rate',
    secondaryMetrics: ['pricing_page_time', 'plan_comparison_clicks'],
    variants: [
      {
        variantId: 'control',
        name: 'Vertical',
        description: 'Cards stacked vertically',
        weight: 50,
        isControl: true,
        config: { layout: 'vertical' }
      },
      {
        variantId: 'horizontal',
        name: 'Horizontal',
        description: 'Cards side by side',
        weight: 50,
        isControl: false,
        config: { layout: 'horizontal' }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 500,
    confidenceLevel: 0.95
  },

  // Referral incentive test
  {
    experimentId: 'exp-referral-incentive',
    name: 'Referral Incentive Amount',
    description: 'Test different referral reward amounts',
    appId: 'all',
    hypothesis: '14 days premium will generate more referrals than 7 days',
    primaryMetric: 'referral_sent_rate',
    secondaryMetrics: ['referral_conversion_rate', 'viral_coefficient'],
    variants: [
      {
        variantId: 'control',
        name: '7 Days',
        description: '7 days premium reward',
        weight: 50,
        isControl: true,
        config: { rewardDays: 7 }
      },
      {
        variantId: 'double',
        name: '14 Days',
        description: '14 days premium reward',
        weight: 50,
        isControl: false,
        config: { rewardDays: 14 }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 300,
    confidenceLevel: 0.95
  },

  // Onboarding flow test
  {
    experimentId: 'exp-onboarding-steps',
    name: 'Onboarding Steps',
    description: 'Test simplified vs detailed onboarding',
    appId: 'all',
    hypothesis: 'Simplified onboarding will increase completion rate by 20%',
    primaryMetric: 'onboarding_completion_rate',
    secondaryMetrics: ['time_to_first_action', 'day_1_retention'],
    variants: [
      {
        variantId: 'control',
        name: 'Detailed (5 steps)',
        description: 'Full onboarding with 5 steps',
        weight: 50,
        isControl: true,
        config: { steps: 5, includeOptional: true }
      },
      {
        variantId: 'simplified',
        name: 'Simplified (3 steps)',
        description: 'Core onboarding with 3 steps',
        weight: 50,
        isControl: false,
        config: { steps: 3, includeOptional: false }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 500,
    confidenceLevel: 0.95
  },

  // CTA button color test
  {
    experimentId: 'exp-cta-color',
    name: 'CTA Button Color',
    description: 'Test primary CTA button colors',
    appId: 'all',
    hypothesis: 'Orange CTA will increase click rate by 8%',
    primaryMetric: 'cta_click_rate',
    secondaryMetrics: ['signup_rate', 'premium_conversion_rate'],
    variants: [
      {
        variantId: 'control',
        name: 'Blue',
        description: 'Standard blue button',
        weight: 33,
        isControl: true,
        config: { ctaColor: '#2563eb' }
      },
      {
        variantId: 'green',
        name: 'Green',
        description: 'Green button',
        weight: 33,
        isControl: false,
        config: { ctaColor: '#16a34a' }
      },
      {
        variantId: 'orange',
        name: 'Orange',
        description: 'Orange button',
        weight: 34,
        isControl: false,
        config: { ctaColor: '#ea580c' }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 2000,
    confidenceLevel: 0.95
  },

  // Social proof test
  {
    experimentId: 'exp-social-proof',
    name: 'Social Proof Display',
    description: 'Test showing user count vs testimonials',
    appId: 'all',
    hypothesis: 'User count will increase trust and signup rate by 12%',
    primaryMetric: 'signup_rate',
    secondaryMetrics: ['landing_page_bounce_rate', 'time_on_page'],
    variants: [
      {
        variantId: 'control',
        name: 'No Social Proof',
        description: 'No social proof shown',
        weight: 33,
        isControl: true,
        config: { socialProof: 'none' }
      },
      {
        variantId: 'count',
        name: 'User Count',
        description: 'Show user count badge',
        weight: 33,
        isControl: false,
        config: { socialProof: 'count' }
      },
      {
        variantId: 'testimonials',
        name: 'Testimonials',
        description: 'Show user testimonials',
        weight: 34,
        isControl: false,
        config: { socialProof: 'testimonials' }
      }
    ],
    trafficAllocation: 100,
    status: 'draft',
    createdAt: new Date(),
    updatedAt: new Date(),
    minimumSampleSize: 1500,
    confidenceLevel: 0.95
  }
];

class ABTestingService {
  private assignments: Map<string, ExperimentAssignment[]> = new Map();
  private experiments: Map<string, Experiment> = new Map();
  private userId: string;

  constructor() {
    this.userId = this.getOrCreateUserId();
    this.loadExperiments();
    this.loadAssignments();
  }

  /**
   * Get or create anonymous user ID for experiment assignment
   */
  private getOrCreateUserId(): string {
    let userId = localStorage.getItem('ab_user_id');
    if (!userId) {
      userId = `ab_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
      localStorage.setItem('ab_user_id', userId);
    }
    return userId;
  }

  /**
   * Load experiments from server or use defaults
   */
  private async loadExperiments(): Promise<void> {
    try {
      const response = await fetch('/api/experiments');
      const experiments: Experiment[] = await response.json();
      experiments.forEach(exp => this.experiments.set(exp.experimentId, exp));
    } catch {
      // Use predefined experiments as fallback
      GROWTH_EXPERIMENTS.forEach(exp => this.experiments.set(exp.experimentId, exp));
    }
  }

  /**
   * Load user's experiment assignments from storage
   */
  private loadAssignments(): void {
    const stored = localStorage.getItem('ab_assignments');
    if (stored) {
      const assignments: ExperimentAssignment[] = JSON.parse(stored);
      assignments.forEach(a => {
        const existing = this.assignments.get(a.experimentId) || [];
        existing.push(a);
        this.assignments.set(a.experimentId, existing);
      });
    }
  }

  /**
   * Save assignments to storage
   */
  private saveAssignments(): void {
    const allAssignments: ExperimentAssignment[] = [];
    this.assignments.forEach(assignments => allAssignments.push(...assignments));
    localStorage.setItem('ab_assignments', JSON.stringify(allAssignments));
  }

  /**
   * Get variant for an experiment (assigns if not already assigned)
   */
  getVariant(experimentId: string): Variant | null {
    const experiment = this.experiments.get(experimentId);
    if (!experiment || experiment.status !== 'running') {
      return null;
    }

    // Check for existing assignment
    const existingAssignment = this.assignments.get(experimentId)?.find(
      a => a.userId === this.userId
    );

    if (existingAssignment) {
      return experiment.variants.find(v => v.variantId === existingAssignment.variantId) || null;
    }

    // Check if user is in traffic allocation
    if (!this.isInTrafficAllocation(experiment)) {
      return null;
    }

    // Check audience eligibility
    if (!this.isEligible(experiment)) {
      return null;
    }

    // Assign variant
    const variant = this.assignVariant(experiment);
    return variant;
  }

  /**
   * Check if user is in traffic allocation
   */
  private isInTrafficAllocation(experiment: Experiment): boolean {
    // Use consistent hashing for deterministic assignment
    const hash = this.hashString(`${this.userId}_${experiment.experimentId}_traffic`);
    const bucket = hash % 100;
    return bucket < experiment.trafficAllocation;
  }

  /**
   * Check if user is eligible for experiment
   */
  private isEligible(experiment: Experiment): boolean {
    const filter = experiment.targetAudience;
    if (!filter) return true;

    // For now, basic eligibility check
    // In production, this would check user data
    return true;
  }

  /**
   * Assign user to a variant
   */
  private assignVariant(experiment: Experiment): Variant {
    // Use consistent hashing for deterministic assignment
    const hash = this.hashString(`${this.userId}_${experiment.experimentId}_variant`);
    const bucket = hash % 100;

    let cumulative = 0;
    let selectedVariant = experiment.variants[0];

    for (const variant of experiment.variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        selectedVariant = variant;
        break;
      }
    }

    // Record assignment
    const assignment: ExperimentAssignment = {
      experimentId: experiment.experimentId,
      variantId: selectedVariant.variantId,
      userId: this.userId,
      assignedAt: new Date(),
      isEligible: true
    };

    const existing = this.assignments.get(experiment.experimentId) || [];
    existing.push(assignment);
    this.assignments.set(experiment.experimentId, existing);
    this.saveAssignments();

    // Track assignment event
    analyticsService.track('experiment_assigned', {
      experimentId: experiment.experimentId,
      variantId: selectedVariant.variantId,
      variantName: selectedVariant.name
    });

    // Report to server
    this.reportAssignment(assignment);

    return selectedVariant;
  }

  /**
   * Simple string hash function
   */
  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  }

  /**
   * Report assignment to server
   */
  private async reportAssignment(assignment: ExperimentAssignment): Promise<void> {
    try {
      await fetch('/api/experiments/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(assignment)
      });
    } catch (error) {
      console.error('Failed to report experiment assignment:', error);
    }
  }

  /**
   * Track conversion for experiment
   */
  trackConversion(experimentId: string, metricName: string, value?: number): void {
    const assignment = this.assignments.get(experimentId)?.find(
      a => a.userId === this.userId
    );

    if (!assignment) return;

    analyticsService.track('experiment_conversion', {
      experimentId,
      variantId: assignment.variantId,
      metricName,
      metricValue: value
    });
  }

  /**
   * Get all active experiments
   */
  getActiveExperiments(): Experiment[] {
    return Array.from(this.experiments.values()).filter(
      exp => exp.status === 'running'
    );
  }

  /**
   * Get experiment config value
   */
  getConfig<T>(experimentId: string, key: string, defaultValue: T): T {
    const variant = this.getVariant(experimentId);
    if (!variant || variant.config[key] === undefined) {
      return defaultValue;
    }
    return variant.config[key] as T;
  }

  /**
   * Get experiment analysis
   */
  async getAnalysis(experimentId: string): Promise<ExperimentAnalysis> {
    const response = await fetch(`/api/experiments/${experimentId}/analysis`);
    return response.json();
  }

  /**
   * Calculate statistical significance (Z-test for proportions)
   */
  calculateSignificance(
    controlConversions: number,
    controlSample: number,
    variantConversions: number,
    variantSample: number
  ): { pValue: number; isSignificant: boolean; relativeUplift: number } {
    const p1 = controlConversions / controlSample;
    const p2 = variantConversions / variantSample;
    const pPooled = (controlConversions + variantConversions) / (controlSample + variantSample);
    
    const se = Math.sqrt(pPooled * (1 - pPooled) * (1/controlSample + 1/variantSample));
    const z = (p2 - p1) / se;
    
    // Two-tailed p-value approximation
    const pValue = 2 * (1 - this.normalCDF(Math.abs(z)));
    const relativeUplift = ((p2 - p1) / p1) * 100;

    return {
      pValue,
      isSignificant: pValue < 0.05,
      relativeUplift
    };
  }

  /**
   * Normal CDF approximation
   */
  private normalCDF(x: number): number {
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x < 0 ? -1 : 1;
    x = Math.abs(x) / Math.sqrt(2);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return 0.5 * (1.0 + sign * y);
  }

  /**
   * Calculate minimum sample size for experiment
   */
  calculateSampleSize(
    baselineRate: number,
    minimumDetectableEffect: number,
    power: number = 0.8,
    alpha: number = 0.05
  ): number {
    const za = this.zScore(1 - alpha/2);
    const zb = this.zScore(power);
    
    const p1 = baselineRate;
    const p2 = baselineRate * (1 + minimumDetectableEffect);
    const pAvg = (p1 + p2) / 2;
    
    const n = (za * Math.sqrt(2 * pAvg * (1 - pAvg)) + zb * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2))) ** 2;
    const effect = (p2 - p1) ** 2;
    
    return Math.ceil(n / effect);
  }

  /**
   * Get z-score for probability
   */
  private zScore(p: number): number {
    // Approximation for inverse normal CDF
    const a = [
      -3.969683028665376e+01,
       2.209460984245205e+02,
      -2.759285104469687e+02,
       1.383577518672690e+02,
      -3.066479806614716e+01,
       2.506628277459239e+00
    ];
    const b = [
      -5.447609879822406e+01,
       1.615858368580409e+02,
      -1.556989798598866e+02,
       6.680131188771972e+01,
      -1.328068155288572e+01
    ];
    const c = [
      -7.784894002430293e-03,
      -3.223964580411365e-01,
      -2.400758277161838e+00,
      -2.549732539343734e+00,
       4.374664141464968e+00,
       2.938163982698783e+00
    ];
    const d = [
       7.784695709041462e-03,
       3.224671290700398e-01,
       2.445134137142996e+00,
       3.754408661907416e+00
    ];

    const pLow = 0.02425;
    const pHigh = 1 - pLow;
    let q, r;

    if (p < pLow) {
      q = Math.sqrt(-2 * Math.log(p));
      return (((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
             ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    } else if (p <= pHigh) {
      q = p - 0.5;
      r = q * q;
      return (((((a[0]*r+a[1])*r+a[2])*r+a[3])*r+a[4])*r+a[5])*q /
             (((((b[0]*r+b[1])*r+b[2])*r+b[3])*r+b[4])*r+1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      return -(((((c[0]*q+c[1])*q+c[2])*q+c[3])*q+c[4])*q+c[5]) /
              ((((d[0]*q+d[1])*q+d[2])*q+d[3])*q+1);
    }
  }
}

// Singleton instance
export const abTestingService = new ABTestingService();

// Convenience exports
export const getVariant = (experimentId: string) => 
  abTestingService.getVariant(experimentId);

export const getExperimentConfig = <T>(experimentId: string, key: string, defaultValue: T) =>
  abTestingService.getConfig(experimentId, key, defaultValue);

export const trackExperimentConversion = (experimentId: string, metric: string, value?: number) =>
  abTestingService.trackConversion(experimentId, metric, value);
