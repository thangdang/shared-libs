/**
 * Vietnamese Error Messages (T60 — REQ-23)
 *
 * Shared error message map for all Node.js services.
 * Returns Vietnamese user-friendly messages alongside English technical errors.
 *
 * Usage in Express error handler:
 *   import { getVietnameseError } from '@winlux/service-clients/middleware/error-messages-vi';
 *
 *   app.use((err, req, res, next) => {
 *     const { message_vi, status } = getVietnameseError(err.message, err.status);
 *     res.status(status).json({ error: err.message, message_vi, status });
 *   });
 */

export interface VietnameseError {
  message_vi: string;
  status: number;
}

/**
 * Map English error messages/codes to Vietnamese user-facing messages.
 */
const ERROR_MAP: Record<string, VietnameseError> = {
  // ─── Auth (401/403) ───
  'unauthorized': { message_vi: 'Vui lòng đăng nhập để tiếp tục', status: 401 },
  'token expired': { message_vi: 'Phiên đăng nhập đã hết hạn — vui lòng đăng nhập lại', status: 401 },
  'invalid token': { message_vi: 'Phiên đăng nhập không hợp lệ — vui lòng đăng nhập lại', status: 401 },
  'forbidden': { message_vi: 'Bạn không có quyền thực hiện thao tác này', status: 403 },
  'insufficient permissions': { message_vi: 'Bạn không có quyền truy cập mục này', status: 403 },

  // ─── Validation (400) ───
  'topic is required': { message_vi: 'Vui lòng nhập chủ đề', status: 400 },
  'topics array required': { message_vi: 'Vui lòng chọn ít nhất một chủ đề', status: 400 },
  'email is required': { message_vi: 'Vui lòng nhập email', status: 400 },
  'invalid email': { message_vi: 'Email không hợp lệ', status: 400 },
  'password is required': { message_vi: 'Vui lòng nhập mật khẩu', status: 400 },
  'password too short': { message_vi: 'Mật khẩu phải có ít nhất 6 ký tự', status: 400 },
  'phone is required': { message_vi: 'Vui lòng nhập số điện thoại', status: 400 },
  'invalid phone': { message_vi: 'Số điện thoại không hợp lệ', status: 400 },
  'otp is required': { message_vi: 'Vui lòng nhập mã OTP', status: 400 },
  'invalid otp': { message_vi: 'Mã OTP không đúng hoặc đã hết hạn', status: 400 },
  'missing required fields': { message_vi: 'Vui lòng điền đầy đủ thông tin bắt buộc', status: 400 },
  'invalid amount': { message_vi: 'Số tiền không hợp lệ', status: 400 },
  'invalid date': { message_vi: 'Ngày không hợp lệ', status: 400 },

  // ─── Not Found (404) ───
  'not found': { message_vi: 'Không tìm thấy nội dung yêu cầu', status: 404 },
  'video not found': { message_vi: 'Video không tồn tại', status: 404 },
  'product not found': { message_vi: 'Sản phẩm không tồn tại', status: 404 },
  'article not found': { message_vi: 'Bài viết không tồn tại', status: 404 },
  'user not found': { message_vi: 'Tài khoản không tồn tại', status: 404 },
  'channel not found': { message_vi: 'Kênh không tồn tại', status: 404 },
  'pharmacy not found': { message_vi: 'Nhà thuốc không tồn tại', status: 404 },
  'drug not found': { message_vi: 'Thuốc không tìm thấy', status: 404 },
  'garage not found': { message_vi: 'Garage không tồn tại', status: 404 },
  'transaction not found': { message_vi: 'Giao dịch không tồn tại', status: 404 },
  'vehicle not found': { message_vi: 'Xe không tồn tại trong hệ thống', status: 404 },

  // ─── Conflict (409) ───
  'email already exists': { message_vi: 'Email đã được sử dụng — thử đăng nhập hoặc dùng email khác', status: 409 },
  'phone already exists': { message_vi: 'Số điện thoại đã được đăng ký', status: 409 },
  'already subscribed': { message_vi: 'Bạn đã đăng ký gói này rồi', status: 409 },
  'duplicate': { message_vi: 'Dữ liệu đã tồn tại', status: 409 },

  // ─── Rate Limit (429) ───
  'rate limit exceeded': { message_vi: 'Bạn đã gửi quá nhiều yêu cầu — vui lòng thử lại sau 1 phút', status: 429 },
  'too many requests': { message_vi: 'Quá nhiều yêu cầu — vui lòng đợi một lát', status: 429 },
  'daily limit reached': { message_vi: 'Đã hết lượt sử dụng miễn phí hôm nay — nâng cấp Pro để dùng không giới hạn', status: 429 },

  // ─── Payment (402) ───
  'payment required': { message_vi: 'Tính năng này yêu cầu gói Pro — nâng cấp ngay', status: 402 },
  'payment failed': { message_vi: 'Thanh toán thất bại — vui lòng thử lại hoặc đổi phương thức', status: 402 },
  'subscription expired': { message_vi: 'Gói đăng ký đã hết hạn — gia hạn để tiếp tục', status: 402 },

  // ─── AI / Processing (500/503) ───
  'ai service unavailable': { message_vi: 'Hệ thống AI đang bận — vui lòng thử lại trong giây lát', status: 503 },
  'ai timeout': { message_vi: 'AI đang xử lý lâu hơn bình thường — vui lòng thử lại', status: 504 },
  'generation failed': { message_vi: 'Không thể tạo nội dung — vui lòng thử lại', status: 500 },
  'processing error': { message_vi: 'Đã xảy ra lỗi khi xử lý — vui lòng thử lại sau', status: 500 },

  // ─── Server (500) ───
  'internal server error': { message_vi: 'Hệ thống gặp sự cố — vui lòng thử lại sau', status: 500 },
  'database error': { message_vi: 'Lỗi kết nối dữ liệu — vui lòng thử lại', status: 500 },
  'service unavailable': { message_vi: 'Dịch vụ đang bảo trì — vui lòng quay lại sau', status: 503 },
};

