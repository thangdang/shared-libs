/**
 * Checkout Flow Component
 * 
 * Payment checkout flow for subscriptions
 * Tasks: MON-014
 */

import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

export interface CheckoutItem {
  name: string;
  description: string;
  price: number;
  originalPrice?: number;
  billingCycle: 'monthly' | 'quarterly' | 'yearly';
}

export type PaymentMethod = 'vnpay' | 'momo' | 'zalopay' | 'bank_transfer';

export interface CheckoutResult {
  paymentMethod: PaymentMethod;
  email: string;
  couponCode?: string;
  agreed: boolean;
}

@Component({
  selector: 'app-checkout-flow',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="checkout-container">
      <div class="checkout-content">
        <!-- Order Summary -->
        <div class="order-summary">
          <h2>Đơn hàng của bạn</h2>
          
          <div class="order-item">
            <div class="item-info">
              <h3>{{ item.name }}</h3>
              <p>{{ item.description }}</p>
              <span class="billing-cycle">{{ getBillingCycleLabel() }}</span>
            </div>
            <div class="item-price">
              @if (item.originalPrice && item.originalPrice > item.price) {
                <span class="original-price">{{ formatPrice(item.originalPrice) }}</span>
              }
              <span class="current-price">{{ formatPrice(item.price) }}</span>
            </div>
          </div>

          @if (couponApplied()) {
            <div class="coupon-applied">
              <span>Mã giảm giá:  {{ appliedCoupon() }}</span>
              <span class="discount">-{{ formatPrice(couponDiscount()) }}</span>
              <button class="remove-coupon" (click)="removeCoupon()">×</button>
            </div>
          }

          <div class="order-total">
            <span>Tổng thanh toán</span>
            <span class="total-price">{{ formatPrice(totalPrice()) }}</span>
          </div>
        </div>

        <!-- Coupon Input -->
        @if (!couponApplied()) {
          <div class="coupon-section">
            <div class="coupon-input">
              <input 
                type="text" 
                placeholder="Mã giảm giá (nếu có)"
                [(ngModel)]="couponCode"
                [disabled]="couponLoading()"
              >
              <button 
                (click)="applyCoupon()"
                [disabled]="!couponCode || couponLoading()"
              >
                @if (couponLoading()) {
                  <span class="spinner"></span>
                } @else {
                  Áp dụng
                }
              </button>
            </div>
            @if (couponError()) {
              <p class="coupon-error">{{ couponError() }}</p>
            }
          </div>
        }

        <!-- Payment Methods -->
        <div class="payment-methods">
          <h2>Phương thức thanh toán</h2>
          
          <div class="method-list">
            @for (method of paymentMethods; track method.id) {
              <label 
                class="method-option"
                [class.selected]="selectedPayment() === method.id"
              >
                <input 
                  type="radio" 
                  name="payment"
                  [value]="method.id"
                  [(ngModel)]="selectedPaymentValue"
                  (change)="selectPayment(method.id)"
                >
                <div class="method-content">
                  <img [src]="method.icon" [alt]="method.name">
                  <div class="method-info">
                    <span class="method-name">{{ method.name }}</span>
                    <span class="method-desc">{{ method.description }}</span>
                  </div>
                </div>
                <div class="check-mark">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                  </svg>
                </div>
              </label>
            }
          </div>
        </div>

        <!-- Contact Info -->
        <div class="contact-section">
          <h2>Thông tin liên hệ</h2>
          <div class="form-group">
            <label>Email nhận hóa đơn</label>
            <input 
              type="email" 
              [(ngModel)]="email"
              placeholder="email@example.com"
            >
          </div>
        </div>

        <!-- Terms -->
        <div class="terms-section">
          <label class="checkbox-label">
            <input type="checkbox" [(ngModel)]="agreedToTerms">
            <span>
              Tôi đồng ý với 
              <a href="/terms" target="_blank">Điều khoản sử dụng</a> 
              và 
              <a href="/privacy" target="_blank">Chính sách bảo mật</a>
            </span>
          </label>
        </div>

        <!-- Submit -->
        <button 
          class="checkout-btn"
          [disabled]="!canCheckout()"
          (click)="processCheckout()"
        >
          @if (processing()) {
            <span class="spinner"></span>
            Đang xử lý...
          } @else {
            Thanh toán {{ formatPrice(totalPrice()) }}
          }
        </button>

        <!-- Security Note -->
        <div class="security-note">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
          </svg>
          <span>Thanh toán được bảo mật bởi các đối tác uy tín</span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkout-container {
      max-width: 600px;
      margin: 0 auto;
      padding: 2rem;
    }

    .checkout-content {
      background: white;
      border-radius: 16px;
      padding: 2rem;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
    }

    h2 {
      font-size: 1.125rem;
      font-weight: 600;
      margin-bottom: 1rem;
      color: var(--text-primary, #1a1a1a);
    }

    .order-summary {
      background: var(--bg-secondary, #f8f8f8);
      border-radius: 12px;
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }

    .order-item {
      display: flex;
      justify-content: space-between;
      gap: 1rem;
      padding-bottom: 1rem;
      border-bottom: 1px dashed var(--border, #e5e5e5);
      margin-bottom: 1rem;
    }

    .item-info h3 {
      font-size: 1rem;
      font-weight: 600;
      margin-bottom: 0.25rem;
    }

    .item-info p {
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
      margin-bottom: 0.25rem;
    }

    .billing-cycle {
      font-size: 0.75rem;
      background: var(--primary, #4f46e5);
      color: white;
      padding: 2px 8px;
      border-radius: 4px;
    }

    .item-price {
      text-align: right;
    }

    .original-price {
      display: block;
      font-size: 0.875rem;
      color: var(--text-secondary, #666);
      text-decoration: line-through;
    }

    .current-price {
      font-size: 1.25rem;
      font-weight: 700;
    }

    .coupon-applied {
      display: flex;
      align-items: center;
      gap: 1rem;
      background: var(--success-light, #dcfce7);
      padding: 0.75rem;
      border-radius: 8px;
      margin-bottom: 1rem;
    }

    .coupon-applied .discount {
      color: var(--success, #22c55e);
      font-weight: 600;
      margin-left: auto;
    }

    .remove-coupon {
      background: none;
      border: none;
      font-size: 1.25rem;
      cursor: pointer;
      color: var(--text-secondary, #666);
    }

    .order-total {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }

    .total-price {
      font-size: 1.5rem;
      color: var(--primary, #4f46e5);
    }

    .coupon-section {
      margin-bottom: 1.5rem;
    }

    .coupon-input {
      display: flex;
      gap: 0.5rem;
    }

    .coupon-input input {
      flex: 1;
      padding: 0.75rem;
      border: 1px solid var(--border, #e5e5e5);
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .coupon-input button {
      padding: 0.75rem 1.5rem;
      background: var(--bg-secondary, #f5f5f5);
      border: 1px solid var(--border, #e5e5e5);
      border-radius: 8px;
      font-weight: 500;
      cursor: pointer;
    }

    .coupon-input button:hover:not(:disabled) {
      background: var(--bg-tertiary, #eee);
    }

    .coupon-input button:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .coupon-error {
      color: var(--error, #ef4444);
      font-size: 0.875rem;
      margin-top: 0.5rem;
    }

    .payment-methods {
      margin-bottom: 1.5rem;
    }

    .method-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }

    .method-option {
      display: flex;
      align-items: center;
      padding: 1rem;
      border: 2px solid var(--border, #e5e5e5);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .method-option:hover {
      border-color: var(--primary-light, #a5b4fc);
    }

    .method-option.selected {
      border-color: var(--primary, #4f46e5);
      background: var(--primary-bg, #f5f3ff);
    }

    .method-option input {
      display: none;
    }

    .method-content {
      display: flex;
      align-items: center;
      gap: 1rem;
      flex: 1;
    }

    .method-content img {
      width: 48px;
      height: 32px;
      object-fit: contain;
    }

    .method-name {
      display: block;
      font-weight: 500;
    }

    .method-desc {
      display: block;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }

    .check-mark {
      width: 24px;
      height: 24px;
      color: var(--primary, #4f46e5);
      opacity: 0;
      transition: opacity 0.2s;
    }

    .method-option.selected .check-mark {
      opacity: 1;
    }

    .contact-section {
      margin-bottom: 1.5rem;
    }

    .form-group label {
      display: block;
      font-size: 0.875rem;
      font-weight: 500;
      margin-bottom: 0.5rem;
    }

    .form-group input {
      width: 100%;
      padding: 0.75rem;
      border: 1px solid var(--border, #e5e5e5);
      border-radius: 8px;
      font-size: 0.875rem;
    }

    .terms-section {
      margin-bottom: 1.5rem;
    }

    .checkbox-label {
      display: flex;
      align-items: flex-start;
      gap: 0.75rem;
      font-size: 0.875rem;
      cursor: pointer;
    }

    .checkbox-label input {
      margin-top: 3px;
    }

    .checkbox-label a {
      color: var(--primary, #4f46e5);
      text-decoration: none;
    }

    .checkout-btn {
      width: 100%;
      padding: 1rem;
      background: var(--primary, #4f46e5);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .checkout-btn:hover:not(:disabled) {
      background: var(--primary-dark, #4338ca);
    }

    .checkout-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .spinner {
      display: inline-block;
      width: 16px;
      height: 16px;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.75s linear infinite;
      margin-right: 0.5rem;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .security-note {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.5rem;
      margin-top: 1rem;
      font-size: 0.75rem;
      color: var(--text-secondary, #666);
    }

    .security-note svg {
      width: 16px;
      height: 16px;
    }

    @media (max-width: 640px) {
      .checkout-container {
        padding: 1rem;
      }

      .checkout-content {
        padding: 1.5rem;
      }
    }
  `]
})
export class CheckoutFlowComponent implements OnInit {
  @Input() item!: CheckoutItem;
  @Input() userEmail = '';

  @Output() checkout = new EventEmitter<CheckoutResult>();
  @Output() cancel = new EventEmitter<void>();

  selectedPayment = signal<PaymentMethod>('vnpay');
  selectedPaymentValue = 'vnpay';
  
  couponCode = '';
  couponApplied = signal(false);
  appliedCoupon = signal('');
  couponDiscount = signal(0);
  couponLoading = signal(false);
  couponError = signal('');

  email = '';
  agreedToTerms = false;
  processing = signal(false);

  paymentMethods = [
    {
      id: 'vnpay' as PaymentMethod,
      name: 'VNPay',
      description: 'Thẻ ATM, Visa, Mastercard',
      icon: '/assets/icons/vnpay.png'
    },
    {
      id: 'momo' as PaymentMethod,
      name: 'MoMo',
      description: 'Ví điện tử MoMo',
      icon: '/assets/icons/momo.png'
    },
    {
      id: 'zalopay' as PaymentMethod,
      name: 'ZaloPay',
      description: 'Ví điện tử ZaloPay',
      icon: '/assets/icons/zalopay.png'
    },
    {
      id: 'bank_transfer' as PaymentMethod,
      name: 'Chuyển khoản',
      description: 'Chuyển khoản ngân hàng',
      icon: '/assets/icons/bank.png'
    }
  ];

  totalPrice = computed(() => {
    return this.item.price - this.couponDiscount();
  });

  canCheckout = computed(() => {
    return this.selectedPayment() && 
           this.email && 
           this.agreedToTerms && 
           !this.processing();
  });

  ngOnInit(): void {
    this.email = this.userEmail;
  }

  selectPayment(method: PaymentMethod): void {
    this.selectedPayment.set(method);
  }

  getBillingCycleLabel(): string {
    switch (this.item.billingCycle) {
      case 'quarterly': return 'Thanh toán mỗi quý';
      case 'yearly': return 'Thanh toán mỗi năm';
      default: return 'Thanh toán hàng tháng';
    }
  }

  formatPrice(amount: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(amount);
  }

  applyCoupon(): void {
    if (!this.couponCode.trim()) return;

    this.couponLoading.set(true);
    this.couponError.set('');

    // Simulate API call
    setTimeout(() => {
      const validCoupons: Record<string, number> = {
        'WELCOME10': 0.1,
        'SAVE20': 0.2,
        'VIP50': 0.5
      };

      const discount = validCoupons[this.couponCode.toUpperCase()];
      
      if (discount) {
        this.couponApplied.set(true);
        this.appliedCoupon.set(this.couponCode.toUpperCase());
        this.couponDiscount.set(Math.floor(this.item.price * discount));
      } else {
        this.couponError.set('Mã giảm giá không hợp lệ hoặc đã hết hạn');
      }

      this.couponLoading.set(false);
    }, 1000);
  }

  removeCoupon(): void {
    this.couponApplied.set(false);
    this.appliedCoupon.set('');
    this.couponDiscount.set(0);
    this.couponCode = '';
  }

  processCheckout(): void {
    if (!this.canCheckout()) return;

    this.processing.set(true);

    this.checkout.emit({
      paymentMethod: this.selectedPayment(),
      email: this.email,
      couponCode: this.couponApplied() ? this.appliedCoupon() : undefined,
      agreed: this.agreedToTerms
    });
  }
}
