/**
 * MON-002:  VNPay Integration Service
 * Payment gateway integration for VNPay
 */

import * as crypto from 'crypto';
import * as qs from 'querystring';

export interface VNPayConfig {
  tmnCode: string;
  hashSecret: string;
  vnpUrl: string;
  returnUrl: string;
  apiUrl?: string;
}

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  orderDescription: string;
  orderType?: string;
  bankCode?: string;
  locale?: 'vn' | 'en';
  ipAddress: string;
  userId?: string;
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  amount: number;
  bankCode?: string;
  bankTransNo?: string;
  cardType?: string;
  payDate?: string;
  transactionNo?: string;
  responseCode: string;
  message: string;
  secureHash: string;
  isValidSignature: boolean;
}

export interface RefundRequest {
  transactionNo: string;
  orderId: string;
  amount: number;
  transactionDate: string;
  user: string;
  reason?: string;
}

export class VNPayService {
  private config: VNPayConfig;

  constructor(config: VNPayConfig) {
    this.config = {
      ...config,
      vnpUrl: config.vnpUrl || 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
      apiUrl: config.apiUrl || 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
    };
  }

  /**
   * Create payment URL for redirect
   */
  createPaymentUrl(request: CreatePaymentRequest): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 minutes

    const vnpParams: Record<string, string | number> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Locale: request.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: request.orderId,
      vnp_OrderInfo: request.orderDescription,
      vnp_OrderType: request.orderType || 'other',
      vnp_Amount: request.amount * 100, // VNPay uses smallest currency unit
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: request.ipAddress,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    if (request.bankCode) {
      vnpParams.vnp_BankCode = request.bankCode;
    }

    // Sort params alphabetically
    const sortedParams = this.sortObject(vnpParams);
    
    // Create signature
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Add signature to params
    sortedParams.vnp_SecureHash = signed;

