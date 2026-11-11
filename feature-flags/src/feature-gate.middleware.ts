/**
 * Express Feature Gate Middleware
 * Task: SHARED-002
 * 
 * Middleware to gate API endpoints based on feature flags
 * Returns HTTP 503 with Vietnamese messages and alternatives
 */

import { FeaturePath, FeatureGateResponse, AppId } from './types';
import { featureFlagService } from './feature-flag.service';

// Vietnamese messages for disabled features
const FEATURE_MESSAGES: Record<string, FeatureGateResponse> = {
  // TrendBrief
  'trendbrief.ai_summarize_url': {
    enabled: false,
    message: 'Tính năng tóm tắt URL đang được phát triển.',
    alternatives: [
      'Đọc tin tức mới nhất tại trang chủ',
      'Xem các tin nổi bật trong mục TRENDING'
    ],
    eta: 'Q1 2027'
  },
  'trendbrief.ai_daily_briefing': {
    enabled: false,
    message: 'Tính năng bản tin hàng ngày đang được phát triển.',
    alternatives: [
      'Theo dõi tin BREAKING để cập nhật nhanh',
      'Đăng ký nhận email digest hàng tuần'
    ],
    eta: 'Q1 2027'
  },
  'trendbrief.ai_text_to_speech': {
    enabled: false,
    message: 'Tính năng đọc tin bằng giọng nói đang được phát triển.',
    alternatives: [
      'Đọc tin tức dạng văn bản'
    ],
    eta: 'Q2 2027'
  },

  // SmartBuy
  'smartbuy.ai_chat_query': {
    enabled: false,
    message: 'Tính năng chat AI đang được phát triển.',
    alternatives: [
      'Sử dụng tìm kiếm sản phẩm',
      'So sánh giá theo danh mục',
      'Xem Flash Sale để tìm giá tốt'
    ],
    eta: 'Q1 2027'
  },
  'smartbuy.ai_stream_query': {
    enabled: false,
    message: 'Tính năng chat AI đang được phát triển.',
    alternatives: [
      'Sử dụng tìm kiếm sản phẩm thông thường'
    ],
    eta: 'Q1 2027'
  },
  'smartbuy.ai_voice_search': {
    enabled: false,
    message: 'Tính năng tìm kiếm bằng giọng nói đang được phát triển.',
    alternatives: [
      'Nhập từ khóa tìm kiếm'
    ],
    eta: 'Q2 2027'
  },

  // FinTax
  'fintax.ai_chat': {
    enabled: false,
    message: 'Tư vấn thuế AI đang được phát triển.',
    alternatives: [
      'Xem FAQ về thuế TNCN',
      'Sử dụng máy tính thuế TNCN',
      'Đọc mẹo tiết kiệm thuế'
    ],
    eta: 'Q1 2027'
  },
  'fintax.ai_tax_advisor': {
    enabled: false,
    message: 'Tư vấn thuế AI đang được phát triển.',
    alternatives: [
      'Xem FAQ về thuế TNCN',
      'Sử dụng máy tính thuế TNCN'
    ],
    eta: 'Q1 2027'
  },
  'fintax.ai_receipt_ocr': {
    enabled: false,
    message: 'Tính năng quét hóa đơn tự động đang được phát triển.',
    alternatives: [
      'Nhập chi tiêu thủ công',
      'Chọn danh mục từ danh sách'
    ],
    eta: 'Q2 2027'
  },

  // DoctorCar
  'doctorcar.ai_diagnosis': {
    enabled: false,
    message: 'Chẩn đoán AI đang được phát triển.',
    alternatives: [
      'Tra cứu mã lỗi DTC',
      'Xem lịch bảo dưỡng theo xe',
      'Tìm kiếm triệu chứng trong diễn đàn'
    ],
    eta: 'Q1 2027'
  },
  'doctorcar.ai_image_analysis': {
    enabled: false,
    message: 'Phân tích hình ảnh AI đang được phát triển.',
    alternatives: [
      'Tra cứu mã lỗi DTC',
      'Mô tả triệu chứng và tìm kiếm'
    ],
    eta: 'Q2 2027'
  },

  // CareMate
  'caremate.ai_symptom_checker': {
    enabled: false,
    message: 'Kiểm tra triệu chứng AI đang được phát triển.',
    alternatives: [
      'Tra cứu thuốc theo tên',
      'Xem bài viết sức khỏe',
      'Tìm hiểu theo nhóm bệnh'
    ],
    eta: 'Q1 2027'
  },
  'caremate.ai_drug_suggestions': {
    enabled: false,
    message: 'Gợi ý thuốc AI đang được phát triển.',
    alternatives: [
      'Tra cứu thuốc theo tên',
      'So sánh giá thuốc tại các nhà thuốc'
    ],
    eta: 'Q1 2027'
  }
};

// Default message for unknown features
const DEFAULT_DISABLED_RESPONSE: FeatureGateResponse = {
  enabled: false,
  message: 'Tính năng này đang được phát triển.',
  alternatives: ['Vui lòng quay lại sau'],
  eta: '2027'
};

/**
 * Express middleware factory
 * 
 * Usage:
 *   app.post('/summarize-url', requireFeature('trendbrief.ai_summarize_url'), handler);
 */
export function requireFeature(featurePath: FeaturePath) {
  return (req: any, res: any, next: any) => {
    const isEnabled = featureFlagService.isEnabled(featurePath);

    if (isEnabled) {
      // Feature enabled: proceed
      return next();
    }

    // Feature disabled: return 503 with Vietnamese message
    const response = FEATURE_MESSAGES[featurePath] || DEFAULT_DISABLED_RESPONSE;
    
    return res.status(503).json({
      success: false,
      error: {
        code: 'FEATURE_DISABLED',
        feature: featurePath,
        ...response
      }
    });
  };
}

/**
 * Get feature gate response for a feature
 */
export function getFeatureGateResponse(featurePath: FeaturePath): FeatureGateResponse {
  const isEnabled = featureFlagService.isEnabled(featurePath);
  
  if (isEnabled) {
    return { enabled: true, message: 'Tính năng đã sẵn sàng.' };
  }

  return FEATURE_MESSAGES[featurePath] || DEFAULT_DISABLED_RESPONSE;
}

/**
 * Check multiple features at once
 */
export function checkFeatures(paths: FeaturePath[]): Record<FeaturePath, FeatureGateResponse> {
  const result: Record<FeaturePath, FeatureGateResponse> = {};
  
  for (const path of paths) {
    result[path] = getFeatureGateResponse(path);
  }

  return result;
}

/**
 * Get all disabled AI features for an app
 */
export function getDisabledAIFeatures(app: AppId): FeatureGateResponse[] {
  const responses: FeatureGateResponse[] = [];
  
  for (const [path, response] of Object.entries(FEATURE_MESSAGES)) {
    if (path.startsWith(`${app}.ai_`)) {
      responses.push(response);
    }
  }

  return responses;
}
