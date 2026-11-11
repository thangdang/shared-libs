/**
 * Checkout Flow Component
 * Task:  MON-014
 * 
 * Handles the payment checkout process.
 * Supports VNPay, MoMo, and card payments.
 * Includes order summary and payment form.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface CheckoutTier {
  id: string;
  name: string;
  nameVi: string;
  price: number;
  originalPrice?: number;
  billingCycle: 'monthly' | 'yearly';
  features: string[];
}

export interface PaymentMethod {
  id: string;
  name: string;
  icon: string;
  description: string;
  enabled: boolean;
}

export interface PromoCode {
  code: string;
  discountPercent: number;
  discountAmount: number;
  validUntil: string;
  isValid: boolean;
  message?: string;
}

type CheckoutStep = 'review' | 'payment' | 'processing' | 'success' | 'error';

@Component({
  selector: 'app-checkout-flow',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="checkout-container">
      <!-- Progress Steps -->
      <div class="checkout-progress" *ngIf="currentStep() !== 'success' && currentStep() !== 'error'">
        <div class="step" [class.active]="currentStep() === 'review'" [class.completed]="stepCompleted('review')">
          <div class="step-number">1</div>
          <span>Xác nhận đơn</span>
        </div>
        <div class="step-line" [class.completed]="stepCompleted('review')"></div>
        <div class="step" [class.active]="currentStep() === 'payment'" [class.completed]="stepCompleted('payment')">
          <div class="step-number">2</div>
          <span>Thanh toán</span>
        </div>
        <div class="step-line" [class.completed]="stepCompleted('payment')"></div>
        <div class="step" [class.active]="currentStep() === 'processing'">
          <div class="step-number">3</div>
          <span>Hoàn tất</span>
        </div>
      </div>

      <!-- Step 1:  Review Order -->
      <div class="checkout-step" *ngIf="currentStep() === 'review'">
        <div class="checkout-main">
          <h2>Xác nhận đơn hàng</h2>
          
          <!-- Selected Plan -->
          <div class="order-card" *ngIf="selectedTier()">
            <div class="order-header">
              <h3>{{ selectedTier()!.nameVi }}</h3>
              <span class="billing-badge">
                {{ selectedTier()!.billingCycle === 'monthly' ? 'Hàng tháng' : 'Hàng năm' }}
              </span>
            </div>
            
            <ul class="features-list">
              <li *ngFor="let feature of selectedTier()!.features">
                <span class="check">✓</span>
                {{ feature }}
              </li>
            </ul>
          </div>

          <!-- Promo Code -->
          <div class="promo-section">
            <h4>Mã giảm giá</h4>
            <div class="promo-input-group">
              <input 
                type="text"
                placeholder="Nhập mã giảm giá"
                [formControl]="promoCodeControl"
                [class.invalid]="appliedPromo()?.isValid === false"
              />
              <button 
                class="btn-apply"
                (click)="applyPromoCode()"
                [disabled]="applyingPromo()"
              >
                {{ applyingPromo() ? 'Đang kiểm tra...' : 'Áp dụng' }}
              </button>
            </div>
            
            <div class="promo-message success" *ngIf="appliedPromo()?.isValid">
              ✓ {{ appliedPromo()!.message || 'Mã giảm giá đã được áp dụng!' }}
            </div>
            <div class="promo-message error" *ngIf="appliedPromo()?.isValid === false">
              ✕ {{ appliedPromo()!.message || 'Mã giảm giá không hợp lệ' }}
            </div>
          </div>

          <!-- User Info (for new users) -->
          <div class="user-info-section" *ngIf="!isLoggedIn()">
            <h4>Thông tin của bạn</h4>
            <form [formGroup]="userForm">
              <div class="form-group">
                <label>Email *</label>
                <input type="email" formControlName="email" placeholder="your@email.com" />
                <span class="error" *ngIf="userForm.get('email')?.touched && userForm.get('email')?.invalid">
                  Email không hợp lệ
                </span>
              </div>
              <div class="form-group">
                <label>Họ tên</label>
                <input type="text" formControlName="fullName" placeholder="Nguyễn Văn A" />
              </div>
              <div class="form-group">
                <label>Số điện thoại</label>
                <input type="tel" formControlName="phone" placeholder="0901234567" />
              </div>
            </form>
          </div>
        </div>

        <!-- Order Summary Sidebar -->
        <div class="order-summary">
          <h3>Tóm tắt đơn hàng</h3>
          
          <div class="summary-row">
            <span>{{ selectedTier()?.nameVi }}</span>
            <span>{{ formatPrice(selectedTier()?.price || 0) }}</span>
          </div>
          
          <div class="summary-row discount" *ngIf="discountAmount() > 0">
            <span>Giảm giá</span>
            <span>-{{ formatPrice(discountAmount()) }}</span>
          </div>
          
          <div class="summary-divider"></div>
          
          <div class="summary-row total">
            <span>Tổng cộng</span>
            <span>{{ formatPrice(finalPrice()) }}</span>
          </div>
          
          <div class="vat-note">
            * Giá đã bao gồm VAT
          </div>

          <button 
            class="btn-continue"
            (click)="goToPayment()"
            [disabled]="!canProceedToPayment()"
          >
            Tiếp tục thanh toán
          </button>

          <p class="secure-note">
            🔒 Thanh toán an toàn & bảo mật
          </p>
        </div>
      </div>

      <!-- Step 2:  Payment Method -->
      <div class="checkout-step" *ngIf="currentStep() === 'payment'">
        <div class="checkout-main">
          <h2>Chọn phương thức thanh toán</h2>
          
          <div class="payment-methods">
            <div 
              *ngFor="let method of paymentMethods"
              class="payment-method"
              [class.selected]="selectedPaymentMethod() === method.id"
              [class.disabled]="!method.enabled"
              (click)="selectPaymentMethod(method)"
            >
              <img [src]="method.icon" [alt]="method.name" class="method-icon" />
              <div class="method-info">
                <span class="method-name">{{ method.name }}</span>
                <span class="method-desc">{{ method.description }}</span>
              </div>
              <div class="method-check" *ngIf="selectedPaymentMethod() === method.id">✓</div>
            </div>
          </div>

          <!-- Bank Card Form (if card selected) -->
          <div class="card-form" *ngIf="selectedPaymentMethod() === 'card'">
            <form [formGroup]="cardForm">
              <div class="form-group">
                <label>Số thẻ</label>
                <input 
                  type="text" 
                  formControlName="cardNumber" 
                  placeholder="1234 5678 9012 3456"
                  maxlength="19"
                  (input)="formatCardNumber($event)"
                />
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label>Ngày hết hạn</label>
                  <input 
                    type="text" 
                    formControlName="expiry" 
                    placeholder="MM/YY"
                    maxlength="5"
                    (input)="formatExpiry($event)"
                  />
                </div>
                <div class="form-group">
                  <label>CVV</label>
                  <input 
                    type="text" 
                    formControlName="cvv" 
                    placeholder="123"
                    maxlength="4"
                  />
                </div>
              </div>
              <div class="form-group">
                <label>Tên chủ thẻ</label>
                <input type="text" formControlName="cardName" placeholder="NGUYEN VAN A" />
              </div>
            </form>
          </div>

          <button class="btn-back" (click)="goBack()">
            ← Quay lại
          </button>
        </div>

        <!-- Order Summary Sidebar -->
        <div class="order-summary">
          <h3>Tóm tắt đơn hàng</h3>
          
          <div class="summary-row">
            <span>{{ selectedTier()?.nameVi }}</span>
            <span>{{ formatPrice(selectedTier()?.price || 0) }}</span>
          </div>
          
          <div class="summary-row discount" *ngIf="discountAmount() > 0">
            <span>Giảm giá</span>
            <span>-{{ formatPrice(discountAmount()) }}</span>
          </div>
          
          <div class="summary-divider"></div>
          
          <div class="summary-row total">
            <span>Tổng cộng</span>
            <span>{{ formatPrice(finalPrice()) }}</span>
          </div>

          <button 
            class="btn-pay"
            (click)="processPayment()"
            [disabled]="!canProcessPayment()"
          >
            Thanh toán {{ formatPrice(finalPrice()) }}
          </button>

          <p class="terms-note">
            Bằng việc thanh toán, bạn đồng ý với 
            <a href="/terms">Điều khoản sử dụng</a> và 
            <a href="/privacy">Chính sách bảo mật</a>.
          </p>
        </div>
      </div>

      <!-- Step 3:  Processing -->
      <div class="checkout-step processing-step" *ngIf="currentStep() === 'processing'">
        <div class="processing-content">
          <div class="spinner"></div>
          <h2>Đang xử lý thanh toán...</h2>
          <p>Vui lòng không đóng trang này</p>
        </div>
      </div>

      <!-- Success -->
      <div class="checkout-step success-step" *ngIf="currentStep() === 'success'">
        <div class="success-content">
          <div class="success-icon">✓</div>
          <h2>Thanh toán thành công!</h2>
          <p>Cảm ơn bạn đã đăng ký {{ selectedTier()?.nameVi }}.</p>
          
          <div class="success-details">
            <div class="detail-row">
              <span>Mã đơn hàng:</span>
              <strong>{{ orderId() }}</strong>
            </div>
            <div class="detail-row">
              <span>Gói đăng ký:</span>
              <strong>{{ selectedTier()?.nameVi }}</strong>
            </div>
            <div class="detail-row">
              <span>Số tiền:</span>
              <strong>{{ formatPrice(finalPrice()) }}</strong>
            </div>
          </div>

          <p class="email-note">
            Biên lai đã được gửi đến email của bạn.
          </p>

          <button class="btn-primary" (click)="goToDashboard()">
            Bắt đầu sử dụng
          </button>
        </div>
      </div>

      <!-- Error -->
      <div class="checkout-step error-step" *ngIf="currentStep() === 'error'">
        <div class="error-content">
          <div class="error-icon">✕</div>
          <h2>Thanh toán thất bại</h2>
          <p>{{ errorMessage() }}</p>
          
          <div class="error-actions">
            <button class="btn-retry" (click)="retryPayment()">
              Thử lại
            </button>
            <button class="btn-secondary" (click)="goToSupport()">
              Liên hệ hỗ trợ
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .checkout-container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    /* Progress Steps */
    .checkout-progress {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 48px;
    }

    .step {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #6b7280;
    }

    .step.active {
      color: #3b82f6;
    }

    .step.completed {
      color: #22c55e;
    }

    .step-number {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      background: #374151;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      font-size: 0.9rem;
    }

    .step.active .step-number {
      background: #3b82f6;
      color: white;
    }

    .step.completed .step-number {
      background: #22c55e;
      color: white;
    }

    .step-line {
      width: 60px;
      height: 2px;
      background: #374151;
      margin: 0 16px;
    }

    .step-line.completed {
      background: #22c55e;
    }

    /* Checkout Layout */
    .checkout-step {
      display: grid;
      grid-template-columns: 1fr 360px;
      gap: 32px;
    }

    .checkout-main {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 32px;
    }

    .checkout-main h2 {
      font-size: 1.5rem;
      color: #f3f4f6;
      margin: 0 0 24px 0;
    }

    /* Order Card */
    .order-card {
      background: rgba(59, 130, 246, 0.1);
      border: 1px solid rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .order-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
    }

    .order-header h3 {
      margin: 0;
      color: #f3f4f6;
    }

    .billing-badge {
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .features-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }

    .features-list li {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d1d5db;
      padding: 6px 0;
      font-size: 0.9rem;
    }

    .features-list .check {
      color: #22c55e;
    }

    /* Promo Section */
    .promo-section {
      margin-bottom: 24px;
    }

    .promo-section h4 {
      color: #f3f4f6;
      margin: 0 0 12px 0;
      font-size: 1rem;
    }

    .promo-input-group {
      display: flex;
      gap: 12px;
    }

    .promo-input-group input {
      flex: 1;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f3f4f6;
      font-size: 1rem;
    }

    .promo-input-group input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .promo-input-group input.invalid {
      border-color: #ef4444;
    }

    .btn-apply {
      padding: 12px 20px;
      background: #374151;
      border: none;
      border-radius: 8px;
      color: #f3f4f6;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-apply:hover:not(:disabled) {
      background: #4b5563;
    }

    .btn-apply:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .promo-message {
      margin-top: 8px;
      font-size: 0.85rem;
    }

    .promo-message.success {
      color: #22c55e;
    }

    .promo-message.error {
      color: #ef4444;
    }

    /* User Info Form */
    .user-info-section h4 {
      color: #f3f4f6;
      margin: 0 0 16px 0;
      font-size: 1rem;
    }

    .form-group {
      margin-bottom: 16px;
    }

    .form-group label {
      display: block;
      color: #9ca3af;
      font-size: 0.85rem;
      margin-bottom: 6px;
    }

    .form-group input {
      width: 100%;
      padding: 12px 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      color: #f3f4f6;
      font-size: 1rem;
    }

    .form-group input:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .form-group .error {
      color: #ef4444;
      font-size: 0.8rem;
      margin-top: 4px;
    }

    .form-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }

    /* Order Summary */
    .order-summary {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
      height: fit-content;
      position: sticky;
      top: 20px;
    }

    .order-summary h3 {
      font-size: 1.1rem;
      color: #f3f4f6;
      margin: 0 0 20px 0;
    }

    .summary-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      color: #d1d5db;
      font-size: 0.95rem;
    }

    .summary-row.discount {
      color: #22c55e;
    }

    .summary-row.total {
      font-size: 1.1rem;
      font-weight: 600;
      color: #f3f4f6;
    }

    .summary-divider {
      height: 1px;
      background: rgba(255, 255, 255, 0.1);
      margin: 12px 0;
    }

    .vat-note {
      color: #6b7280;
      font-size: 0.8rem;
      margin: 8px 0 20px;
    }

    .btn-continue,
    .btn-pay {
      width: 100%;
      padding: 14px 24px;
      background: #3b82f6;
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: background 0.2s;
    }

    .btn-continue:hover:not(:disabled),
    .btn-pay:hover:not(:disabled) {
      background: #2563eb;
    }

    .btn-continue:disabled,
    .btn-pay:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .secure-note {
      text-align: center;
      color: #6b7280;
      font-size: 0.85rem;
      margin: 16px 0 0;
    }

    .terms-note {
      text-align: center;
      color: #6b7280;
      font-size: 0.8rem;
      margin: 16px 0 0;
      line-height: 1.5;
    }

    .terms-note a {
      color: #3b82f6;
      text-decoration: none;
    }

    /* Payment Methods */
    .payment-methods {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .payment-method {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }

    .payment-method:hover:not(.disabled) {
      border-color: rgba(59, 130, 246, 0.3);
    }

    .payment-method.selected {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }

    .payment-method.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .method-icon {
      width: 48px;
      height: 32px;
      object-fit: contain;
    }

    .method-info {
      flex: 1;
    }

    .method-name {
      display: block;
      color: #f3f4f6;
      font-weight: 500;
    }

    .method-desc {
      display: block;
      color: #6b7280;
      font-size: 0.85rem;
    }

    .method-check {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: #3b82f6;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.8rem;
    }

    /* Card Form */
    .card-form {
      background: rgba(255, 255, 255, 0.02);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }

    .btn-back {
      background: none;
      border: none;
      color: #9ca3af;
      cursor: pointer;
      font-size: 0.95rem;
      padding: 0;
    }

    .btn-back:hover {
      color: #f3f4f6;
    }

    /* Processing Step */
    .processing-step,
    .success-step,
    .error-step {
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 400px;
    }

    .processing-content,
    .success-content,
    .error-content {
      text-align: center;
      max-width: 400px;
    }

    .spinner {
      width: 48px;
      height: 48px;
      border: 4px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      margin: 0 auto 24px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .processing-content h2 {
      color: #f3f4f6;
      margin: 0 0 8px 0;
    }

    .processing-content p {
      color: #6b7280;
      margin: 0;
    }

    /* Success Step */
    .success-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #22c55e;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin: 0 auto 24px;
    }

    .success-content h2 {
      color: #f3f4f6;
      margin: 0 0 8px 0;
    }

    .success-content p {
      color: #9ca3af;
      margin: 0 0 24px 0;
    }

    .success-details {
      background: rgba(255, 255, 255, 0.03);
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      color: #d1d5db;
    }

    .detail-row strong {
      color: #f3f4f6;
    }

    .email-note {
      color: #6b7280;
      font-size: 0.9rem;
      margin-bottom: 24px;
    }

    .btn-primary {
      padding: 14px 32px;
      background: #3b82f6;
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-primary:hover {
      background: #2563eb;
    }

    /* Error Step */
    .error-icon {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      background: #ef4444;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      margin: 0 auto 24px;
    }

    .error-content h2 {
      color: #f3f4f6;
      margin: 0 0 8px 0;
    }

    .error-content p {
      color: #9ca3af;
      margin: 0 0 24px 0;
    }

    .error-actions {
      display: flex;
      gap: 16px;
      justify-content: center;
    }

    .btn-retry {
      padding: 14px 32px;
      background: #3b82f6;
      border: none;
      border-radius: 10px;
      color: white;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
    }

    .btn-secondary {
      padding: 14px 32px;
      background: #374151;
      border: none;
      border-radius: 10px;
      color: #f3f4f6;
      font-size: 1rem;
      cursor: pointer;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .checkout-step {
        grid-template-columns: 1fr;
      }

      .order-summary {
        position: static;
        order: -1;
      }

      .step span {
        display: none;
      }

      .form-row {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class CheckoutFlowComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private http = inject(HttpClient);
  private fb = inject(FormBuilder);
  private destroy$ = new Subject<void>();

  // State
  currentStep = signal<CheckoutStep>('review');
  selectedTier = signal<CheckoutTier | null>(null);
  selectedPaymentMethod = signal<string>('vnpay');
  appliedPromo = signal<PromoCode | null>(null);
  applyingPromo = signal(false);
  isLoggedIn = signal(false);
  orderId = signal<string>('');
  errorMessage = signal<string>('');

  // Forms
  promoCodeControl = this.fb.control('');
  userForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    fullName: [''],
    phone: ['']
  });
  cardForm = this.fb.group({
    cardNumber: ['', Validators.required],
    expiry: ['', Validators.required],
    cvv: ['', Validators.required],
    cardName: ['', Validators.required]
  });

  // Payment Methods
  paymentMethods: PaymentMethod[] = [
    {
      id: 'vnpay',
      name: 'VNPay',
      icon: '/assets/payment/vnpay.svg',
      description: 'Thanh toán qua ví VNPay hoặc thẻ ATM nội địa',
      enabled: true
    },
    {
      id: 'momo',
      name: 'MoMo',
      icon: '/assets/payment/momo.svg',
      description: 'Thanh toán qua ví MoMo',
      enabled: true
    },
    {
      id: 'card',
      name: 'Thẻ quốc tế',
      icon: '/assets/payment/visa.svg',
      description: 'Visa, Mastercard, JCB',
      enabled: true
    }
  ];

  // Computed
  discountAmount = computed(() => {
    const promo = this.appliedPromo();
    const tier = this.selectedTier();
    if (!promo?.isValid || !tier) return 0;
    
    if (promo.discountPercent > 0) {
      return Math.round(tier.price * promo.discountPercent / 100);
    }
    return promo.discountAmount;
  });

  finalPrice = computed(() => {
    const tier = this.selectedTier();
    if (!tier) return 0;
    return Math.max(0, tier.price - this.discountAmount());
  });

  canProceedToPayment = computed(() => {
    if (this.isLoggedIn()) return true;
    return this.userForm.valid;
  });

  canProcessPayment = computed(() => {
    const method = this.selectedPaymentMethod();
    if (method === 'card') {
      return this.cardForm.valid;
    }
    return true;
  });

  ngOnInit(): void {
    this.route.queryParams
      .pipe(takeUntil(this.destroy$))
      .subscribe(params => {
        if (params['tier']) {
          this.loadTierDetails(params['tier']);
        }
      });

    this.checkLoginStatus();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadTierDetails(tierId: string): void {
    this.http.get<CheckoutTier>(
      `${environment.apiUrl}/api/subscriptions/tiers/${tierId}`
    ).pipe(
      catchError(() => of(this.getDefaultTier(tierId)))
    ).subscribe(tier => {
      this.selectedTier.set(tier);
    });
  }

  private getDefaultTier(tierId: string): CheckoutTier {
    const tiers: Record<string, CheckoutTier> = {
      'basic-monthly': {
        id: 'basic-monthly',
        name: 'Basic',
        nameVi: 'Gói Cơ bản',
        price: 49000,
        billingCycle: 'monthly',
        features: [
          'Tra cứu không giới hạn',
          'Lưu lịch sử tra cứu',
          'Xuất dữ liệu CSV',
          'Thông báo cơ bản'
        ]
      },
      'basic-yearly': {
        id: 'basic-yearly',
        name: 'Basic',
        nameVi: 'Gói Cơ bản',
        price: 470000,
        originalPrice: 588000,
        billingCycle: 'yearly',
        features: [
          'Tra cứu không giới hạn',
          'Lưu lịch sử tra cứu',
          'Xuất dữ liệu CSV',
          'Thông báo cơ bản'
        ]
      },
      'premium-monthly': {
        id: 'premium-monthly',
        name: 'Premium',
        nameVi: 'Gói Cao cấp',
        price: 99000,
        billingCycle: 'monthly',
        features: [
          'Tất cả tính năng Cơ bản',
          'Không quảng cáo',
          'Hỗ trợ ưu tiên',
          'Thông báo nâng cao',
          'Truy cập API'
        ]
      },
      'premium-yearly': {
        id: 'premium-yearly',
        name: 'Premium',
        nameVi: 'Gói Cao cấp',
        price: 950000,
        originalPrice: 1188000,
        billingCycle: 'yearly',
        features: [
          'Tất cả tính năng Cơ bản',
          'Không quảng cáo',
          'Hỗ trợ ưu tiên',
          'Thông báo nâng cao',
          'Truy cập API'
        ]
      }
    };
    return tiers[tierId] || tiers['basic-monthly'];
  }

  private checkLoginStatus(): void {
    // Check if user is logged in
    const token = localStorage.getItem('auth_token');
    this.isLoggedIn.set(!!token);
  }

  stepCompleted(step: CheckoutStep): boolean {
    const steps: CheckoutStep[] = ['review', 'payment', 'processing', 'success'];
    const currentIndex = steps.indexOf(this.currentStep());
    const stepIndex = steps.indexOf(step);
    return stepIndex < currentIndex;
  }

  applyPromoCode(): void {
    const code = this.promoCodeControl.value?.trim();
    if (!code) return;

    this.applyingPromo.set(true);
    
    this.http.post<PromoCode>(
      `${environment.apiUrl}/api/promo/validate`,
      { code, tierId: this.selectedTier()?.id }
    ).pipe(
      catchError(() => of({
        code,
        discountPercent: 0,
        discountAmount: 0,
        validUntil: '',
        isValid: false,
        message: 'Mã giảm giá không hợp lệ hoặc đã hết hạn'
      }))
    ).subscribe(result => {
      this.appliedPromo.set(result);
      this.applyingPromo.set(false);
    });
  }

  goToPayment(): void {
    if (!this.canProceedToPayment()) return;
    this.currentStep.set('payment');
  }

  goBack(): void {
    this.currentStep.set('review');
  }

  selectPaymentMethod(method: PaymentMethod): void {
    if (!method.enabled) return;
    this.selectedPaymentMethod.set(method.id);
  }

  formatCardNumber(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    value = value.replace(/(\d{4})(?=\d)/g, '$1 ');
    input.value = value.substring(0, 19);
    this.cardForm.get('cardNumber')?.setValue(input.value);
  }

  formatExpiry(event: Event): void {
    const input = event.target as HTMLInputElement;
    let value = input.value.replace(/\D/g, '');
    if (value.length >= 2) {
      value = value.substring(0, 2) + '/' + value.substring(2);
    }
    input.value = value.substring(0, 5);
    this.cardForm.get('expiry')?.setValue(input.value);
  }

  processPayment(): void {
    if (!this.canProcessPayment()) return;

    this.currentStep.set('processing');

    const paymentData = {
      tierId: this.selectedTier()?.id,
      amount: this.finalPrice(),
      paymentMethod: this.selectedPaymentMethod(),
      promoCode: this.appliedPromo()?.isValid ? this.appliedPromo()?.code : null,
      user: this.isLoggedIn() ? null : this.userForm.value,
      card: this.selectedPaymentMethod() === 'card' ? this.cardForm.value : null
    };

    this.http.post<{ orderId: string; redirectUrl?: string }>(
      `${environment.apiUrl}/api/payments/create`,
      paymentData
    ).pipe(
      catchError(err => {
        this.errorMessage.set(err.error?.message || 'Có lỗi xảy ra.  Vui lòng thử lại.');
        this.currentStep.set('error');
        return of(null);
      })
    ).subscribe(result => {
      if (result) {
        if (result.redirectUrl) {
          // Redirect to payment gateway (VNPay/MoMo)
          window.location.href = result.redirectUrl;
        } else {
          // Direct payment success (card)
          this.orderId.set(result.orderId);
          this.currentStep.set('success');
        }
      }
    });
  }

  retryPayment(): void {
    this.currentStep.set('payment');
    this.errorMessage.set('');
  }

  goToDashboard(): void {
    this.router.navigate(['/dashboard']);
  }

  goToSupport(): void {
    this.router.navigate(['/support']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(price);
  }
}
