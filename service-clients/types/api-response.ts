/**
 * Shared API Response Types
 * ─────────────────────────
 * Standardized response format for all WinLux shared services.
 * All services (auth, payment, notification) must return this format.
 *
 * Requirements:  Req 9.1, 9.3, 9.4
 */

// ─── Core Response Interface ─────────────────────────────────────────────────

/**
 * Unified API response format used across all shared services.
 *
 * @template T - Type of the data payload on success
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;         // Technical error message (for developers)
  code?: string;          // Error code (e.g., AUTH_INVALID_001, PAY_PROVIDER_001)
  message_vi?: string;    // Vietnamese user-facing message
}

// ─── Error Code Constants ────────────────────────────────────────────────────

/**
 * Error code format:  {SERVICE}_{CATEGORY}_{NUMBER}
 *
 * SERVICE:   AUTH, PAY, NOTIF, UNKNOWN
 * CATEGORY:  Describes the error domain
 * NUMBER:    Sequential within category
 */

// Auth error codes
export const AUTH_INVALID_001 = 'AUTH_INVALID_001';         // Invalid credentials
export const AUTH_EXPIRED_001 = 'AUTH_EXPIRED_001';         // Token expired
export const AUTH_FORBIDDEN_001 = 'AUTH_FORBIDDEN_001';     // Insufficient permissions
export const AUTH_NOTFOUND_001 = 'AUTH_NOTFOUND_001';       // User not found
export const AUTH_DUPLICATE_001 = 'AUTH_DUPLICATE_001';     // User already exists
export const AUTH_ZALO_001 = 'AUTH_ZALO_001';               // Zalo SSO failure

// Payment error codes
export const PAY_PROVIDER_001 = 'PAY_PROVIDER_001';         // Provider timeout
export const PAY_PROVIDER_002 = 'PAY_PROVIDER_002';         // Provider rejected
export const PAY_INVALID_001 = 'PAY_INVALID_001';           // Invalid payment data
export const PAY_NOTFOUND_001 = 'PAY_NOTFOUND_001';         // Order not found
export const PAY_REFUND_001 = 'PAY_REFUND_001';             // Refund failed
export const PAY_DUPLICATE_001 = 'PAY_DUPLICATE_001';       // Duplicate payment

// Notification error codes
export const NOTIF_RATE_001 = 'NOTIF_RATE_001';             // Rate limit exceeded
export const NOTIF_CHANNEL_001 = 'NOTIF_CHANNEL_001';       // Channel unavailable
export const NOTIF_TEMPLATE_001 = 'NOTIF_TEMPLATE_001';     // Template not found
export const NOTIF_DELIVERY_001 = 'NOTIF_DELIVERY_001';     // Delivery failed

// Generic error codes
export const UNKNOWN_400 = 'UNKNOWN_400';                   // Bad request
export const UNKNOWN_401 = 'UNKNOWN_401';                   // Unauthorized
export const UNKNOWN_403 = 'UNKNOWN_403';                   // Forbidden
export const UNKNOWN_404 = 'UNKNOWN_404';                   // Not found
export const UNKNOWN_429 = 'UNKNOWN_429';                   // Too many requests
export const UNKNOWN_500 = 'UNKNOWN_500';                   // Internal server error

// ─── Vietnamese Error Messages ───────────────────────────────────────────────

/**
 * Default Vietnamese error messages mapped to common HTTP status codes.
 * Used as fallback when a specific message_vi is not provided.
 */
export const DEFAULT_MESSAGES_VI: Record<number, string> = {
  400: 'Dữ liệu không hợp lệ.  Vui lòng kiểm tra lại.',
  401: 'Bạn chưa đăng nhập.  Vui lòng đăng nhập để tiếp tục.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy dữ liệu yêu cầu.',
  409: 'Dữ liệu bị trùng lặp.  Vui lòng kiểm tra lại.',
  429: 'Bạn đã gửi quá nhiều yêu cầu.  Vui lòng thử lại sau.',
  500: 'Đã có lỗi xảy ra.  Vui lòng thử lại.',
  502: 'Dịch vụ tạm thời không khả dụng.  Vui lòng thử lại sau.',
  503: 'Hệ thống đang bảo trì.  Vui lòng quay lại sau.',
};

// ─── AppError Class ──────────────────────────────────────────────────────────

/**
 * Custom error class that services can throw to provide structured errors.
 * The shared error handler middleware will catch these and format as ApiResponse.
 *
 * @example
 * ```typescript
 * throw new AppError('User not found', 404, 'AUTH_NOTFOUND_001', 'Không tìm thấy người dùng.');
 * ```
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly message_vi: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code?: string,
    message_vi?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code || `UNKNOWN_${statusCode}`;
    this.message_vi = message_vi || DEFAULT_MESSAGES_VI[statusCode] || 'Đã có lỗi xảy ra.  Vui lòng thử lại.';

    // Maintain proper stack trace (V8 engines)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Create a successful ApiResponse.
 */
export function successResponse<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

/**
 * Create an error ApiResponse.
 */
export function errorResponse(
  error: string,
  code?: string,
  message_vi?: string,
): ApiResponse {
  return {
    success: false,
    error,
    code,
    message_vi,
  };
}

// ─── Express Error Handler Middleware ────────────────────────────────────────

/**
 * Shared Express error-handling middleware.
 * Catches AppError instances and unknown errors, returning a standardized ApiResponse.
 *
 * Usage:  app.use(errorHandler)  — must be registered AFTER all routes.
 *
 * Requirements:  Req 9.2
 */
export function errorHandler(
  err: Error,
  _req: any,
  res: any,
  _next: any,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json(errorResponse(
      err.message,
      err.code,
      err.message_vi,
    ));
    return;
  }

  // Unknown / unhandled error — return generic 500
  const statusCode = 500;
  res.status(statusCode).json(errorResponse(
    err.message || 'Internal server error',
    `UNKNOWN_${statusCode}`,
    DEFAULT_MESSAGES_VI[statusCode],
  ));
}
