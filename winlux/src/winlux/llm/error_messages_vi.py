"""
Vietnamese Error Messages for Python AI Engines (T61 — REQ-23)

Provides Vietnamese translations for common AI engine error responses.
All Python AI engines (SmartBuy, TrendBrief, CareMate, FIN Tax, DoctorCar, Childhood)
should use this module to return user-friendly Vietnamese messages.

Usage:
  from winlux.llm.error_messages_vi import get_vietnamese_error, vietnamese_error_response

  # In Flask/FastAPI error handlers:
  @app.errorhandler(400)
  def handle_400(e):
      return vietnamese_error_response(str(e), 400)

  # Direct lookup:
  msg = get_vietnamese_error("model not available")
  # Returns: "Hệ thống AI đang bận — vui lòng thử lại sau"
"""

from typing import Optional


# ═══════════════════════════════════════════════════════════════
#  Error Message Map
# ═══════════════════════════════════════════════════════════════

ERROR_MAP: dict[str, dict[str, str | int]] = {
    # ─── Input Validation ───
    "text is required": {"vi": "Vui lòng nhập nội dung", "status": 400},
    "topic is required": {"vi": "Vui lòng nhập chủ đề", "status": 400},
    "query is required": {"vi": "Vui lòng nhập câu hỏi", "status": 400},
    "symptoms is required": {"vi": "Vui lòng mô tả triệu chứng", "status": 400},
    "invalid input": {"vi": "Dữ liệu gửi lên không hợp lệ", "status": 400},
    "text too long": {"vi": "Nội dung quá dài — tối đa 2000 ký tự", "status": 400},
    "text too short": {"vi": "Nội dung quá ngắn — vui lòng mô tả chi tiết hơn", "status": 400},
    "unsupported language": {"vi": "Ngôn ngữ chưa được hỗ trợ", "status": 400},

    # ─── AI / LLM Errors ───
    "model not available": {"vi": "Hệ thống AI đang bận — vui lòng thử lại sau", "status": 503},
    "ollama not available": {"vi": "AI đang khởi động — vui lòng đợi 30 giây rồi thử lại", "status": 503},
    "llm timeout": {"vi": "AI đang xử lý lâu hơn bình thường — vui lòng thử lại", "status": 504},
    "generation failed": {"vi": "Không thể tạo câu trả lời — vui lòng thử lại", "status": 500},
    "context too long": {"vi": "Nội dung quá phức tạp — vui lòng chia nhỏ câu hỏi", "status": 400},
    "rate limited": {"vi": "Quá nhiều yêu cầu — vui lòng đợi 1 phút", "status": 429},
    "circuit breaker open": {"vi": "Hệ thống AI đang bảo trì — sẽ hoạt động lại trong vài phút", "status": 503},

    # ─── RAG / Search ───
    "no results found": {"vi": "Không tìm thấy kết quả phù hợp", "status": 404},
    "embedding failed": {"vi": "Không thể xử lý nội dung — vui lòng thử lại", "status": 500},
    "vector store unavailable": {"vi": "Hệ thống tìm kiếm đang bận — thử lại sau", "status": 503},

    # ─── Product-Specific ───
    # CareMate
    "symptom not recognized": {"vi": "Không nhận diện được triệu chứng — vui lòng mô tả chi tiết hơn", "status": 400},
    "drug not found": {"vi": "Không tìm thấy thuốc trong cơ sở dữ liệu", "status": 404},
    "pharmacy not found": {"vi": "Không tìm thấy nhà thuốc trong khu vực", "status": 404},

    # FIN Tax
    "invalid amount": {"vi": "Số tiền không hợp lệ", "status": 400},
    "tax calculation failed": {"vi": "Không thể tính thuế — vui lòng kiểm tra dữ liệu nhập", "status": 500},
    "ocr failed": {"vi": "Không thể đọc hóa đơn — vui lòng chụp rõ hơn", "status": 400},

    # Doctor Car
    "diagnosis failed": {"vi": "Không thể chẩn đoán — vui lòng mô tả triệu chứng rõ hơn", "status": 500},
    "dtc code not found": {"vi": "Mã lỗi OBD-II không nhận dạng được", "status": 404},
    "vehicle not supported": {"vi": "Hãng xe chưa được hỗ trợ", "status": 400},

    # SmartBuy
    "product not found": {"vi": "Sản phẩm không tồn tại hoặc đã hết hàng", "status": 404},
    "comparison failed": {"vi": "Không thể so sánh — vui lòng thử lại", "status": 500},

    # TrendBrief
    "article not found": {"vi": "Bài viết không tồn tại", "status": 404},
    "summarization failed": {"vi": "Không thể tóm tắt bài viết — vui lòng thử lại", "status": 500},

    # Video Engine
    "script generation failed": {"vi": "Không thể tạo script — vui lòng thử lại", "status": 500},
    "composition failed": {"vi": "Không thể tạo video — vui lòng thử lại", "status": 500},
    "no trending topics": {"vi": "Không tìm thấy chủ đề trending phù hợp", "status": 404},

    # ─── Server / Generic ───
    "internal server error": {"vi": "Hệ thống gặp sự cố — vui lòng thử lại sau", "status": 500},
    "service unavailable": {"vi": "Dịch vụ đang bảo trì — vui lòng quay lại sau", "status": 503},
    "not found": {"vi": "Không tìm thấy nội dung yêu cầu", "status": 404},
    "method not allowed": {"vi": "Phương thức không được hỗ trợ", "status": 405},
}


# ═══════════════════════════════════════════════════════════════
#  Public API
# ═══════════════════════════════════════════════════════════════

def get_vietnamese_error(english_error: str, status_code: Optional[int] = None) -> str:
    """
    Get Vietnamese error message for an English error string.
    Falls back to generic message if no match found.
    """
    error_lower = (english_error or "").lower().strip()

    # Exact match
    if error_lower in ERROR_MAP:
        return ERROR_MAP[error_lower]["vi"]

    # Partial match (contains keyword)
    for key, value in ERROR_MAP.items():
        if key in error_lower:
            return value["vi"]

    # Status-based fallback
    if status_code:
        fallbacks = {
            400: "Dữ liệu gửi lên không hợp lệ",
            401: "Vui lòng đăng nhập",
            403: "Không có quyền truy cập",
            404: "Không tìm thấy",
            429: "Quá nhiều yêu cầu — vui lòng đợi",
            500: "Hệ thống gặp sự cố — vui lòng thử lại sau",
            503: "Dịch vụ đang bận — vui lòng thử lại sau",
        }
        return fallbacks.get(status_code, "Đã xảy ra lỗi — vui lòng thử lại")

    return "Đã xảy ra lỗi — vui lòng thử lại sau"


def vietnamese_error_response(error: str, status_code: int = 500) -> dict:
    """
    Build a standardized error response dict with Vietnamese message.
    Use in Flask/FastAPI error handlers.

    Returns: {"error": "english msg", "message_vi": "Vietnamese msg", "status": code}
    """
    return {
        "error": error,
        "message_vi": get_vietnamese_error(error, status_code),
        "status": status_code,
    }
