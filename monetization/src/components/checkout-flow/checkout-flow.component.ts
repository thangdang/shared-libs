/**
 * MON-014:  Checkout Flow UI Component
 * 
 * Multi-step checkout process for subscription purchases.
 * Supports VNPay and MoMo payment gateways.
 */

import { Component, OnInit, OnDestroy, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';

// ============================================================================
// Types
// ============================================================================

export interface SubscriptionTier {
  id: string;
  name: string;
  price: number;
  priceDisplay: string;
  features: string[];
  recommended?: boolean;
  billingCycle: 'monthly' | 'yearly';
}

export interface CheckoutState {
  step: 'select-plan' | 'customer-info' | 'payment' | 'confirmation' | 'success' | 'error';
  selectedTier: SubscriptionTier | null;
  paymentMethod: 'vnpay' | 'momo' | null;
  customerInfo: CustomerInfo | null;
  orderId: string | null;
  error: string | null;
}

export interface CustomerInfo {
  fullName: string;
  email: string;
  phone: string;
}

export interface CheckoutResult {
  success: boolean;
  orderId?: string;
  subscriptionId?: string;
  error?: string;
}

// ============================================================================
// Component
// ============================================================================

@Component({
  selector: 'app-checkout-flow',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './checkout-flow.component.html',
  styleUrl: './checkout-flow.component.scss'
})
export class CheckoutFlowComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  @Input() tiers: SubscriptionTier[] = [];
  @Input() apiEndpoint = '/api/subscription';
  
  @Output() complete = new EventEmitter<CheckoutResult>();
  @Output() cancel = new EventEmitter<void>();

  state: CheckoutState = {
    step: 'select-plan',
    selectedTier: null,
    paymentMethod: null,
    customerInfo: null,
    orderId: null,
    error: null
  };

  customerForm!: FormGroup;
  processing = false;

  steps = [
    { id: 'select-plan', label: 'Chọn gói' },
    { id: 'customer-info', label: 'Thông tin' },
    { id: 'payment', label: 'Thanh toán' },
    { id: 'confirmation', label: 'Hoàn tất' }
  ];

  ngOnInit(): void {
    this.customerForm = this.fb.group({
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      phone: ['', [Validators.required, Validators.pattern(/^0[0-9]{9}$/)]]
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getStepIndex(step: string): number {
    const index = this.steps.findIndex(s => s.id === step);
    return index >= 0 ? index : (step === 'success' || step === 'error' ? 3 : 0);
  }

  selectTier(tier: SubscriptionTier): void {
    this.state.selectedTier = tier;
  }

  goToStep(step: CheckoutState['step']): void {
    this.state.step = step;
  }

  saveCustomerInfo(): void {
    if (this.customerForm.valid) {
      this.state.customerInfo = this.customerForm.value;
      this.goToStep('payment');
    }
  }

  selectPaymentMethod(method: 'vnpay' | 'momo'): void {
    this.state.paymentMethod = method;
  }

  async processPayment(): Promise<void> {
    if (!this.state.selectedTier || !this.state.paymentMethod || !this.state.customerInfo) {
      return;
    }

    this.processing = true;

    try {
      const response = await fetch(`${this.apiEndpoint}/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier_id: this.state.selectedTier.id,
          payment_method: this.state.paymentMethod,
          customer: this.state.customerInfo
        })
      });

      const result = await response.json();

      if (result.success && result.payment_url) {
        // Redirect to payment gateway
        window.location.href = result.payment_url;
      } else if (result.success) {
        // Payment completed (for testing)
        this.state.orderId = result.order_id;
        this.state.step = 'success';
      } else {
        this.state.error = result.error || 'Đã xảy ra lỗi';
        this.state.step = 'error';
      }

    } catch (error) {
      this.state.error = 'Không thể kết nối đến máy chủ';
      this.state.step = 'error';
    } finally {
      this.processing = false;
    }
  }
}

export default CheckoutFlowComponent;
