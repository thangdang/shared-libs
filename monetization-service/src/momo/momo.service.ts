/**
 * MoMo Payment Service - Nov 2026 Release
 * 
 * Backend service for MoMo wallet payment integration.
 * Reference:  https://developers.momo.vn/v3/vi/docs/payment/api
 * 
 * @author Solo Dev
 * @release Nov 2026
 */

import crypto from 'crypto';
import type { 
  MoMoPaymentRequest, 
  MoMoPaymentResponse, 
  MoMoIPNCallback 
} from '../types';

// ═══════════════════════════════════════════════════════════════
//  MOMO CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export interface MoMoConfig {
  /** Partner code from MoMo */
  partnerCode: string;
  
  /** Access key */
  accessKey: string;
  
  /** Secret key (for signature) */
  secretKey: string;
  
  /** API endpoint */
  endpoint: string;
  
  /** IPN callback URL */
  ipnUrl: string;
  
  /** Redirect URL after payment */
  redirectUrl: string;
  
  /** Enable test mode */
  testMode?: boolean;
}

// ═══════════════════════════════════════════════════════════════
//  MOMO PAYMENT SERVICE
// ═══════════════════════════════════════════════════════════════

export class MoMoPaymentService {
  private readonly config: MoMoConfig;
  
  constructor(config: MoMoConfig) {
    this.config = config;
  }

  // ─────────────────────────────────────────────────────────────
  //  CREATE PAYMENT
  // ─────────────────────────────────────────────────────────────

  /**
   * Create a MoMo payment request
   */
  async createPayment(request: MoMoPaymentRequest): Promise<MoMoPaymentResponse> {
    const requestId = this.generateRequestId();
    const rawSignature = this.buildRawSignature({
      accessKey: this.config.accessKey,
      amount: request.amount,
      extraData: request.extraData || '',
      ipnUrl: this.config.ipnUrl,
      orderId: request.orderId,
      orderInfo: request.orderInfo,
      partnerCode: this.config.partnerCode,
      redirectUrl: this.config.redirectUrl,
      requestId,
      requestType: request.requestType,
    });
    
    const signature = this.signHmacSHA256(rawSignature, this.config.secretKey);
    
    const body = {
      partnerCode: this.config.partnerCode,
      accessKey: this.config.accessKey,
      requestId,
      amount: request.amount,
      orderId: request.orderId,
      orderInfo: request.orderInfo,
      redirectUrl: this.config.redirectUrl,
      ipnUrl: this.config.ipnUrl,
      extraData: request.extraData || '',
      requestType: request.requestType,
      signature,
      lang: 'vi',
    };
    
    const response = await fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    
    if (!response.ok) {
      throw new Error(`MoMo API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data as MoMoPaymentResponse;
  }

  /**
   * Create payment for premium subscription
   */
  async createPremiumPayment(
    userId: string,
    app: string,
    amount: number = 99000
  ): Promise<MoMoPaymentResponse> {
    const orderId = `${app}_premium_${userId}_${Date.now()}`;
    const extraData = Buffer.from(JSON.stringify({
      userId,
      app,
      type: 'premium_subscription',
    })).toString('base64');
    
    return this.createPayment({
      orderId,
      amount,
      orderInfo: `Đăng ký Premium ${app.toUpperCase()}`,
      extraData,
      requestType: 'captureWallet',
    });
  }

  // ─────────────────────────────────────────────────────────────
  //  VERIFY IPN (Instant Payment Notification)
  // ─────────────────────────────────────────────────────────────

  /**
   * Verify IPN callback signature
   */
  verifyIPNSignature(callback: MoMoIPNCallback): boolean {
    const rawSignature = this.buildIPNRawSignature(callback);
    const expectedSignature = this.signHmacSHA256(rawSignature, this.config.secretKey);
    
    return callback.signature === expectedSignature;
  }

  /**
   * Process IPN callback
   */
  processIPNCallback(callback: MoMoIPNCallback): {
    success: boolean;
    orderId: string;
    transactionId: number;
    extraData: Record<string, unknown> | null;
    error?: string;
  } {
    // Verify signature
    if (!this.verifyIPNSignature(callback)) {
      return {
        success: false,
        orderId: callback.orderId,
        transactionId: callback.transId,
        extraData: null,
        error: 'Invalid signature',
      };
    }
    
    // Check result code
    if (callback.resultCode !== 0) {
      return {
        success: false,
        orderId: callback.orderId,
        transactionId: callback.transId,
        extraData: null,
        error: callback.message || `Payment failed with code ${callback.resultCode}`,
      };
    }
    
    // Parse extra data
    let extraData: Record<string, unknown> | null = null;
    if (callback.extraData) {
      try {
        extraData = JSON.parse(Buffer.from(callback.extraData, 'base64').toString());
      } catch {
        // Ignore parse error
      }
    }
    
    return {
      success: true,
      orderId: callback.orderId,
      transactionId: callback.transId,
      extraData,
    };
  }

  // ─────────────────────────────────────────────────────────────
  //  QUERY PAYMENT STATUS
  // ─────────────────────────────────────────────────────────────

  /**
   * Query payment status by order ID
   */
  async queryPaymentStatus(orderId: string): Promise<{
    resultCode: number;
    message: string;
    transId?: number;
    amount?: number;
  }> {
    const requestId = this.generateRequestId();
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `orderId=${orderId}`,
      `partnerCode=${this.config.partnerCode}`,
      `requestId=${requestId}`,
    ].join('&');
    
    const signature = this.signHmacSHA256(rawSignature, this.config.secretKey);
    
    const queryEndpoint = this.config.endpoint.replace('/create', '/query');
    
    const response = await fetch(queryEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        partnerCode: this.config.partnerCode,
        accessKey: this.config.accessKey,
        requestId,
        orderId,
        signature,
        lang: 'vi',
      }),
    });
    
    if (!response.ok) {
      throw new Error(`MoMo API error: ${response.status}`);
    }
    
    return response.json();
  }

  // ─────────────────────────────────────────────────────────────
  //  HELPERS
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.partnerCode}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Build raw signature string for payment creation
   */
  private buildRawSignature(params: {
    accessKey: string;
    amount: number;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    partnerCode: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
  }): string {
    return [
      `accessKey=${params.accessKey}`,
      `amount=${params.amount}`,
      `extraData=${params.extraData}`,
      `ipnUrl=${params.ipnUrl}`,
      `orderId=${params.orderId}`,
      `orderInfo=${params.orderInfo}`,
      `partnerCode=${params.partnerCode}`,
      `redirectUrl=${params.redirectUrl}`,
      `requestId=${params.requestId}`,
      `requestType=${params.requestType}`,
    ].join('&');
  }

  /**
   * Build raw signature string for IPN verification
   */
  private buildIPNRawSignature(callback: MoMoIPNCallback): string {
    return [
      `accessKey=${this.config.accessKey}`,
      `amount=${callback.amount}`,
      `extraData=${callback.extraData}`,
      `message=${callback.message}`,
      `orderId=${callback.orderId}`,
      `orderInfo=${callback.orderInfo}`,
      `orderType=${callback.orderType}`,
      `partnerCode=${callback.partnerCode}`,
      `payType=${callback.payType}`,
      `requestId=${callback.requestId}`,
      `responseTime=${callback.responseTime}`,
      `resultCode=${callback.resultCode}`,
      `transId=${callback.transId}`,
    ].join('&');
  }

  /**
   * Sign with HMAC-SHA256
   */
  private signHmacSHA256(data: string, secretKey: string): string {
    return crypto
      .createHmac('sha256', secretKey)
      .update(data)
      .digest('hex');
  }
}
