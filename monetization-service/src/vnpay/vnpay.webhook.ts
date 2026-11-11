/**
 * VNPay Webhook Handler
 * MON-004:  Payment webhook handlers
 * 
 * Handles VNPay IPN (Instant Payment Notification) callbacks
 */

import { Request, Response, Router } from 'express';
import crypto from 'crypto';
import { VNPayConfig, VNPayIPNParams } from './vnpay.types';

interface PaymentRecord {
  transactionId: string;
  userId: string;
  amount: number;
  status: 'pending' | 'success' | 'failed' | 'cancelled';
  paymentMethod: 'vnpay';
  metadata: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

// In-memory store for demo; replace with MongoDB in production
const paymentStore = new Map<string, PaymentRecord>();

export class VNPayWebhookHandler {
  private config: VNPayConfig;
  private onPaymentSuccess?: (payment: PaymentRecord) => Promise<void>;
  private onPaymentFailed?: (payment: PaymentRecord) => Promise<void>;

  constructor(config: VNPayConfig) {
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
   * Verify VNPay signature
   */
  private verifySignature(params: VNPayIPNParams): boolean {
    const vnp_SecureHash = params.vnp_SecureHash;
    delete params.vnp_SecureHash;
    delete params.vnp_SecureHashType;

    // Sort parameters alphabetically
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key as keyof VNPayIPNParams]}`)
      .join('&');

    const hmac = crypto.createHmac('sha512', this.config.secretKey);
    const signed = hmac.update(Buffer.from(sortedParams, 'utf-8')).digest('hex');

    return signed.toUpperCase() === vnp_SecureHash?.toUpperCase();
  }

  /**
   * Handle VNPay IPN callback
   */
  async handleIPN(req: Request, res: Response): Promise<void> {
    try {
      const params = req.query as unknown as VNPayIPNParams;

      // Verify signature
      if (!this.verifySignature({ ...params })) {
        res.status(200).json({ RspCode: '97', Message: 'Invalid signature' });
        return;
      }

      const transactionId = params.vnp_TxnRef;
      const vnpResponseCode = params.vnp_ResponseCode;
      const vnpTransactionNo = params.vnp_TransactionNo;
      const amount = parseInt(params.vnp_Amount || '0') / 100; // VNPay sends amount * 100

      // Get existing payment record
      let payment = paymentStore.get(transactionId);

      if (!payment) {
        // Create new payment record if not exists
        payment = {
          transactionId,
          userId: params.vnp_OrderInfo?.split('|')[0] || 'unknown',
          amount,
          status: 'pending',
          paymentMethod: 'vnpay',
          metadata: {
            vnpTransactionNo,
            bankCode: params.vnp_BankCode,
            cardType: params.vnp_CardType,
            payDate: params.vnp_PayDate,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      // Update payment status based on response code
      if (vnpResponseCode === '00') {
        payment.status = 'success';
        payment.updatedAt = new Date();
        paymentStore.set(transactionId, payment);

        // Trigger success callback
        if (this.onPaymentSuccess) {
          await this.onPaymentSuccess(payment);
        }

        res.status(200).json({ RspCode: '00', Message: 'Success' });
      } else {
        payment.status = 'failed';
        payment.metadata.errorCode = vnpResponseCode;
        payment.updatedAt = new Date();
        paymentStore.set(transactionId, payment);

        // Trigger failed callback
        if (this.onPaymentFailed) {
          await this.onPaymentFailed(payment);
        }

        res.status(200).json({ RspCode: '00', Message: 'Confirmed' });
      }
    } catch (error) {
      console.error('[VNPay Webhook] Error:', error);
      res.status(200).json({ RspCode: '99', Message: 'Unknown error' });
    }
  }

  /**
   * Handle return URL (user redirected after payment)
   */
  async handleReturn(req: Request, res: Response): Promise<void> {
    try {
      const params = req.query as unknown as VNPayIPNParams;

      // Verify signature
      const isValid = this.verifySignature({ ...params });
      const vnpResponseCode = params.vnp_ResponseCode;
      const transactionId = params.vnp_TxnRef;

      if (isValid && vnpResponseCode === '00') {
        // Payment successful - redirect to success page
        const successUrl = `${this.config.returnUrl}/success?txn=${transactionId}`;
        res.redirect(successUrl);
      } else {
        // Payment failed - redirect to failure page
        const failUrl = `${this.config.returnUrl}/failed?txn=${transactionId}&code=${vnpResponseCode}`;
        res.redirect(failUrl);
      }
    } catch (error) {
      console.error('[VNPay Return] Error:', error);
      res.redirect(`${this.config.returnUrl}/error`);
    }
  }

  /**
   * Create Express router for webhook endpoints
   */
  createRouter(): Router {
    const router = Router();

    // VNPay IPN endpoint (server-to-server)
    router.get('/ipn', (req, res) => this.handleIPN(req, res));
    router.post('/ipn', (req, res) => this.handleIPN(req, res));

    // Return URL (user redirect after payment)
    router.get('/return', (req, res) => this.handleReturn(req, res));

    return router;
  }
}

/**
 * VNPay Response Codes
 */
export const VNPayResponseCodes = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
  '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
  '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
  '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
  '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
  '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP). Xin quý khách vui lòng thực hiện lại giao dịch.',
  '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
  '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
  '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
  '75': 'Ngân hàng thanh toán đang bảo trì.',
  '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định. Xin quý khách vui lòng thực hiện lại giao dịch',
  '99': 'Các lỗi khác (lỗi còn lại, không có trong danh sách mã lỗi đã liệt kê)',
} as const;

export default VNPayWebhookHandler;