    return `${this.config.vnpUrl}?${qs.stringify(sortedParams, { encode: false })}`;
  }

  /**
   * Verify return URL callback
   */
  verifyReturnUrl(query: Record<string, string>): PaymentResult {
    const secureHash = query.vnp_SecureHash;
    const secureHashType = query.vnp_SecureHashType;

    // Remove hash fields before verification
    const verifyParams = { ...query };
    delete verifyParams.vnp_SecureHash;
    delete verifyParams.vnp_SecureHashType;

    // Sort and create signature
    const sortedParams = this.sortObject(verifyParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const checksum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValidSignature = secureHash === checksum;
    const responseCode = query.vnp_ResponseCode || '';

    return {
      success: isValidSignature && responseCode === '00',
      orderId: query.vnp_TxnRef || '',
      amount: parseInt(query.vnp_Amount || '0') / 100,
      bankCode: query.vnp_BankCode,
      bankTransNo: query.vnp_BankTranNo,
      cardType: query.vnp_CardType,
      payDate: query.vnp_PayDate,
      transactionNo: query.vnp_TransactionNo,
      responseCode,
      message: this.getResponseMessage(responseCode),
      secureHash,
      isValidSignature
    };
  }

  /**
   * Verify IPN (Instant Payment Notification)
   */
  verifyIPN(body: Record<string, string>): {
    isValid: boolean;
    orderId: string;
    amount: number;
    responseCode: string;
    rspCode: string;
    message: string;
  } {
    const secureHash = body.vnp_SecureHash;

    // Remove hash fields
    const verifyParams = { ...body };
    delete verifyParams.vnp_SecureHash;
    delete verifyParams.vnp_SecureHashType;

    const sortedParams = this.sortObject(verifyParams);
    const signData = qs.stringify(sortedParams, { encode: false });
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const checksum = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    const isValid = secureHash === checksum;
    const responseCode = body.vnp_ResponseCode || '';

    // Response codes for IPN
    let rspCode = '99'; // Unknown error
    if (!isValid) {
      rspCode = '97'; // Invalid signature
    } else if (responseCode === '00') {
      rspCode = '00'; // Success
    } else {
      rspCode = '02'; // Order not found or already processed
    }

    return {
      isValid,
      orderId: body.vnp_TxnRef || '',
      amount: parseInt(body.vnp_Amount || '0') / 100,
      responseCode,
      rspCode,
      message: this.getResponseMessage(responseCode)
    };
  }

  /**
   * Query transaction status
   */
  async queryTransaction(orderId: string, transactionDate: string): Promise<any> {
    const requestId = this.generateRequestId();
    const date = new Date();
    const createDate = this.formatDate(date);

    const data: Record<string, string> = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'querydr',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: `Query transaction ${orderId}`,
      vnp_TransactionDate: transactionDate,
      vnp_CreateDate: createDate,
      vnp_IpAddr: '127.0.0.1'
    };

    // Create signature
    const signData = `${data.vnp_RequestId}|${data.vnp_Version}|${data.vnp_Command}|${data.vnp_TmnCode}|${data.vnp_TxnRef}|${data.vnp_TransactionDate}|${data.vnp_CreateDate}|${data.vnp_IpAddr}|${data.vnp_OrderInfo}`;
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    data.vnp_SecureHash = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Make API request (implementation depends on your HTTP client)
    // This is a placeholder - actual implementation would use axios/fetch
    console.log('[VNPay] Query transaction request:', data);
    
    return {
      requestId,
      orderId,
      transactionDate,
      status: 'pending'
    };
  }

  /**
   * Request refund
   */
  async refund(request: RefundRequest): Promise<any> {
    const requestId = this.generateRequestId();
    const date = new Date();
    const createDate = this.formatDate(date);

    const data: Record<string, string | number> = {
      vnp_RequestId: requestId,
      vnp_Version: '2.1.0',
      vnp_Command: 'refund',
      vnp_TmnCode: this.config.tmnCode,
      vnp_TransactionType: '02', // Full refund
      vnp_TxnRef: request.orderId,
      vnp_Amount: request.amount * 100,
      vnp_OrderInfo: request.reason || `Refund for order ${request.orderId}`,
      vnp_TransactionNo: request.transactionNo,
      vnp_TransactionDate: request.transactionDate,
      vnp_CreateBy: request.user,
      vnp_CreateDate: createDate,
      vnp_IpAddr: '127.0.0.1'
    };

    console.log('[VNPay] Refund request:', data);

    return {
      requestId,
      orderId: request.orderId,
      status: 'pending'
    };
  }

  /**
   * Format date for VNPay (yyyyMMddHHmmss)
   */
  private formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    
    return [
      date.getFullYear(),
      pad(date.getMonth() + 1),
      pad(date.getDate()),
      pad(date.getHours()),
      pad(date.getMinutes()),
      pad(date.getSeconds())
    ].join('');
  }

  /**
   * Sort object keys alphabetically
   */
  private sortObject(obj: Record<string, any>): Record<string, any> {
    const sorted: Record<string, any> = {};
    const keys = Object.keys(obj).sort();
    
    for (const key of keys) {
      if (obj[key] !== '' && obj[key] !== undefined && obj[key] !== null) {
        sorted[key] = obj[key];
      }
    }
    
    return sorted;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Get response message for code
   */
  private getResponseMessage(code: string): string {
    const messages: Record<string, string> = {
      '00': 'Giao dịch thành công',
      '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường).',
      '09': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking tại ngân hàng.',
      '10': 'Giao dịch không thành công do: Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
      '11': 'Giao dịch không thành công do: Đã hết hạn chờ thanh toán. Xin quý khách vui lòng thực hiện lại giao dịch.',
      '12': 'Giao dịch không thành công do: Thẻ/Tài khoản của khách hàng bị khóa.',
      '13': 'Giao dịch không thành công do Quý khách nhập sai mật khẩu xác thực giao dịch (OTP).',
      '24': 'Giao dịch không thành công do: Khách hàng hủy giao dịch',
      '51': 'Giao dịch không thành công do: Tài khoản của quý khách không đủ số dư để thực hiện giao dịch.',
      '65': 'Giao dịch không thành công do: Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày.',
      '75': 'Ngân hàng thanh toán đang bảo trì.',
      '79': 'Giao dịch không thành công do: KH nhập sai mật khẩu thanh toán quá số lần quy định.',
      '99': 'Các lỗi khác'
    };

    return messages[code] || messages['99'];
  }
}

export default VNPayService;
