/**
 * VNPay Payment Service
 * Task: SHARED-008
 * 
 * VNPay integration for Premium subscriptions (99K VND/month)
 * Sandbox testing supported
 */

import * as crypto from 'crypto';

export interface VNPayConfig {
  tmnCode: string;           // Terminal code from VNPay
  hashSecret: string;        // Secret key for signing
  vnpUrl: string;            // VNPay payment URL
  returnUrl: string;         // Return URL after payment
  ipnUrl: string;            // IPN callback URL
  apiUrl?: string;           // API URL for queries
}

export interface CreatePaymentParams {
  orderId: string;           // Unique order ID
  amount: number;            // Amount in VND (e.g., 99000)
  orderInfo: string;         // Order description
  orderType?: string;        // Order type code
  locale?: 'vn' | 'en';      // Language
  bankCode?: string;         // Bank code (optional)
  ipAddress: string;         // Customer IP
  userId?: string;           // User ID for tracking
  appId?: string;            // App identifier
}

export interface PaymentResult {
  success: boolean;
  orderId: string;
  transactionNo?: string;
  amount?: number;
  bankCode?: string;
  payDate?: string;
  responseCode: string;
  message: string;
}

export interface IPNData {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo: string;
  vnp_CardType: string;
  vnp_PayDate: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
}

// VNPay response codes
const RESPONSE_CODES: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Trừ tiền thành công. Giao dịch bị nghi ngờ (liên quan tới lừa đảo, giao dịch bất thường)',
  '09': 'Giao dịch không thành công: Thẻ/Tài khoản chưa đăng ký dịch vụ InternetBanking',
  '10': 'Giao dịch không thành công: Xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
  '11': 'Giao dịch không thành công: Đã hết hạn chờ thanh toán',
  '12': 'Giao dịch không thành công: Thẻ/Tài khoản bị khóa',
  '13': 'Giao dịch không thành công: Nhập sai mật khẩu xác thực (OTP)',
  '24': 'Giao dịch không thành công: Khách hàng hủy giao dịch',
  '51': 'Giao dịch không thành công: Tài khoản không đủ số dư',
  '65': 'Giao dịch không thành công: Tài khoản vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'Giao dịch không thành công: Nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Lỗi không xác định'
};

// Sandbox config for testing
const SANDBOX_CONFIG: VNPayConfig = {
  tmnCode: 'DEMO_TMN_CODE',
  hashSecret: 'DEMO_HASH_SECRET',
  vnpUrl: 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html',
  returnUrl: 'http://localhost:4200/payment/return',
  ipnUrl: 'http://localhost:3000/api/payment/ipn',
  apiUrl: 'https://sandbox.vnpayment.vn/merchant_webapi/api/transaction'
};

export class VNPayService {
  private config: VNPayConfig;

  constructor(config?: Partial<VNPayConfig>) {
    // Use sandbox by default, override with env vars or config
    this.config = {
      tmnCode: config?.tmnCode || process.env['VNPAY_TMN_CODE'] || SANDBOX_CONFIG.tmnCode,
      hashSecret: config?.hashSecret || process.env['VNPAY_HASH_SECRET'] || SANDBOX_CONFIG.hashSecret,
      vnpUrl: config?.vnpUrl || process.env['VNPAY_URL'] || SANDBOX_CONFIG.vnpUrl,
      returnUrl: config?.returnUrl || process.env['VNPAY_RETURN_URL'] || SANDBOX_CONFIG.returnUrl,
      ipnUrl: config?.ipnUrl || process.env['VNPAY_IPN_URL'] || SANDBOX_CONFIG.ipnUrl,
      apiUrl: config?.apiUrl || process.env['VNPAY_API_URL'] || SANDBOX_CONFIG.apiUrl
    };
  }

  /**
   * Create payment URL for Premium subscription
   */
  createPaymentUrl(params: CreatePaymentParams): string {
    const date = new Date();
    const createDate = this.formatDate(date);
    const expireDate = this.formatDate(new Date(date.getTime() + 15 * 60 * 1000)); // 15 min expiry

    // VNPay requires amount * 100 (no decimal)
    const amount = params.amount * 100;

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.config.tmnCode,
      vnp_Locale: params.locale || 'vn',
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.orderId,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: params.orderType || 'other',
      vnp_Amount: amount.toString(),
      vnp_ReturnUrl: this.config.returnUrl,
      vnp_IpAddr: params.ipAddress,
      vnp_CreateDate: createDate,
      vnp_ExpireDate: expireDate
    };

