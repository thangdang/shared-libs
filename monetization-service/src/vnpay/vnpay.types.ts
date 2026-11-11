/**
 * VNPay Payment Gateway Types
 * Documentation: https://sandbox.vnpayment.vn/apis/
 */

/**
 * VNPay configuration
 */
export interface VNPayConfig {
  tmnCode: string;         // Terminal ID
  hashSecret: string;      // Secret key for signing
  vnpUrl: string;          // VNPay payment URL
  returnUrl: string;       // Return URL after payment
  apiUrl?: string;         // API URL for queries
  locale?: 'vn' | 'en';    // Payment page language
  currencyCode?: string;   // Default: VND
  environment: 'sandbox' | 'production';
}

/**
 * VNPay payment request
 */
export interface VNPayPaymentRequest {
  orderId: string;         // Unique order ID (max 100 chars)
  amount: number;          // Amount in VND (integer)
  orderInfo: string;       // Order description
  orderType?: string;      // Order type code
  bankCode?: string;       // Bank code (optional, for direct bank selection)
  ipAddr: string;          // Customer IP address
  locale?: 'vn' | 'en';
  returnUrl?: string;      // Override default return URL
}

/**
 * VNPay payment URL parameters
 */
export interface VNPayUrlParams {
  vnp_Version: string;
  vnp_Command: string;
  vnp_TmnCode: string;
  vnp_Amount: number;
  vnp_BankCode?: string;
  vnp_CreateDate: string;
  vnp_CurrCode: string;
  vnp_IpAddr: string;
  vnp_Locale: string;
  vnp_OrderInfo: string;
  vnp_OrderType: string;
  vnp_ReturnUrl: string;
  vnp_TxnRef: string;
  vnp_SecureHash?: string;
  vnp_SecureHashType?: string;
}

/**
 * VNPay return/callback parameters
 */
export interface VNPayReturnParams {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHash: string;
  vnp_SecureHashType?: string;
}

/**
 * VNPay response codes
 */
export enum VNPayResponseCode {
  SUCCESS = '00',
  SUSPICIOUS = '07',
  NOT_REGISTERED = '09',
  INVALID_ATTEMPTS = '10',
  EXPIRED = '11',
  LOCKED = '12',
  WRONG_OTP = '13',
  CANCELLED = '24',
  INSUFFICIENT_BALANCE = '51',
  DAILY_LIMIT = '65',
  BANK_MAINTENANCE = '75',
  WRONG_PASSWORD = '79',
  OTHER_ERROR = '99'
}

/**
 * VNPay transaction status
 */
export enum VNPayTransactionStatus {
  SUCCESS = '00',
  PENDING = '01',
  FAILED = '02'
}

/**
 * VNPay bank codes (commonly used in Vietnam)
 */
export enum VNPayBankCode {
  // Domestic cards
  VNPAYQR = 'VNPAYQR',      // VNPay QR
  VNBANK = 'VNBANK',        // Local bank card
  INTCARD = 'INTCARD',      // International card
  
  // Specific banks
  VIETCOMBANK = 'VCB',
  TECHCOMBANK = 'TCB',
  MBBANK = 'MB',
  VPBANK = 'VPB',
  TPBANK = 'TPB',
  VIETINBANK = 'CTG',
  BIDV = 'BIDV',
  AGRIBANK = 'AGRI',
  ACB = 'ACB',
  SCB = 'SCB',
  SACOMBANK = 'STB',
  HDBANK = 'HDB',
  VIETABANK = 'VAB',
  OCEANBANK = 'OJB',
  NCB = 'NCB',
  ABBANK = 'ABB',
  SHB = 'SHB',
  EXIMBANK = 'EXB',
  MSBANK = 'MSB',
  NAMABANK = 'NAB',
  SEABANK = 'SEAB',
  OCBBANK = 'OCB',
  LIENVIETPOSTBANK = 'LPB',
  BAOVIET = 'BVB',
  PVCOMBANK = 'PVC',
  BACABANK = 'BAB',
  VIETCAPITALBANK = 'VCB2',
  KIENLONGBANK = 'KLB',
  PGBANK = 'PGB',
  CBBANK = 'CBB'
}

/**
 * VNPay query request (for checking transaction status)
 */
export interface VNPayQueryRequest {
  orderId: string;
  transactionDate: string;  // Format: yyyyMMddHHmmss
  ipAddr: string;
}

/**
 * VNPay query response
 */
export interface VNPayQueryResponse {
  vnp_ResponseCode: string;
  vnp_Message: string;
  vnp_TmnCode: string;
  vnp_TxnRef: string;
  vnp_Amount: string;
  vnp_OrderInfo: string;
  vnp_BankCode?: string;
  vnp_PayDate?: string;
  vnp_TransactionNo?: string;
  vnp_TransactionType?: string;
  vnp_TransactionStatus?: string;
}

/**
 * VNPay refund request
 */
export interface VNPayRefundRequest {
  orderId: string;
  transactionType: '02' | '03';  // 02: Full refund, 03: Partial refund
  amount: number;
  transactionNo: string;
  transactionDate: string;
  createdBy: string;
  ipAddr: string;
}

/**
 * Response code messages in Vietnamese
 */
export const VNPAY_RESPONSE_MESSAGES: Record<string, string> = {
  '00': 'Giao dịch thành công',
  '07': 'Giao dịch bị nghi ngờ (liên quan đến lừa đảo, giao dịch bất thường)',
  '09': 'Thẻ/Tài khoản của khách hàng chưa đăng ký dịch vụ InternetBanking',
  '10': 'Khách hàng xác thực thông tin thẻ/tài khoản không đúng quá 3 lần',
  '11': 'Đã hết hạn chờ thanh toán. Vui lòng thực hiện lại giao dịch',
  '12': 'Thẻ/Tài khoản của khách hàng bị khóa',
  '13': 'Khách hàng nhập sai mật khẩu xác thực giao dịch (OTP)',
  '24': 'Khách hàng hủy giao dịch',
  '51': 'Tài khoản của quý khách không đủ số dư để thực hiện giao dịch',
  '65': 'Tài khoản của Quý khách đã vượt quá hạn mức giao dịch trong ngày',
  '75': 'Ngân hàng thanh toán đang bảo trì',
  '79': 'KH nhập sai mật khẩu thanh toán quá số lần quy định',
  '99': 'Lỗi không xác định'
};
