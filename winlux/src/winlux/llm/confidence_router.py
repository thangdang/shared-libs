"""Confidence-based routing — route AI outputs by confidence level.

Forces confidence in all AI outputs and routes by threshold:
    ≥ 0.8: return directly (high confidence)
    0.5-0.8: return with disclaimer (medium confidence)
    < 0.5: use fallback (template/rule engine/raw data)

Tracks confidence distribution per product per task for monitoring.

Usage:
    router = ConfidenceRouter(product="caremate")
    result = router.route(
        ai_output={"severity": "high", "confidence": 0.45},
        fallback_value={"severity": "unknown", "note": "see doctor"},
    )
"""

import logging
import time
from collections import defaultdict
from dataclasses import dataclass
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)

# Confidence thresholds
HIGH_CONFIDENCE = 0.8
MEDIUM_CONFIDENCE = 0.5

# Alert threshold — if avg confidence drops below this, log warning
ALERT_THRESHOLD = 0.6


@dataclass
class ConfidenceResult:
    """Result after confidence routing."""
    value: Any
    confidence: float
    action: str  # "direct", "disclaimer", "fallback"
    disclaimer: Optional[str] = None
    original_confidence: float = 0.0


# Per-product disclaimers
DISCLAIMERS = {
    "caremate": "⚠️ Độ tin cậy trung bình — vui lòng tham khảo ý kiến bác sĩ.",
    "fintax": "⚠️ Kết quả chưa chắc chắn — vui lòng xác nhận với kế toán.",
    "smartbuy": "ℹ️ Thông tin tham khảo — giá có thể thay đổi.",
    "doctorcar": "⚠️ Mức tin cậy trung bình — nên kiểm tra tại garage.",
    "trendbriefai": "ℹ️ Nội dung AI tóm tắt — xem bài gốc để xác nhận.",
    "childhood": "",  # No user-facing disclaimer needed
}


class ConfidenceRouter:
    """Routes AI outputs based on confidence scores.

    Ensures every AI output has a confidence value.
    Routes to appropriate handling based on thresholds.
    Tracks distribution for monitoring alerts.
    """

    def __init__(self, product: str):
        """Initialize.

        Args:
            product: Product name.
        """
        self.product = product.lower()
        self._disclaimer = DISCLAIMERS.get(self.product, "")

        # Tracking
        self._scores: Dict[str, List[float]] = defaultdict(list)
        self._total_routed = 0
        self._fallback_count = 0

    def route(
        self,
        ai_output: Any,
        confidence: Optional[float] = None,
        task_type: str = "default",
        fallback_value: Any = None,
        fallback_fn: Optional[Callable] = None,
    ) -> ConfidenceResult:
        """Route AI output based on confidence.

        Args:
            ai_output: The AI-generated output.
            confidence: Confidence score. If None, estimated from output.
            task_type: Task type for tracking.
            fallback_value: Static fallback value for low confidence.
            fallback_fn: Dynamic fallback function for low confidence.

        Returns:
            ConfidenceResult with routed value and metadata.
        """
        self._total_routed += 1

        # Extract or estimate confidence
        actual_confidence = confidence
        if actual_confidence is None:
            actual_confidence = self._estimate_confidence(ai_output)

        # Track
        self._scores[task_type].append(actual_confidence)
        self._check_alert(task_type)

        # Route by threshold
        if actual_confidence >= HIGH_CONFIDENCE:
            return ConfidenceResult(
                value=ai_output,
                confidence=actual_confidence,
                action="direct",
                original_confidence=actual_confidence,
            )

        elif actual_confidence >= MEDIUM_CONFIDENCE:
            # Add disclaimer
            value = self._add_disclaimer(ai_output)
            return ConfidenceResult(
                value=value,
                confidence=actual_confidence,
                action="disclaimer",
                disclaimer=self._disclaimer,
                original_confidence=actual_confidence,
            )

        else:
            # Low confidence — use fallback
            self._fallback_count += 1
            if fallback_fn:
                fallback_result = fallback_fn()
            elif fallback_value is not None:
                fallback_result = fallback_value
            else:
                fallback_result = ai_output  # No fallback available, return as-is with warning

            logger.info(
                f"[ConfidenceRouter] Low confidence ({actual_confidence:.2f}) "
                f"for {self.product}/{task_type} — using fallback"
            )

            return ConfidenceResult(
                value=fallback_result,
                confidence=actual_confidence,
                action="fallback",
                original_confidence=actual_confidence,
            )

    def _estimate_confidence(self, output: Any) -> float:
        """Estimate confidence when model doesn't provide one.

        Heuristics:
        - Dict with "confidence" field → use it
        - Short output → lower confidence
        - Contains hedging words → lower confidence
        """
        if isinstance(output, dict):
            if "confidence" in output:
                return float(output["confidence"])
            if "score" in output:
                return float(output["score"]) / 100.0

        text = str(output)

        # Hedging words reduce confidence
        hedging_vi = ["có thể", "có lẽ", "không chắc", "cần kiểm tra thêm", "khó xác định"]
        hedging_count = sum(1 for h in hedging_vi if h in text.lower())

        # Base confidence
        base = 0.7

        # Reduce for hedging
        base -= hedging_count * 0.1

        # Very short responses → lower confidence
        if len(text) < 20:
            base -= 0.1

        return max(0.1, min(1.0, base))

    def _add_disclaimer(self, output: Any) -> Any:
        """Add confidence disclaimer to output."""
        if not self._disclaimer:
            return output

        if isinstance(output, str):
            return f"{output}\n\n{self._disclaimer}"
        elif isinstance(output, dict):
            output["_disclaimer"] = self._disclaimer
            return output
        else:
            return output

    def _check_alert(self, task_type: str):
        """Check if average confidence is dropping (potential model degradation)."""
        scores = self._scores[task_type]
        if len(scores) >= 20:
            # Check last 20 scores
            recent = scores[-20:]
            avg = sum(recent) / len(recent)
            if avg < ALERT_THRESHOLD:
                logger.warning(
                    f"[ConfidenceRouter] LOW AVG CONFIDENCE for "
                    f"{self.product}/{task_type}: {avg:.2f} "
                    f"(threshold: {ALERT_THRESHOLD})"
                )

    def get_stats(self) -> Dict:
        """Get confidence routing statistics."""
        all_scores = []
        by_task = {}

        for task_type, scores in self._scores.items():
            if scores:
                avg = sum(scores) / len(scores)
                all_scores.extend(scores)
                by_task[task_type] = {
                    "count": len(scores),
                    "avg_confidence": round(avg, 3),
                    "pct_high": round(sum(1 for s in scores if s >= HIGH_CONFIDENCE) / len(scores), 3),
                    "pct_low": round(sum(1 for s in scores if s < MEDIUM_CONFIDENCE) / len(scores), 3),
                }

        overall_avg = sum(all_scores) / len(all_scores) if all_scores else 0

        return {
            "product": self.product,
            "total_routed": self._total_routed,
            "fallback_count": self._fallback_count,
            "fallback_rate": self._fallback_count / max(self._total_routed, 1),
            "avg_confidence": round(overall_avg, 3),
            "by_task": by_task,
            "alert": overall_avg < ALERT_THRESHOLD if all_scores else False,
        }
