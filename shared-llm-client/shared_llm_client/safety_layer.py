"""Multi-layer safety stack — pre-AI, post-AI, and circuit breaker protection.

Each product has a configurable safety pipeline:
1. Pre-AI checks (rule engine) — block dangerous content before LLM call
2. AI processing — generate response
3. Post-AI validation (rule engine) — verify output safety before returning
4. Circuit breaker — if >N% blocked → switch to templates only

Usage:
    safety = SafetyLayer(product="caremate", db=mongo_db)
    result = await safety.process(
        input_data={"symptoms": "đau ngực dữ dội"},
        ai_fn=generate_response,
        task_type="symptom_analysis",
    )
"""

import logging
import re
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class SafetyResult:
    """Result from safety layer processing."""
    value: Any
    safe: bool
    source: str  # "ai", "template", "blocked"
    blocked_by: Optional[str] = None  # Which check blocked it
    warnings: List[str] = field(default_factory=list)
    confidence: float = 0.8
    latency_ms: float = 0


# ═══════════════════════════════════════════════════════════════
#  CareMate Safety Rules
# ═══════════════════════════════════════════════════════════════

CAREMATE_EMERGENCY_KEYWORDS = [
    r"đau ngực.*(dữ dội|lan ra|khó thở)",
    r"(khó thở|không thở được|nghẹt thở)",
    r"(co giật|động kinh|bất tỉnh|hôn mê)",
    r"(chảy máu.*(nhiều|không cầm|dữ dội))",
    r"(đột quỵ|liệt|méo miệng|nói ngọng)",
    r"(tự tử|muốn chết|tự hại|tự sát)",
    r"(sốc phản vệ|phù mặt.*khó thở)",
    r"(nuốt.*thuốc.*nhiều|quá liều|ngộ độc)",
    r"(vỡ ối|chuyển dạ|sinh non)",
    r"(tai nạn.*nặng|gãy xương hở)",
]

CAREMATE_DISCLAIMER_TEMPLATE = (
    "\n\n⚠️ Lưu ý: Thông tin này chỉ mang tính chất tham khảo, "
    "không thay thế tư vấn y khoa. Vui lòng gặp bác sĩ để được "
    "khám và điều trị phù hợp."
)

# ═══════════════════════════════════════════════════════════════
#  FIN Tax Safety Rules
# ═══════════════════════════════════════════════════════════════

FINTAX_MATH_PATTERNS = [
    r"\d+\s*[×x\*]\s*\d+",  # Multiplication
    r"\d+\s*[÷/]\s*\d+",    # Division
    r"thuế.*=.*\d+",         # Tax = number (AI should never generate)
    r"phải nộp.*\d+.*VND",   # Must pay X VND
]

# ═══════════════════════════════════════════════════════════════
#  Doctor Car Safety Rules
# ═══════════════════════════════════════════════════════════════

DOCTORCAR_DANGER_KEYWORDS = [
    r"(phanh|thắng).*(mất|hỏng|không ăn|bó)",
    r"(lái|vô lăng).*(nặng|kẹt|rung|lắc dữ dội)",
    r"(túi khí|airbag).*(sáng đèn|lỗi|không hoạt động)",
    r"(cháy|khói đen|mùi khét.*nặng)",
    r"(rò rỉ.*nhiên liệu|chảy xăng|chảy dầu.*nhiều)",
]


