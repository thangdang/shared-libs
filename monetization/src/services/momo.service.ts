/**
 * MON-003:  MoMo Integration Service
 * Payment gateway integration for MoMo
 */

import * as crypto from 'crypto';
import axios from 'axios';

export interface MoMoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  endpoint: string;
  ipnUrl: string;
  redirectUrl: string;
}

export interface CreatePaymentRequest {
  orderId: string;
  amount: number;
  orderInfo: string;
  extraData?: string;
  requestType?: 'captureWallet' | 'payWithATM' | 'payWithCC';
  userId?: string;
}

export interface PaymentResponse {
  partnerCode: string;
  orderId: string;
  requestId: string;
  amount: number;
  responseTime: number;
  message: string;
  resultCode: number;
  payUrl?: string;
  deeplink?: string;
  qrCodeUrl?: string;
}

export interface PaymentCallbackData {
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

export interface RefundRequest {
  orderId: string;
  transId: number;
  amount: number;
  description?: string;
}

export class MoMoService {
  private config: MoMoConfig;
  private httpClient: axios.AxiosInstance;

  constructor(config: MoMoConfig) {
    this.config = {
      ...config,
      endpoint: config.endpoint || 'https://test-payment.momo.vn/v2/gateway/api'
    };

    this.httpClient = axios.create({
      baseURL: this.config.endpoint,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Create payment request
   */
  async createPayment(request: CreatePaymentRequest): Promise<PaymentResponse> {
    const requestId = this.generateRequestId();
    const requestType = request.requestType || 'captureWallet';
    const extraData = request.extraData || '';

    // Create raw signature
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${request.amount}`,
      `extraData=${extraData}`,
      `ipnUrl=${this.config.ipnUrl}`,
      `orderId=${request.orderId}`,
      `orderInfo=${request.orderInfo}`,
      `partnerCode=${this.config.partnerCode}`,
      `redirectUrl=${this.config.redirectUrl}`,
      `requestId=${requestId}`,
      `requestType=${requestType}`
    ].join('&');

    const signature = this.createSignature(rawSignature);

    const body = {
      partnerCode: this.config.partnerCode,
      partnerName: 'App Nov 2026',
      storeId: this.config.partnerCode,
      requestId,
      amount: request.amount,
      orderId: request.orderId,
      orderInfo: request.orderInfo,
      redirectUrl: this.config.redirectUrl,
      ipnUrl: this.config.ipnUrl,
      lang: 'vi',
      extraData,
      requestType,
      signature
    };

    try {
      const response = await this.httpClient.post('/create', body);
      
      return {
        partnerCode: response.data.partnerCode,
        orderId: response.data.orderId,
        requestId: response.data.requestId,
        amount: response.data.amount,
        responseTime: response.data.responseTime,
        message: response.data.message,
        resultCode: response.data.resultCode,
        payUrl: response.data.payUrl,
        deeplink: response.data.deeplink,
        qrCodeUrl: response.data.qrCodeUrl
      };
    } catch (error: any) {
      console.error('[MoMo] Create payment error:', error.response?.data || error.message);
      throw new Error(`MoMo payment creation failed: ${error.message}`);
    }
  }

  /**
   * Verify IPN callback
   */
  verifyCallback(data: PaymentCallbackData): {
    isValid: boolean;
    orderId: string;
    amount: number;
    transId: number;
    resultCode: number;
    message: string;
  } {
    // Create raw signature for verification
    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${data.amount}`,
      `extraData=${data.extraData}`,
      `message=${data.message}`,
      `orderId=${data.orderId}`,
      `orderInfo=${data.orderInfo}`,
      `orderType=${data.orderType}`,
      `partnerCode=${data.partnerCode}`,
      `payType=${data.payType}`,
      `requestId=${data.requestId}`,
      `responseTime=${data.responseTime}`,
      `resultCode=${data.resultCode}`,
      `transId=${data.transId}`
    ].join('&');

    const expectedSignature = this.createSignature(rawSignature);
    const isValid = data.signature === expectedSignature;

    return {
      isValid,
      orderId: data.orderId,
      amount: data.amount,
      transId: data.transId,
      resultCode: data.resultCode,
      message: data.message
    };
  }

  /**
   * Query transaction status
   */
  async queryTransaction(orderId: string, requestId?: string): Promise<any> {
    const reqId = requestId || this.generateRequestId();

    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `orderId=${orderId}`,
      `partnerCode=${this.config.partnerCode}`,
      `requestId=${reqId}`
    ].join('&');

    const signature = this.createSignature(rawSignature);

    const body = {
      partnerCode: this.config.partnerCode,
      requestId: reqId,
      orderId,
      lang: 'vi',
      signature
    };

    try {
      const response = await this.httpClient.post('/query', body);
      return response.data;
    } catch (error: any) {
      console.error('[MoMo] Query transaction error:', error.response?.data || error.message);
      throw new Error(`MoMo query failed: ${error.message}`);
    }
  }

  /**
   * Request refund
   */
  async refund(request: RefundRequest): Promise<any> {
    const requestId = this.generateRequestId();

    const rawSignature = [
      `accessKey=${this.config.accessKey}`,
      `amount=${request.amount}`,
      `description=${request.description || ''}`,
      `orderId=${request.orderId}`,
      `partnerCode=${this.config.partnerCode}`,
      `requestId=${requestId}`,
      `transId=${request.transId}`
    ].join('&');

    const signature = this.createSignature(rawSignature);

    const body = {
      partnerCode: this.config.partnerCode,
      orderId: request.orderId,
      requestId,
      amount: request.amount,
      transId: request.transId,
      lang: 'vi',
      description: request.description || `Refund for order ${request.orderId}`,
      signature
    };

    try {
      const response = await this.httpClient.post('/refund', body);
      return response.data;
    } catch (error: any) {
      console.error('[MoMo] Refund error:', error.response?.data || error.message);
      throw new Error(`MoMo refund failed: ${error.message}`);
    }
  }

  /**
   * Create HMAC SHA256 signature
   */
  private createSignature(data: string): string {
    return crypto
      .createHmac('sha256', this.config.secretKey)
      .update(data)
      .digest('hex');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${this.config.partnerCode}_${Date.now()}`;
  }

  /**
   * Get result code message
   */
  static getResultMessage(code: number): string {
    const messages: Record<number, string> = {
      0: 'Thành công',
      9000: 'Giao dịch được xác nhận thành công',
      8000: 'Giao dịch đang được xử lý',
      7000: 'Giao dịch đang được xử lý bởi MoMo',
      1000: 'Giao dịch đã được khởi tạo, chờ người dùng xác nhận thanh toán',
      11: 'Truy cập bị từ chối',
      12: 'Phiên bản API không được hỗ trợ',
      13: 'Xác thực doanh nghiệp không thành công',
      20: 'Yêu cầu sai định dạng',
      21: 'Số tiền giao dịch không hợp lệ',
      22: 'Số tiền giao dịch vượt quá hạn mức',
      40: 'RequestId bị trùng',
      41: 'OrderId bị trùng',
      42: 'OrderId không hợp lệ hoặc không tìm thấy',
      43: 'Giao dịch đã bị huỷ',
      45: 'OrderId đang được xử lý',
      1001: 'Người dùng không đồng ý thanh toán',
      1002: 'Giao dịch đã bị từ chối bởi nhà phát hành',
      1003: 'Giao dịch bị huỷ do quá thời gian chờ',
      1004: 'Giao dịch bị huỷ bởi người dùng',
      1005: 'Số dư không đủ',
      1006: 'Người dùng đã huỷ giao dịch sau khi nhập thông tin',
      1007: 'Số tiền giao dịch vượt quá hạn mức',
      1026: 'Hạn mức giao dịch bị giới hạn',
      99: 'Lỗi không xác định'
    };

    return messages[code] || messages[99];
  }
}

export default MoMoService;
