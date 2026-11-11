/**
 * My Subscription Component
 * Task:  MON-015
 * 
 * Displays user's current subscription details.
 * Handles upgrade, downgrade, and cancellation.
 * Shows billing history and payment methods.
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import { Component, OnInit, OnDestroy, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Subject, takeUntil, catchError, of } from 'rxjs';
import { environment } from '../../../../environments/environment';

export interface Subscription {
  id: string;
  tierId: string;
  tierName: string;
  tierNameVi: string;
  status: 'active' | 'cancelled' | 'expired' | 'past_due';
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  billingCycle: 'monthly' | 'yearly';
  price: number;
  features: string[];
}

export interface PaymentMethod {
  id: string;
  type: 'vnpay' | 'momo' | 'card';
  last4?: string;
  brand?: string;
  expiryMonth?: number;
  expiryYear?: number;
  isDefault: boolean;
}

export interface Invoice {
  id: string;
  amount: number;
  status: 'paid' | 'pending' | 'failed';
  createdAt: string;
  paidAt?: string;
  description: string;
  invoiceUrl?: string;
}

type TabType = 'overview' | 'billing' | 'payment-methods';

@Component({
  selector: 'app-my-subscription',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="subscription-page">
      <header class="page-header">
        <h1>Gói đăng ký của tôi</h1>
        <p class="subtitle">Quản lý gói đăng ký và thanh toán</p>
      </header>

      <!-- Tabs -->
      <div class="tabs">
        <button 
          class="tab"
          [class.active]="activeTab() === 'overview'"
          (click)="setTab('overview')"
        >
          Tổng quan
        </button>
        <button 
          class="tab"
          [class.active]="activeTab() === 'billing'"
          (click)="setTab('billing')"
        >
          Lịch sử thanh toán
        </button>
        <button 
          class="tab"
          [class.active]="activeTab() === 'payment-methods'"
          (click)="setTab('payment-methods')"
        >
          Phương thức thanh toán
        </button>
      </div>

      <!-- Loading State -->
      <div class="loading-state" *ngIf="loading()">
        <div class="spinner"></div>
        <p>Đang tải...</p>
      </div>

      <!-- Tab Content -->
      <div class="tab-content" *ngIf="!loading()">
        
        <!-- Overview Tab -->
        <div class="overview-tab" *ngIf="activeTab() === 'overview'">
          <!-- Current Plan Card -->
          <div class="plan-card" [class.cancelled]="subscription()?.cancelAtPeriodEnd">
            <div class="plan-header">
              <div class="plan-info">
                <span class="plan-label">Gói hiện tại</span>
                <h2 class="plan-name">{{ subscription()?.tierNameVi || 'Miễn phí' }}</h2>
              </div>
              <div class="plan-badge" [class]="subscription()?.status">
                {{ getStatusLabel(subscription()?.status) }}
              </div>
            </div>

            <!-- Cancellation Notice -->
            <div class="cancellation-notice" *ngIf="subscription()?.cancelAtPeriodEnd">
              <span class="notice-icon">⚠️</span>
              <div>
                <strong>Gói sẽ hết hạn vào {{ formatDate(subscription()?.currentPeriodEnd) }}</strong>
                <p>Sau ngày này, bạn sẽ chuyển về gói Miễn phí.</p>
              </div>
            </div>

            <!-- Plan Details -->
            <div class="plan-details" *ngIf="subscription()">
              <div class="detail-row">
                <span class="label">Chu kỳ thanh toán:</span>
                <span class="value">{{ subscription()?.billingCycle === 'monthly' ? 'Hàng tháng' : 'Hàng năm' }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Giá:</span>
                <span class="value">{{ formatPrice(subscription()?.price || 0) }}/{{ subscription()?.billingCycle === 'monthly' ? 'tháng' : 'năm' }}</span>
              </div>
              <div class="detail-row">
                <span class="label">Kỳ hiện tại:</span>
                <span class="value">{{ formatDate(subscription()?.currentPeriodStart) }} - {{ formatDate(subscription()?.currentPeriodEnd) }}</span>
              </div>
              <div class="detail-row" *ngIf="!subscription()?.cancelAtPeriodEnd">
                <span class="label">Gia hạn tiếp theo:</span>
                <span class="value">{{ formatDate(subscription()?.currentPeriodEnd) }}</span>
              </div>
            </div>

            <!-- Features -->
            <div class="plan-features" *ngIf="subscription()?.features?.length">
              <h4>Tính năng bao gồm:</h4>
              <ul>
                <li *ngFor="let feature of subscription()?.features">
                  <span class="check">✓</span>
                  {{ feature }}
                </li>
              </ul>
            </div>

            <!-- Actions -->
            <div class="plan-actions">
              <button 
                class="btn-upgrade"
                *ngIf="!subscription() || subscription()?.tierId === 'free'"
                (click)="goToPricing()"
              >
                Nâng cấp gói
              </button>
              
              <button 
                class="btn-change"
                *ngIf="subscription() && subscription()?.tierId !== 'free'"
                (click)="goToPricing()"
              >
                Đổi gói
              </button>

              <button 
                class="btn-reactivate"
                *ngIf="subscription()?.cancelAtPeriodEnd"
                (click)="reactivateSubscription()"
              >
                Tiếp tục gia hạn
              </button>

              <button 
                class="btn-cancel"
                *ngIf="subscription() && subscription()?.tierId !== 'free' && !subscription()?.cancelAtPeriodEnd"
                (click)="showCancelModal.set(true)"
              >
                Hủy gói
              </button>
            </div>
          </div>

          <!-- Usage Stats (Optional) -->
          <div class="usage-card" *ngIf="subscription()">
            <h3>Thống kê sử dụng tháng này</h3>
            <div class="usage-grid">
              <div class="usage-item">
                <span class="usage-value">{{ usageStats().searches }}</span>
                <span class="usage-label">Lượt tra cứu</span>
              </div>
              <div class="usage-item">
                <span class="usage-value">{{ usageStats().exports }}</span>
                <span class="usage-label">Xuất dữ liệu</span>
              </div>
              <div class="usage-item">
                <span class="usage-value">{{ usageStats().alerts }}</span>
                <span class="usage-label">Thông báo nhận</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Billing History Tab -->
        <div class="billing-tab" *ngIf="activeTab() === 'billing'">
          <div class="invoices-list" *ngIf="invoices().length > 0">
            <div class="invoice-item" *ngFor="let invoice of invoices()">
              <div class="invoice-info">
                <span class="invoice-desc">{{ invoice.description }}</span>
                <span class="invoice-date">{{ formatDate(invoice.createdAt) }}</span>
              </div>
              <div class="invoice-amount">
                {{ formatPrice(invoice.amount) }}
              </div>
              <div class="invoice-status" [class]="invoice.status">
                {{ getInvoiceStatusLabel(invoice.status) }}
              </div>
              <button 
                class="btn-download"
                *ngIf="invoice.invoiceUrl"
                (click)="downloadInvoice(invoice)"
              >
                Tải hóa đơn
              </button>
            </div>
          </div>

          <div class="empty-state" *ngIf="invoices().length === 0">
            <span class="empty-icon">📋</span>
            <p>Chưa có lịch sử thanh toán</p>
          </div>
        </div>

        <!-- Payment Methods Tab -->
        <div class="payment-methods-tab" *ngIf="activeTab() === 'payment-methods'">
          <div class="methods-list" *ngIf="paymentMethods().length > 0">
            <div 
              class="method-item"
              *ngFor="let method of paymentMethods()"
              [class.default]="method.isDefault"
            >
              <div class="method-icon">
                <img [src]="getPaymentIcon(method.type)" [alt]="method.type" />
              </div>
              <div class="method-info">
                <span class="method-name">
                  {{ getPaymentMethodName(method) }}
                </span>
                <span class="method-detail" *ngIf="method.type === 'card'">
                  •••• {{ method.last4 }} | Hết hạn {{ method.expiryMonth }}/{{ method.expiryYear }}
                </span>
              </div>
              <div class="method-actions">
                <span class="default-badge" *ngIf="method.isDefault">Mặc định</span>
                <button 
                  class="btn-set-default"
                  *ngIf="!method.isDefault"
                  (click)="setDefaultPaymentMethod(method)"
                >
                  Đặt mặc định
                </button>
                <button 
                  class="btn-remove"
                  (click)="removePaymentMethod(method)"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>

          <button class="btn-add-method" (click)="addPaymentMethod()">
            + Thêm phương thức thanh toán
          </button>
        </div>
      </div>

      <!-- Cancel Subscription Modal -->
      <div class="modal-overlay" *ngIf="showCancelModal()" (click)="showCancelModal.set(false)">
        <div class="modal-content" (click)="$event.stopPropagation()">
          <h3>Hủy gói đăng ký?</h3>
          <p>
            Gói của bạn sẽ tiếp tục hoạt động đến hết ngày <strong>{{ formatDate(subscription()?.currentPeriodEnd) }}</strong>.
          </p>
          <p class="warning">
            Sau đó, bạn sẽ mất quyền truy cập vào các tính năng cao cấp.
          </p>

          <div class="modal-actions">
            <button class="btn-keep" (click)="showCancelModal.set(false)">
              Giữ gói
            </button>
            <button 
              class="btn-confirm-cancel"
              (click)="cancelSubscription()"
              [disabled]="cancelling()"
            >
              {{ cancelling() ? 'Đang xử lý...' : 'Xác nhận hủy' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .subscription-page {
      max-width: 900px;
      margin: 0 auto;
      padding: 40px 20px;
    }

    .page-header {
      margin-bottom: 32px;
    }

    .page-header h1 {
      font-size: 1.75rem;
      color: #f3f4f6;
      margin: 0 0 8px 0;
    }

    .subtitle {
      color: #9ca3af;
      margin: 0;
    }

    /* Tabs */
    .tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 32px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      padding-bottom: 16px;
    }

    .tab {
      padding: 10px 20px;
      background: none;
      border: none;
      border-radius: 8px;
      color: #9ca3af;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .tab:hover {
      color: #f3f4f6;
      background: rgba(255, 255, 255, 0.05);
    }

    .tab.active {
      color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }

    /* Loading */
    .loading-state {
      text-align: center;
      padding: 64px;
    }

    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      margin: 0 auto 16px;
      animation: spin 1s linear infinite;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .loading-state p {
      color: #6b7280;
    }

    /* Plan Card */
    .plan-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 28px;
      margin-bottom: 24px;
    }

    .plan-card.cancelled {
      border-color: rgba(239, 68, 68, 0.3);
    }

    .plan-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    }

    .plan-label {
      display: block;
      color: #6b7280;
      font-size: 0.85rem;
      margin-bottom: 4px;
    }

    .plan-name {
      color: #f3f4f6;
      font-size: 1.5rem;
      margin: 0;
    }

    .plan-badge {
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.8rem;
      font-weight: 500;
    }

    .plan-badge.active {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .plan-badge.cancelled {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .plan-badge.past_due {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .plan-badge.expired {
      background: rgba(107, 114, 128, 0.2);
      color: #6b7280;
    }

    /* Cancellation Notice */
    .cancellation-notice {
      display: flex;
      gap: 12px;
      padding: 16px;
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 10px;
      margin-bottom: 20px;
    }

    .notice-icon {
      font-size: 1.5rem;
    }

    .cancellation-notice strong {
      color: #ef4444;
      display: block;
      margin-bottom: 4px;
    }

    .cancellation-notice p {
      color: #d1d5db;
      margin: 0;
      font-size: 0.9rem;
    }

    /* Plan Details */
    .plan-details {
      margin-bottom: 20px;
    }

    .detail-row {
      display: flex;
      justify-content: space-between;
      padding: 10px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    }

    .detail-row:last-child {
      border-bottom: none;
    }

    .detail-row .label {
      color: #9ca3af;
    }

    .detail-row .value {
      color: #f3f4f6;
      font-weight: 500;
    }

    /* Plan Features */
    .plan-features {
      margin-bottom: 24px;
    }

    .plan-features h4 {
      color: #f3f4f6;
      font-size: 0.95rem;
      margin: 0 0 12px 0;
    }

    .plan-features ul {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 8px;
    }

    .plan-features li {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #d1d5db;
      font-size: 0.9rem;
    }

    .plan-features .check {
      color: #22c55e;
    }

    /* Plan Actions */
    .plan-actions {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }

    .btn-upgrade,
    .btn-change,
    .btn-reactivate {
      padding: 12px 24px;
      border: none;
      border-radius: 8px;
      font-size: 0.95rem;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-upgrade {
      background: #3b82f6;
      color: white;
    }

    .btn-upgrade:hover {
      background: #2563eb;
    }

    .btn-change {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }

    .btn-change:hover {
      background: rgba(59, 130, 246, 0.2);
    }

    .btn-reactivate {
      background: #22c55e;
      color: white;
    }

    .btn-reactivate:hover {
      background: #16a34a;
    }

    .btn-cancel {
      padding: 12px 24px;
      background: none;
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 8px;
      color: #ef4444;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-cancel:hover {
      background: rgba(239, 68, 68, 0.1);
    }

    /* Usage Card */
    .usage-card {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 24px;
    }

    .usage-card h3 {
      color: #f3f4f6;
      font-size: 1.1rem;
      margin: 0 0 20px 0;
    }

    .usage-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 20px;
    }

    .usage-item {
      text-align: center;
    }

    .usage-value {
      display: block;
      font-size: 2rem;
      font-weight: 700;
      color: #3b82f6;
      margin-bottom: 4px;
    }

    .usage-label {
      color: #9ca3af;
      font-size: 0.85rem;
    }

    /* Invoices List */
    .invoices-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .invoice-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
    }

    .invoice-info {
      flex: 1;
    }

    .invoice-desc {
      display: block;
      color: #f3f4f6;
      font-weight: 500;
    }

    .invoice-date {
      display: block;
      color: #6b7280;
      font-size: 0.85rem;
    }

    .invoice-amount {
      color: #f3f4f6;
      font-weight: 600;
      min-width: 100px;
      text-align: right;
    }

    .invoice-status {
      padding: 4px 12px;
      border-radius: 20px;
      font-size: 0.8rem;
      min-width: 80px;
      text-align: center;
    }

    .invoice-status.paid {
      background: rgba(34, 197, 94, 0.2);
      color: #22c55e;
    }

    .invoice-status.pending {
      background: rgba(245, 158, 11, 0.2);
      color: #f59e0b;
    }

    .invoice-status.failed {
      background: rgba(239, 68, 68, 0.2);
      color: #ef4444;
    }

    .btn-download {
      padding: 8px 16px;
      background: #374151;
      border: none;
      border-radius: 6px;
      color: #f3f4f6;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .btn-download:hover {
      background: #4b5563;
    }

    /* Payment Methods */
    .methods-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
    }

    .method-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
    }

    .method-item.default {
      border-color: rgba(59, 130, 246, 0.3);
    }

    .method-icon img {
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

    .method-detail {
      display: block;
      color: #6b7280;
      font-size: 0.85rem;
    }

    .method-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .default-badge {
      padding: 4px 12px;
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      border-radius: 20px;
      font-size: 0.8rem;
    }

    .btn-set-default,
    .btn-remove {
      padding: 6px 12px;
      background: none;
      border: none;
      color: #9ca3af;
      font-size: 0.85rem;
      cursor: pointer;
    }

    .btn-set-default:hover {
      color: #3b82f6;
    }

    .btn-remove:hover {
      color: #ef4444;
    }

    .btn-add-method {
      width: 100%;
      padding: 14px;
      background: rgba(255, 255, 255, 0.03);
      border: 2px dashed rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      color: #9ca3af;
      font-size: 0.95rem;
      cursor: pointer;
      transition: all 0.2s;
    }

    .btn-add-method:hover {
      border-color: #3b82f6;
      color: #3b82f6;
    }

    /* Empty State */
    .empty-state {
      text-align: center;
      padding: 64px 20px;
    }

    .empty-icon {
      font-size: 3rem;
      display: block;
      margin-bottom: 16px;
    }

    .empty-state p {
      color: #6b7280;
    }

    /* Modal */
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 20px;
    }

    .modal-content {
      background: #1f2937;
      border-radius: 16px;
      padding: 32px;
      max-width: 420px;
      width: 100%;
    }

    .modal-content h3 {
      color: #f3f4f6;
      margin: 0 0 16px 0;
    }

    .modal-content p {
      color: #d1d5db;
      margin: 0 0 12px 0;
    }

    .modal-content .warning {
      color: #f59e0b;
      font-size: 0.9rem;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
      margin-top: 24px;
    }

    .btn-keep {
      flex: 1;
      padding: 12px;
      background: #3b82f6;
      border: none;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-keep:hover {
      background: #2563eb;
    }

    .btn-confirm-cancel {
      flex: 1;
      padding: 12px;
      background: none;
      border: 1px solid rgba(239, 68, 68, 0.5);
      border-radius: 8px;
      color: #ef4444;
      font-weight: 500;
      cursor: pointer;
    }

    .btn-confirm-cancel:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.1);
    }

    .btn-confirm-cancel:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* Responsive */
    @media (max-width: 768px) {
      .tabs {
        overflow-x: auto;
        padding-bottom: 12px;
      }

      .tab {
        white-space: nowrap;
      }

      .usage-grid {
        grid-template-columns: 1fr;
      }

      .invoice-item {
        flex-wrap: wrap;
      }

      .invoice-amount {
        order: 3;
        width: 100%;
        text-align: left;
        margin-top: 8px;
      }

      .method-item {
        flex-wrap: wrap;
      }

      .method-actions {
        width: 100%;
        margin-top: 12px;
      }
    }
  `]
})
export class MySubscriptionComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private http = inject(HttpClient);
  private destroy$ = new Subject<void>();

  // State
  activeTab = signal<TabType>('overview');
  loading = signal(true);
  subscription = signal<Subscription | null>(null);
  invoices = signal<Invoice[]>([]);
  paymentMethods = signal<PaymentMethod[]>([]);
  showCancelModal = signal(false);
  cancelling = signal(false);

  // Usage stats
  usageStats = signal({
    searches: 0,
    exports: 0,
    alerts: 0
  });

  ngOnInit(): void {
    this.loadSubscription();
    this.loadInvoices();
    this.loadPaymentMethods();
    this.loadUsageStats();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private loadSubscription(): void {
    this.http.get<Subscription>(
      `${environment.apiUrl}/api/subscriptions/current`
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => of(null))
    ).subscribe(sub => {
      this.subscription.set(sub);
      this.loading.set(false);
    });
  }

  private loadInvoices(): void {
    this.http.get<{ invoices: Invoice[] }>(
      `${environment.apiUrl}/api/subscriptions/invoices`
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ invoices: [] }))
    ).subscribe(response => {
      this.invoices.set(response.invoices);
    });
  }

  private loadPaymentMethods(): void {
    this.http.get<{ methods: PaymentMethod[] }>(
      `${environment.apiUrl}/api/payments/methods`
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ methods: [] }))
    ).subscribe(response => {
      this.paymentMethods.set(response.methods);
    });
  }

  private loadUsageStats(): void {
    this.http.get<{ searches: number; exports: number; alerts: number }>(
      `${environment.apiUrl}/api/usage/stats`
    ).pipe(
      takeUntil(this.destroy$),
      catchError(() => of({ searches: 0, exports: 0, alerts: 0 }))
    ).subscribe(stats => {
      this.usageStats.set(stats);
    });
  }

  setTab(tab: TabType): void {
    this.activeTab.set(tab);
  }

  getStatusLabel(status?: string): string {
    const labels: Record<string, string> = {
      'active': 'Đang hoạt động',
      'cancelled': 'Đã hủy',
      'expired': 'Hết hạn',
      'past_due': 'Quá hạn thanh toán'
    };
    return labels[status || ''] || 'Không xác định';
  }

  getInvoiceStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      'paid': 'Đã thanh toán',
      'pending': 'Chờ thanh toán',
      'failed': 'Thất bại'
    };
    return labels[status] || status;
  }

  getPaymentIcon(type: string): string {
    const icons: Record<string, string> = {
      'vnpay': '/assets/payment/vnpay.svg',
      'momo': '/assets/payment/momo.svg',
      'card': '/assets/payment/visa.svg'
    };
    return icons[type] || '/assets/payment/default.svg';
  }

  getPaymentMethodName(method: PaymentMethod): string {
    if (method.type === 'card') {
      return `${method.brand || 'Card'}`;
    }
    const names: Record<string, string> = {
      'vnpay': 'VNPay',
      'momo': 'MoMo'
    };
    return names[method.type] || method.type;
  }

  goToPricing(): void {
    this.router.navigate(['/pricing']);
  }

  reactivateSubscription(): void {
    this.http.post(
      `${environment.apiUrl}/api/subscriptions/reactivate`,
      {}
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadSubscription();
    });
  }

  cancelSubscription(): void {
    this.cancelling.set(true);
    
    this.http.post(
      `${environment.apiUrl}/api/subscriptions/cancel`,
      {}
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe({
      next: () => {
        this.loadSubscription();
        this.showCancelModal.set(false);
        this.cancelling.set(false);
      },
      error: () => {
        this.cancelling.set(false);
      }
    });
  }

  downloadInvoice(invoice: Invoice): void {
    if (invoice.invoiceUrl) {
      window.open(invoice.invoiceUrl, '_blank');
    }
  }

  setDefaultPaymentMethod(method: PaymentMethod): void {
    this.http.post(
      `${environment.apiUrl}/api/payments/methods/${method.id}/default`,
      {}
    ).pipe(
      takeUntil(this.destroy$)
    ).subscribe(() => {
      this.loadPaymentMethods();
    });
  }

  removePaymentMethod(method: PaymentMethod): void {
    if (confirm('Bạn có chắc muốn xóa phương thức thanh toán này?')) {
      this.http.delete(
        `${environment.apiUrl}/api/payments/methods/${method.id}`
      ).pipe(
        takeUntil(this.destroy$)
      ).subscribe(() => {
        this.loadPaymentMethods();
      });
    }
  }

  addPaymentMethod(): void {
    this.router.navigate(['/settings/payment-methods/add']);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0
    }).format(price);
  }

  formatDate(dateStr?: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
}