/**
 * Get Vietnamese error message for a given English error.
 * Falls back to generic Vietnamese message if no exact match found.
 */
export function getVietnameseError(englishError: string, statusCode?: number): VietnameseError {
  const errorLower = (englishError || '').toLowerCase().trim();

  // Exact match
  if (ERROR_MAP[errorLower]) {
    return ERROR_MAP[errorLower];
  }

  // Partial match (contains key phrase)
  for (const [key, value] of Object.entries(ERROR_MAP)) {
    if (errorLower.includes(key)) {
      return value;
    }
  }

  // Status code based fallback
  const status = statusCode || 500;
  if (status === 400) return { message_vi: 'Dữ liệu gửi lên không hợp lệ', status: 400 };
  if (status === 401) return { message_vi: 'Vui lòng đăng nhập', status: 401 };
  if (status === 403) return { message_vi: 'Không có quyền truy cập', status: 403 };
  if (status === 404) return { message_vi: 'Không tìm thấy', status: 404 };
  if (status === 429) return { message_vi: 'Quá nhiều yêu cầu — vui lòng đợi', status: 429 };

  // Generic fallback
  return { message_vi: 'Đã xảy ra lỗi — vui lòng thử lại sau', status };
}

/**
 * Express error handler middleware with Vietnamese messages.
 * Drop this into any product service's middleware stack:
 *
 *   import { vietnameseErrorHandler } from '@winlux/service-clients/middleware/error-messages-vi';
 *   app.use(vietnameseErrorHandler);
 */
export function vietnameseErrorHandler(err: any, req: any, res: any, next: any): void {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  const { message_vi } = getVietnameseError(message, status);

  // Log for debugging (English)
  if (status >= 500) {
    console.error(`[${req.method} ${req.path}] ${status}: ${message}`, err.stack || '');
  }

  res.status(status).json({
    error: message,
    message_vi,
    status,
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
}
