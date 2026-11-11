/**
 * VNPay Payment Service
 * Server-side service for VNPay integration
 */

import crypto from 'crypto';
import {
  VNPayConfig,
  VNPayPaymentRequest,
  VNPayUrlParams,
  VNPayReturnParams,
  VNPayQueryRequest,
  VNPayQueryResponse,
  VNPayRefundRequest,
  VNPayResponseCode,
  VNPAY_RESPONSE_MESSAGES
} from './vnpay.types';

/**
 * Default VNPay URLs
 */
const VNPAY_URLS = {
  sandbox: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  production: 'https://pay.vnpay.vn/vpcpay.html',
  api: {
    sandbox: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction',
    production: 'https://merchant.vnpay.vn/merchant_webapi/api/transaction'
  }
};

/**
 * VNPay payment service
 */
export class VNPayService {
  private config: VNPayConfig;

  constructor(config: VNPayConfig) {
    this.config = {
      locale: 'vn',
      currencyCode: 'VND',
      ...config,
      vnpUrl: config.vnpUrl || VNPAY_URLS[config.environment],
      apiUrl: config.apiUrl || VNPAY_URLS.api[config.environment]
    };
  }

  /**
   * Create payment URL for redirecting customer to VNPay
   */
  createPaymentUrl(request: VNPayPaymentRequest): string {
    const createDate = this.formatDate(new Date());
    
    const params: VNPayUrlParams = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Amount: request.amount * 100, // VNPay requires amount in smallest unit
      vnp_CreateDate: createDate,
      vnp_CurrCode: this.config.currencyCode || 'VND',
      vnp_IpAddr: request.ipAddr,
      vnp_Locale: request.locale || this.config.locale || 'vn',
      vnp_OrderInfo: request.orderInfo,
      vnp_OrderType: request.orderType || 'other',
      vnp_ReturnUrl: request.returnUrl || this.config.returnUrl,
      vnp_TxnRef: request.orderId
    };

    // Add bank code if specified
    if (request.bankCode) {
      params.vnp_BankCode = request.bankCode;
    }

    // Sort parameters alphabetically
    const sortedParams = this.sortObject(params);

    // Create query string and sign
    const signData = new URLSearchParams(
      Object.entries(sortedParams).map(([k, v]) => [k, String(v)])
    ).toString();

    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Build final URL
    return `${this.config.vnpUrl}?${signData}&vnp_SecureHash=${signed}`;
  }

  /**
   * Verify return URL parameters from VNPay
   */
  verifyReturnUrl(params: Record<string, string>): {
    isValid: boolean;
    isSuccess: boolean;
    orderId: string;
    amount: number;
    message: string;
    data: VNPayReturnParams;
  } {
    const vnpParams = params as unknown as VNPayReturnParams;
    const secureHash = vnpParams.vnp_SecureHash;

    // Remove hash from params for verification
    const paramsWithoutHash = { ...params };
    delete paramsWithoutHash.vnp_SecureHash;
    delete paramsWithoutHash.vnp_SecureHashType;

    // Sort and create signature
    const sortedParams = this.sortObject(paramsWithoutHash);
    const signData = new URLSearchParams(sortedParams).toString();

    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const checkSum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash === checkSum;
    const isSuccess = vnpParams.vnp_ResponseCode === VNPayResponseCode.SUCCESS;

    return {
      isValid,
      isSuccess: isValid && isSuccess,
      orderId: vnpParams.vnp_TxnRef,
      amount: parseInt(vnpParams.vnp_Amount) / 100,
      message: VNPAY_RESPONSE_MESSAGES[vnpParams.vnp_ResponseCode] || 'Lỗi không xác định',
      data: vnpParams
    };
  }

  /**
   * Verify IPN (Instant Payment Notification) from VNPay
   */
  verifyIpn(params: Record<string, string>): {
    isValid: boolean;
    rspCode: string;
    message: string;
  } {
    const result = this.verifyReturnUrl(params);

    if (!result.isValid) {
      return {
        isValid: false,
        rspCode: '97',
        message: 'Checksum failed'
      };
    }

    if (result.isSuccess) {
      return {
        isValid: true,
        rspCode: '00',
        message: 'Success'
      };
    }

    return {
      isValid: true,
      rspCode: result.data.vnp_ResponseCode,
      message: result.message
    };
  }

  /**
   * Query transaction status
   */
  async queryTransaction(request: VNPayQueryRequest): Promise<VNPayQueryResponse | null> {
    const requestId = this.generateRequestId();
    const createDate = this.formatDate(new Date());

    const params = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TxnRef: request.orderId,
      vnp_OrderInfo: `Query transaction ${request.orderId}`,
      vnp_TransactionDate: request.transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: request.ipAddr
    };

    const sortedParams = this.sortObject(params);
    const signData = Object.values(sortedParams).join('|');

    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    try {
      const response = await fetch(this.config.apiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...params,
          vnp_SecureHash: secureHash
        })
      });

      return await response.json();
    } catch (error) {
      console.error('VNPay query error:', error);
      return null;
    }
  }

  /**
   * Create refund request (requires VNPay approval)
   */
  async refundTransaction(request: VNPayRefundRequest): Promise<any> {
    const requestId = this.generateRequestId();
    const createDate = this.formatDate(new Date());

    const params = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TransactionType: request.transactionType,
      vnp_TxnRef: request.orderId,
      vnp_Amount: request.amount * 100,
      vnp_OrderInfo: `Refund for order ${request.orderId}`,
      vnp_TransactionNo: request.transactionNo,
      vnp_TransactionDate: request.transactionDate,
      vnp_CreateBy: request.createdBy,
      vnp_CreateDate: createDate,
      vnp_IpAddr: request.ipAddr
    };

    const sortedParams = this.sortObject(params);
    const signData = Object.values(sortedParams).join('|');

    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const secureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    try {
      const response = await fetch(this.config.apiUrl!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...params,
          vnp_SecureHash: secureHash
        })
      });

      return await response.json();
    } catch (error) {
      console.error('VNPay refund error:', error);
      return null;
    }
  }

  /**
   * Get response message for a code
   */
  getResponseMessage(code: string): string {
    return VNPAY_RESPONSE_MESSAGES[code] || 'Lỗi không xác định';
  }

  /**
   * Format date for VNPay (yyyyMMddHHmmss)
   */
  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /**
   * Sort object keys alphabetically
   */
  private sortObject(obj: Record<string, any>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      const value = obj[key];
      if (value !== undefined && value !== null && value !== '') {
        sorted[key] = String(value);
      }
    }
    
    return sorted;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}${Math.random().toString(36).substring(2, 8)}`;
  }
}

/**
 * Create VNPay service with environment-based defaults
 */
export function createVNPayService(config: VNPayConfig): VNPayService {
  return new VNPayService(config);
}