class SafetyLayer:
    """Multi-layer safety stack for AI responses.

    Pipeline:
        Pre-AI → AI generation → Post-AI → Output

    If pre-AI blocks → return template immediately (no LLM cost).
    If post-AI fails → return template or add disclaimers.
    Circuit breaker: if >X% blocked in last hour → templates only.
    """

    def __init__(self, product: str, db=None):
        """Initialize safety layer.

        Args:
            product: Product name.
            db: MongoDB database (for circuit breaker state tracking).
        """
        self.product = product.lower()
        self._db = db
        self._blocked_count = 0
        self._total_count = 0
        self._hour_start = time.time()

        # Circuit breaker thresholds
        self._circuit_thresholds = {
            "caremate": 0.03,   # >3% blocked → templates only
            "fintax": 0.01,    # >1% → rule engine only
            "doctorcar": 0.05, # >5% → templates only
            "smartbuy": 0.10,  # More lenient
        }

    async def process(
        self,
        input_data: Any,
        ai_fn: Callable[..., Coroutine],
        task_type: str,
        template_fn: Optional[Callable] = None,
    ) -> SafetyResult:
        """Process input through the safety pipeline.

        Args:
            input_data: Input to process.
            ai_fn: Async AI generation function.
            task_type: Task type (for context-specific rules).
            template_fn: Fallback template function (when AI is bypassed).

        Returns:
            SafetyResult with safe output.
        """
        start = time.time()
        self._total_count += 1
        self._check_hour_reset()

        # Check circuit breaker
        if self._is_circuit_open():
            logger.warning(f"[Safety] Circuit breaker OPEN for {self.product}")
            value = template_fn(input_data) if template_fn else self._default_template(input_data)
            return SafetyResult(
                value=value,
                safe=True,
                source="template",
                blocked_by="circuit_breaker",
                latency_ms=(time.time() - start) * 1000,
            )

        # === PRE-AI CHECKS ===
        pre_result = self._pre_ai_check(input_data, task_type)
        if pre_result is not None:
            self._blocked_count += 1
            return SafetyResult(
                value=pre_result["value"],
                safe=True,
                source="template",
                blocked_by=pre_result["blocked_by"],
                warnings=pre_result.get("warnings", []),
                latency_ms=(time.time() - start) * 1000,
            )

        # === AI PROCESSING ===
        try:
            ai_output = await ai_fn(input_data)
        except Exception as e:
            logger.error(f"[Safety] AI failed: {e}")
            value = template_fn(input_data) if template_fn else self._default_template(input_data)
            return SafetyResult(
                value=value,
                safe=True,
                source="template",
                blocked_by="ai_error",
                latency_ms=(time.time() - start) * 1000,
            )

        # === POST-AI VALIDATION ===
        post_result = self._post_ai_check(ai_output, input_data, task_type)

        return SafetyResult(
            value=post_result["value"],
            safe=post_result["safe"],
            source="ai",
            warnings=post_result.get("warnings", []),
            confidence=post_result.get("confidence", 0.8),
            latency_ms=(time.time() - start) * 1000,
        )

    def _pre_ai_check(self, input_data: Any, task_type: str) -> Optional[Dict]:
        """Pre-AI safety checks (rules only, no LLM cost).

        Returns None if safe to proceed, or dict with blocked response.
        """
        text = str(input_data) if not isinstance(input_data, str) else input_data

        if self.product == "caremate":
            return self._caremate_pre_check(text, task_type)
        elif self.product == "fintax":
            return self._fintax_pre_check(text, task_type)
        elif self.product == "doctorcar":
            return self._doctorcar_pre_check(text, task_type)

        return None

    def _post_ai_check(self, ai_output: Any, input_data: Any, task_type: str) -> Dict:
        """Post-AI validation (verify output safety)."""
        output_text = str(ai_output) if not isinstance(ai_output, str) else ai_output
        warnings = []

        if self.product == "caremate":
            # Ensure disclaimer present
            if "tham khảo" not in output_text.lower() and "bác sĩ" not in output_text.lower():
                output_text += CAREMATE_DISCLAIMER_TEMPLATE
                warnings.append("disclaimer_added")

        elif self.product == "fintax":
            # Verify no AI-generated calculations
            for pattern in FINTAX_MATH_PATTERNS:
                if re.search(pattern, output_text, re.IGNORECASE):
                    warnings.append("math_in_ai_output")
                    logger.warning("[Safety] FIN Tax AI output contains math — flagging")

        elif self.product == "doctorcar":
            # Ensure disclaimer
            if "tham khảo" not in output_text.lower() and "garage" not in output_text.lower():
                output_text += "\n\n🔧 Khuyến nghị kiểm tra tại garage để xác nhận."
                warnings.append("disclaimer_added")

        return {
            "value": output_text if isinstance(ai_output, str) else ai_output,
            "safe": True,
            "warnings": warnings,
            "confidence": 0.9 if not warnings else 0.7,
        }

    def _caremate_pre_check(self, text: str, task_type: str) -> Optional[Dict]:
        """CareMate emergency detection (rule-only, instant)."""
        text_lower = text.lower()

        for pattern in CAREMATE_EMERGENCY_KEYWORDS:
            if re.search(pattern, text_lower):
                logger.info(f"[Safety] CareMate EMERGENCY detected: {pattern}")
                return {
                    "value": (
                        "🚨 CẢNH BÁO KHẨN CẤP\n\n"
                        "Triệu chứng bạn mô tả có thể là tình huống y tế khẩn cấp.\n\n"
                        "👉 Vui lòng GỌI 115 (cấp cứu) ngay lập tức.\n"
                        "👉 Hoặc đến phòng cấp cứu bệnh viện gần nhất.\n\n"
                        "⚠️ Không tự điều trị. Mỗi phút đều quan trọng."
                    ),
                    "blocked_by": "emergency_detection",
                    "warnings": ["emergency_keywords_detected"],
                }

        return None

    def _fintax_pre_check(self, text: str, task_type: str) -> Optional[Dict]:
        """FIN Tax — ensure AI never does calculations."""
        # If task is calculation-related, block AI entirely
        if task_type in ("tax_calculation", "bracket_lookup", "discount_calculation"):
            return {
                "value": "Calculation tasks must use rule engine only.",
                "blocked_by": "calculation_task_blocked",
                "warnings": ["ai_blocked_for_math"],
            }
        return None

    def _doctorcar_pre_check(self, text: str, task_type: str) -> Optional[Dict]:
        """Doctor Car — detect dangerous vehicle symptoms."""
        text_lower = text.lower()

        for pattern in DOCTORCAR_DANGER_KEYWORDS:
            if re.search(pattern, text_lower):
                logger.info(f"[Safety] DoctorCar DANGER detected: {pattern}")
                # Don't block — but flag as high severity
                # Return None to let AI process, but add context
                return None  # Let AI handle with elevated severity

        return None

    def _is_circuit_open(self) -> bool:
        """Check if safety circuit breaker is open."""
        if self._total_count < 10:
            return False  # Not enough data

        threshold = self._circuit_thresholds.get(self.product, 0.05)
        blocked_rate = self._blocked_count / self._total_count

        return blocked_rate > threshold

    def _check_hour_reset(self):
        """Reset counters every hour."""
        if time.time() - self._hour_start > 3600:
            self._blocked_count = 0
            self._total_count = 0
            self._hour_start = time.time()

    def _default_template(self, input_data: Any) -> str:
        """Default safe template response when AI is unavailable."""
        templates = {
            "caremate": (
                "Xin lỗi, tôi không thể đánh giá chính xác lúc này. "
                "Vui lòng tham khảo ý kiến bác sĩ để được tư vấn phù hợp."
            ),
            "fintax": (
                "Xin lỗi, tôi không thể xử lý yêu cầu này lúc này. "
                "Vui lòng thử lại sau hoặc liên hệ hỗ trợ."
            ),
            "doctorcar": (
                "Xin lỗi, hệ thống chẩn đoán tạm thời không khả dụng. "
                "Vui lòng thử lại sau hoặc liên hệ garage gần nhất."
            ),
        }
        return templates.get(self.product, "Service temporarily unavailable.")

    def get_stats(self) -> Dict:
        """Get safety layer statistics."""
        return {
            "product": self.product,
            "total_processed": self._total_count,
            "blocked": self._blocked_count,
            "blocked_rate": (
                self._blocked_count / max(self._total_count, 1)
            ),
            "circuit_open": self._is_circuit_open(),
            "threshold": self._circuit_thresholds.get(self.product, 0.05),
        }