    // Optional bank code
    if (params.bankCode) {
      vnpParams['vnp_BankCode'] = params.bankCode;
    }

    // Sort params alphabetically
    const sortedParams = this.sortObject(vnpParams);

    // Create query string
    const signData = new URLSearchParams(sortedParams).toString();

    // Create HMAC SHA512 signature
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Add signature to params
    sortedParams['vnp_SecureHash'] = signed;

    // Build final URL
    const queryString = new URLSearchParams(sortedParams).toString();
    return `${this.config.vnpUrl}?${queryString}`;
  }

  /**
   * Verify return URL parameters
   */
  verifyReturnUrl(query: Record<string, string>): PaymentResult {
    const secureHash = query['vnp_SecureHash'];
    
    // Remove hash fields for verification
    const verifyParams = { ...query };
    delete verifyParams['vnp_SecureHash'];
    delete verifyParams['vnp_SecureHashType'];

    // Sort and sign
    const sortedParams = this.sortObject(verifyParams);
    const signData = new URLSearchParams(sortedParams).toString();
    
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    // Verify signature
    if (secureHash !== signed) {
      return {
        success: false,
        orderId: query['vnp_TxnRef'] || '',
        responseCode: '97',
        message: 'Chữ ký không hợp lệ'
      };
    }

    const responseCode = query['vnp_ResponseCode'] || '99';
    const success = responseCode === '00';

    return {
      success,
      orderId: query['vnp_TxnRef'],
      transactionNo: query['vnp_TransactionNo'],
      amount: parseInt(query['vnp_Amount'] || '0') / 100,
      bankCode: query['vnp_BankCode'],
      payDate: query['vnp_PayDate'],
      responseCode,
      message: RESPONSE_CODES[responseCode] || 'Lỗi không xác định'
    };
  }

  /**
   * Handle IPN callback from VNPay
   */
  handleIPN(data: IPNData): { rspCode: string; message: string } {
    // Verify signature
    const secureHash = data.vnp_SecureHash;
    const verifyData = { ...data } as Record<string, string>;
    delete verifyData['vnp_SecureHash'];
    delete verifyData['vnp_SecureHashType'];

    const sortedParams = this.sortObject(verifyData);
    const signData = new URLSearchParams(sortedParams).toString();
    
    const hmac = crypto.createHmac('sha512', this.config.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash !== signed) {
      return { rspCode: '97', message: 'Invalid Checksum' };
    }

    // Check transaction status
    if (data.vnp_ResponseCode === '00' && data.vnp_TransactionStatus === '00') {
      // Payment successful - update order status in database
      // This should trigger premium subscription activation
      return { rspCode: '00', message: 'Confirm Success' };
    }

    return { rspCode: '00', message: 'Confirm Success' };
  }

  /**
   * Create order ID for Premium subscription
   */
  generateOrderId(userId: string, appId: string): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `${appId.toUpperCase()}_${userId.substring(0, 8)}_${timestamp}${random}`.toUpperCase();
  }

  /**
   * Create Premium subscription payment
   */
  createPremiumPayment(userId: string, appId: string, ipAddress: string): string {
    const orderId = this.generateOrderId(userId, appId);
    
    const appNames: Record<string, string> = {
      trendbrief: 'TrendBrief Premium',
      smartbuy: 'SmartBuy Premium',
      fintax: 'FinTax Premium',
      doctorcar: 'DoctorCar Premium',
      caremate: 'CareMate Premium'
    };

    return this.createPaymentUrl({
      orderId,
      amount: 99000, // 99K VND
      orderInfo: `Nang cap ${appNames[appId] || 'Premium'} - 1 thang`,
      orderType: 'billpayment',
      locale: 'vn',
      ipAddress,
      userId,
      appId
    });
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    const sorted: Record<string, string> = {};
    const keys = Object.keys(obj).sort();
    for (const key of keys) {
      if (obj[key] !== undefined && obj[key] !== null && obj[key] !== '') {
        sorted[key] = obj[key];
      }
    }
    return sorted;
  }
}

// Singleton instance
export const vnpayService = new VNPayService();
