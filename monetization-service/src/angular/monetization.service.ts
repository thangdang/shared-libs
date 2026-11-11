/**
 * Monetization Service - Angular Service
 * Handles subscription management, payment processing, and ad display
 */

import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, of, throwError } from 'rxjs';
import { map, tap, catchError, switchMap } from 'rxjs/operators';
import {
  SubscriptionTier,
  UserSubscription,
  PaymentMethod,
  PaymentRequest,
  PaymentResponse,
  AdPlacement,
  AdConfig,
  MonetizationConfig
} from '../types';
import { PRICING_CONFIG, getPricingForTier, formatVND } from '../pricing';

export interface MonetizationState {
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class MonetizationService {
  private http = inject(HttpClient);
  
  // Reactive state using signals
  private _state = signal<MonetizationState>({
    subscription: null,
    isLoading: false,
    error: null
  });

  // Public computed signals
  readonly subscription = computed(() => this._state().subscription);
  readonly isLoading = computed(() => this._state().isLoading);
  readonly error = computed(() => this._state().error);
  readonly isPremium = computed(() => 
    this._state().subscription?.tier === SubscriptionTier.PREMIUM &&
    this._state().subscription?.status === 'active'
  );
  readonly isFree = computed(() => 
    !this._state().subscription || 
    this._state().subscription?.tier === SubscriptionTier.FREE
  );

  // Ad visibility based on subscription
  readonly shouldShowAds = computed(() => this.isFree());

  // Configuration
  private config: MonetizationConfig = {
    apiEndpoint: '/api/monetization',
    momoConfig: {
      partnerCode: '',
      accessKey: '',
      secretKey: '',
      redirectUrl: '',
      ipnUrl: '',
      requestType: 'captureWallet',
      environment: 'sandbox'
    },
    adsenseConfig: {
      clientId: '',
      enabled: false,
      testMode: true
    }
  };

  /**
   * Initialize monetization service with configuration
   */
  configure(config: Partial<MonetizationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Load user's current subscription
   */
  loadSubscription(userId: string): Observable<UserSubscription | null> {
    this._state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.get<UserSubscription>(
      `${this.config.apiEndpoint}/subscriptions/${userId}`
    ).pipe(
      tap(subscription => {
        this._state.update(s => ({
          ...s,
          subscription,
          isLoading: false
        }));
      }),
      catchError(error => {
        // If no subscription found, return free tier
        if (error.status === 404) {
          const freeSubscription: UserSubscription = {
            userId,
            tier: SubscriptionTier.FREE,
            status: 'active',
            startDate: new Date(),
            features: PRICING_CONFIG.tiers.free.features
          };
          this._state.update(s => ({
            ...s,
            subscription: freeSubscription,
            isLoading: false
          }));
          return of(freeSubscription);
        }
        
        this._state.update(s => ({
          ...s,
          isLoading: false,
          error: 'Failed to load subscription'
        }));
        return throwError(() => error);
      })
    );
  }

  /**
   * Initiate premium upgrade via MoMo payment
   */
  upgradeToPremium(userId: string): Observable<PaymentResponse> {
    const pricing = getPricingForTier(SubscriptionTier.PREMIUM);
    
    const paymentRequest: PaymentRequest = {
      userId,
      amount: pricing.monthly,
      currency: 'VND',
      paymentMethod: PaymentMethod.MOMO,
      description: `Nâng cấp Premium - ${formatVND(pricing.monthly)}/tháng`,
      metadata: {
        tier: SubscriptionTier.PREMIUM,
        billingCycle: 'monthly'
      }
    };

    this._state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.post<PaymentResponse>(
      `${this.config.apiEndpoint}/payments/initiate`,
      paymentRequest
    ).pipe(
      tap(response => {
        if (response.status === 'pending' && response.paymentUrl) {
          // Redirect to MoMo payment page
          window.location.href = response.paymentUrl;
        }
      }),
      catchError(error => {
        this._state.update(s => ({
          ...s,
          isLoading: false,
          error: 'Không thể khởi tạo thanh toán. Vui lòng thử lại.'
        }));
        return throwError(() => error);
      })
    );
  }

  /**
   * Verify payment callback from MoMo
   */
  verifyPayment(orderId: string, requestId: string): Observable<PaymentResponse> {
    return this.http.post<PaymentResponse>(
      `${this.config.apiEndpoint}/payments/verify`,
      { orderId, requestId }
    ).pipe(
      tap(response => {
        if (response.status === 'completed') {
          // Reload subscription after successful payment
          const userId = this._state().subscription?.userId;
          if (userId) {
            this.loadSubscription(userId).subscribe();
          }
        }
      })
    );
  }

  /**
   * Cancel subscription (downgrade to free)
   */
  cancelSubscription(userId: string): Observable<void> {
    this._state.update(s => ({ ...s, isLoading: true, error: null }));

    return this.http.post<void>(
      `${this.config.apiEndpoint}/subscriptions/${userId}/cancel`,
      {}
    ).pipe(
      tap(() => {
        const freeSubscription: UserSubscription = {
          userId,
          tier: SubscriptionTier.FREE,
          status: 'active',
          startDate: new Date(),
          features: PRICING_CONFIG.tiers.free.features
        };
        this._state.update(s => ({
          ...s,
          subscription: freeSubscription,
          isLoading: false
        }));
      }),
      catchError(error => {
        this._state.update(s => ({
          ...s,
          isLoading: false,
          error: 'Không thể hủy gói. Vui lòng thử lại.'
        }));
        return throwError(() => error);
      })
    );
  }

  /**
   * Check if user has access to a specific feature
   */
  hasFeature(featureKey: string): boolean {
    const subscription = this._state().subscription;
    if (!subscription) return false;
    
    return subscription.features.includes(featureKey);
  }

  /**
   * Get ad configuration for a placement
   */
  getAdConfig(placement: AdPlacement): AdConfig | null {
    if (this.isPremium() || !this.config.adsenseConfig.enabled) {
      return null;
    }

    return {
      clientId: this.config.adsenseConfig.clientId,
      slot: this.getAdSlotForPlacement(placement),
      format: this.getAdFormatForPlacement(placement),
      responsive: true,
      testMode: this.config.adsenseConfig.testMode
    };
  }

  private getAdSlotForPlacement(placement: AdPlacement): string {
    // Map placements to ad slot IDs (configured in AdSense)
    const slotMap: Record<AdPlacement, string> = {
      [AdPlacement.HEADER]: 'header-ad-slot',
      [AdPlacement.SIDEBAR]: 'sidebar-ad-slot',
      [AdPlacement.IN_CONTENT]: 'in-content-ad-slot',
      [AdPlacement.FOOTER]: 'footer-ad-slot',
      [AdPlacement.INTERSTITIAL]: 'interstitial-ad-slot'
    };
    return slotMap[placement] || '';
  }

  private getAdFormatForPlacement(placement: AdPlacement): string {
    const formatMap: Record<AdPlacement, string> = {
      [AdPlacement.HEADER]: 'horizontal',
      [AdPlacement.SIDEBAR]: 'vertical',
      [AdPlacement.IN_CONTENT]: 'rectangle',
      [AdPlacement.FOOTER]: 'horizontal',
      [AdPlacement.INTERSTITIAL]: 'auto'
    };
    return formatMap[placement] || 'auto';
  }

  /**
   * Get pricing information
   */
  getPricing() {
    return PRICING_CONFIG;
  }

  /**
   * Format price for display
   */
  formatPrice(amount: number): string {
    return formatVND(amount);
  }
}
