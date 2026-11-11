/**
 * MoMo Webhook Handler
 * MON-004:  Payment webhook handlers
 * 
 * Handles MoMo IPN (Instant Payment Notification) callbacks
 */

import { Request, Response, Router } from 'express';
import crypto from 'crypto';

export interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface MoMoIPNPayload {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  orderInfo: string;
  orderType: string;
  transId: number;
  resultCode: number;
  message: string;
  payType: string;
  responseTime: number;
  extraData: string;
  signature: string;
}

interface PaymentRecord {
  transactionId: string;
  userId: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  paymentMethod: 'momo';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for demo; replace with MongoDB in production
const paymentStore = new Map<string, PaymentRecord>();

export class MoMoWebhookHandler {
  private config: MoMoConfig;
  private onPaymentSuccess?: (payment: PaymentRecord) => Promise<void>;
  private onPaymentFailed?: (payment: PaymentRecord) => Promise<void>;

  constructor(config: MoMoConfig) {
    this.config = config;
  }

  /**
   * Register callback for successful payments
   */
  onSuccess(callback: (payment: PaymentRecord) => Promise<void>): this {
    this.onPaymentSuccess = callback;
    return this;
  }

  /**
   * Register callback for failed payments
   */
  onFailed(callback: (payment: PaymentRecord) => Promise<void>): this {
    this.onPaymentFailed = callback;
    return this;
  }

  /**
   * Verify MoMo signature
   */
  private verifySignature(payload: MoMoIPNPayload): boolean {
    const { signature, ...data } = payload;

    // MoMo signature format:  accessKey + amount + extraData + message + orderId + orderInfo + orderType + partnerCode + payType + requestId + responseTime + resultCode + transId
    const rawSignature = `accessKey=${this.config.accessKey}&amount=${data.amount}&extraData=${data.extraData}&message=${data.message}&orderId=${data.orderId}&orderInfo=${data.orderInfo}&orderType=${data.orderType}&partnerCode=${data.partnerCode}&payType=${data.payType}&requestId=${data.requestId}&responseTime=${data.responseTime}&resultCode=${data.resultCode}&transId=${data.transId}`;

    const computedSignature = crypto
      .createHmac('sha256', this.config.secretKey)
      .update(rawSignature)
      .digest('hex');

    return computedSignature === signature;
  }

  /**
   * Handle MoMo IPN callback (POST)
   */
  async handleIPN(req: Request, res: Response): Promise<void> {
    try {
      const payload = req.body as MoMoIPNPayload;

      console.log('[MoMo Webhook] Received IPN:', JSON.stringify(payload, null, 2));

      // Verify signature
      if (!this.verifySignature(payload)) {
        console.error('[MoMo Webhook] Invalid signature');
        res.status(400).json({ 
          status: 1, 
          message: 'Invalid signature' 
        });
        return;
      }

      const transactionId = payload.orderId;
      const resultCode = payload.resultCode;

      // Get or create payment record
      let payment: PaymentRecord = paymentStore.get(transactionId) || {
        transactionId,
        userId: this.extractUserId(payload.extraData),
        amount: payload.amount,
        status: 'pending',
        paymentMethod: 'momo',
        metadata: {
          momoTransId: payload.transId,
          orderInfo: payload.orderInfo,
          payType: payload.payType,
          requestId: payload.requestId,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Update payment status based on result code
      // MoMo resultCode 0 = success
      if (resultCode === 0) {
        payment.status = 'success';
        payment.updatedAt = new Date();
        paymentStore.set(transactionId, payment);

        // Trigger success callback
        if (this.onPaymentSuccess) {
          await this.onPaymentSuccess(payment);
        }

        console.log('[MoMo Webhook] Payment success:', transactionId);
      } else {
        payment.status = 'failed';
        payment.metadata.errorCode = resultCode;
        payment.metadata.errorMessage = payload.message;
        payment.updatedAt = new Date();
        paymentStore.set(transactionId, payment);

        // Trigger failed callback
        if (this.onPaymentFailed) {
          await this.onPaymentFailed(payment);
        }

        console.log('[MoMo Webhook] Payment failed:', transactionId, resultCode);
      }

      // Response to MoMo
      res.status(204).send();
    } catch (error) {
      console.error('[MoMo Webhook] Error:', error);
      res.status(500).json({ 
        status: 99, 
        message: 'Internal server error' 
      });
    }
  }

  /**
   * Handle return URL (user redirected after payment)
   */
  async handleReturn(req: Request, res: Response): Promise<void> {
    try {
      const { orderId, resultCode, message } = req.query;

      if (resultCode === '0') {
        // Payment successful
        res.redirect(`${this.config.returnUrl}/success?txn=${orderId}`);
      } else {
        // Payment failed
        res.redirect(`${this.config.returnUrl}/failed?txn=${orderId}&code=${resultCode}&message=${encodeURIComponent(String(message || ''))}`);
      }
    } catch (error) {
      console.error('[MoMo Return] Error:', error);
      res.redirect(`${this.config.returnUrl}/error`);
    }
  }

  /**
   * Extract user ID from extra data
   */
  private extractUserId(extraData: string): string {
    try {
      const decoded = Buffer.from(extraData, 'base64').toString('utf-8');
      const data = JSON.parse(decoded);
      return data.userId || 'unknown';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Create Express router for webhook endpoints
   */
  createRouter(): Router {
    const router = Router();

    // MoMo IPN endpoint (server-to-server POST)
    router.post('/ipn', (req, res) => this.handleIPN(req, res));

    // Return URL (user redirect after payment)
    router.get('/return', (req, res) => this.handleReturn(req, res));

    return router;
  }
}

/**
 * MoMo Result Codes
 */
export const MoMoResultCodes = {
  0: 'Giao dịch thành công',
  9000: 'Giao dịch đã được xác nhận thành công',
  8000: 'Giao dịch đang được xử lý',
  7000: 'Giao dịch đang được xử lý bởi nhà cung cấp',
  1000: 'Hệ thống đang bận, thử lại sau',
  1001: 'Giao dịch thất bại do tài khoản không đủ tiền',
  1002: 'Giao dịch bị từ chối do đơn vị thanh toán',
  1003: 'Giao dịch bị huỷ',
  1004: 'Giao dịch thất bại do số tiền vượt quá mức thanh toán',
  1005: 'Giao dịch thất bại do URL hoặc QR code hết hạn',
  1006: 'Giao dịch thất bại do người dùng từ chối xác nhận thanh toán',
  1007: 'Giao dịch bị từ chối do không có quyền thực hiện',
  1017: 'Giao dịch bị chặn bởi hệ thống phòng chống gian lận',
  1026: 'Giao dịch bị huỷ do quá thời gian thanh toán',
  1080: 'Hoàn tiền giao dịch đang được xử lý',
  1081: 'Hoàn tiền giao dịch thành công',
  2001: 'Giao dịch thất bại',
  2007: 'Giao dịch bị từ chối do đơn vị thanh toán',
  3001: 'Đường link thanh toán hết hạn',
  3002: 'Đường link thanh toán không hợp lệ',
  3003: 'Đường link thanh toán đã được sử dụng',
  3004: 'Đường link thanh toán đã bị huỷ',
  4001: 'Giao dịch bị hạn chế',
  4010: 'Quy định OTP không hợp lệ',
  4011: 'OTP không hợp lệ hoặc hết hạn',
  4100: 'Không thể thực hiện hoàn tiền',
  4015: 'Tài khoản MoMo chưa được kích hoạt hoặc bị khoá',
} as const;

export default MoMoWebhookHandler;
