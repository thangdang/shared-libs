"""Hybrid engine — combines rule engine + AI with configurable trust levels.

Decides whether to use rules, AI, or both for each task.
Logs disagreements between rule engine and AI for monitoring.

Trust levels:
    rule_only   — 100% rule engine, AI never called (math, pricing)
    rule_primary — rule decides, AI validates (severity, classification)
    ai_primary  — AI decides, rule validates (content, recommendations)
    ai_only    — 100% AI (creative writing, explanations)

Usage:
    engine = HybridEngine()
    result = await engine.decide(
        input_data={"symptoms": "đau ngực, khó thở"},
        rule_fn=rule_classify_severity,
        ai_fn=ai_classify_severity,
        trust_level="rule_primary",
    )
"""

import logging
import time
from enum import Enum
from typing import Any, Callable, Coroutine, Dict, Optional

logger = logging.getLogger(__name__)


class TrustLevel(Enum):
    """Trust level determines who makes the final decision."""
    RULE_ONLY = "rule_only"
    RULE_PRIMARY = "rule_primary"
    AI_PRIMARY = "ai_primary"
    AI_ONLY = "ai_only"


class HybridResult:
    """Result from hybrid decision."""

    def __init__(
        self,
        value: Any,
        source: str,  # "rule", "ai", "hybrid"
        confidence: float,
        disagreement: bool = False,
        rule_value: Any = None,
        ai_value: Any = None,
        latency_ms: float = 0,
    ):
        self.value = value
        self.source = source
        self.confidence = confidence
        self.disagreement = disagreement
        self.rule_value = rule_value
        self.ai_value = ai_value
        self.latency_ms = latency_ms

    def to_dict(self) -> dict:
        return {
            "value": self.value,
            "source": self.source,
            "confidence": self.confidence,
            "disagreement": self.disagreement,
            "latency_ms": round(self.latency_ms, 1),
        }


# Per-product per-task trust level configuration
TRUST_CONFIG: Dict[str, Dict[str, TrustLevel]] = {
    "caremate": {
        "drug_interaction": TrustLevel.RULE_ONLY,
        "emergency_detection": TrustLevel.RULE_ONLY,
        "severity_scoring": TrustLevel.RULE_PRIMARY,
        "symptom_classification": TrustLevel.AI_PRIMARY,
        "response_generation": TrustLevel.AI_PRIMARY,
        "health_explanation": TrustLevel.AI_ONLY,
    },
    "fintax": {
        "tax_calculation": TrustLevel.RULE_ONLY,
        "bracket_lookup": TrustLevel.RULE_ONLY,
        "income_classification": TrustLevel.RULE_PRIMARY,
        "deduction_validation": TrustLevel.RULE_PRIMARY,
        "tax_explanation": TrustLevel.AI_ONLY,
    },
    "smartbuy": {
        "price_comparison": TrustLevel.RULE_ONLY,
        "discount_calculation": TrustLevel.RULE_ONLY,
        "product_ranking": TrustLevel.RULE_PRIMARY,
        "comparison_text": TrustLevel.AI_ONLY,
        "recommendation": TrustLevel.AI_PRIMARY,
    },
    "childhood": {
        "quality_gate_scoring": TrustLevel.RULE_PRIMARY,
        "hook_scoring": TrustLevel.RULE_PRIMARY,
        "script_generation": TrustLevel.AI_PRIMARY,
        "humanization": TrustLevel.AI_ONLY,
        "topic_scoring": TrustLevel.AI_PRIMARY,
    },
    "trendbriefai": {
        "article_categorization": TrustLevel.AI_PRIMARY,
        "trend_scoring": TrustLevel.RULE_PRIMARY,
        "summarization": TrustLevel.AI_ONLY,
        "title_generation": TrustLevel.AI_ONLY,
    },
    "doctorcar": {
        "safety_check": TrustLevel.RULE_ONLY,
        "severity_assessment": TrustLevel.RULE_PRIMARY,
        "cost_estimation": TrustLevel.RULE_PRIMARY,
        "diagnosis_reasoning": TrustLevel.AI_PRIMARY,
        "content_generation": TrustLevel.AI_ONLY,
    },
}


class HybridEngine:
    """Combines rule engine + AI with configurable trust levels."""

    def __init__(self, product: str = "default"):
        """Initialize hybrid engine.

        Args:
            product: Product name (for trust level config lookup).
        """
        self.product = product.lower()
        self._config = TRUST_CONFIG.get(self.product, {})
        self._disagreement_count = 0
        self._total_decisions = 0

    async def decide(
        self,
        input_data: Any,
        rule_fn: Optional[Callable] = None,
        ai_fn: Optional[Callable[..., Coroutine]] = None,
        trust_level: Optional[str] = None,
        task_type: Optional[str] = None,
    ) -> HybridResult:
        """Make a decision using rule engine, AI, or both.

        Args:
            input_data: Input to pass to both rule_fn and ai_fn.
            rule_fn: Synchronous rule engine function. Returns value.
            ai_fn: Async AI function. Returns value.
            trust_level: Override trust level (string or TrustLevel).
            task_type: Task type for config lookup (alternative to trust_level).

        Returns:
            HybridResult with final decision and metadata.
        """
        start = time.time()
        self._total_decisions += 1

        # Determine trust level
        level = self._resolve_trust_level(trust_level, task_type)

        # Execute based on trust level
        match level:
            case TrustLevel.RULE_ONLY:
                result = await self._rule_only(input_data, rule_fn)
            case TrustLevel.RULE_PRIMARY:
                result = await self._rule_primary(input_data, rule_fn, ai_fn)
            case TrustLevel.AI_PRIMARY:
                result = await self._ai_primary(input_data, rule_fn, ai_fn)
            case TrustLevel.AI_ONLY:
                result = await self._ai_only(input_data, ai_fn)
            case _:
                result = await self._rule_primary(input_data, rule_fn, ai_fn)

        result.latency_ms = (time.time() - start) * 1000
        return result

    async def _rule_only(self, input_data: Any, rule_fn: Optional[Callable]) -> HybridResult:
        """100% rule engine — AI never called."""
        if rule_fn is None:
            raise ValueError("rule_fn required for RULE_ONLY trust level")

        value = rule_fn(input_data)
        return HybridResult(value=value, source="rule", confidence=1.0)

    async def _rule_primary(
        self, input_data: Any, rule_fn: Optional[Callable], ai_fn: Optional[Callable]
    ) -> HybridResult:
        """Rule decides, AI validates (optional)."""
        if rule_fn is None:
            raise ValueError("rule_fn required for RULE_PRIMARY trust level")

        rule_value = rule_fn(input_data)

        # If AI available, use for validation
        if ai_fn:
            try:
                ai_value = await ai_fn(input_data)
                disagreement = rule_value != ai_value

                if disagreement:
                    self._disagreement_count += 1
                    logger.info(
                        f"[Hybrid] Disagreement ({self.product}): "
                        f"rule={rule_value}, ai={ai_value}. Using RULE."
                    )

                return HybridResult(
                    value=rule_value,  # Rule wins
                    source="rule" if not disagreement else "hybrid",
                    confidence=0.95 if not disagreement else 0.8,
                    disagreement=disagreement,
                    rule_value=rule_value,
                    ai_value=ai_value,
                )
            except Exception as e:
                logger.debug(f"[Hybrid] AI validation failed (non-blocking): {e}")

        return HybridResult(value=rule_value, source="rule", confidence=0.9)

    async def _ai_primary(
        self, input_data: Any, rule_fn: Optional[Callable], ai_fn: Optional[Callable]
    ) -> HybridResult:
        """AI decides, rule validates (if available)."""
        if ai_fn is None:
            raise ValueError("ai_fn required for AI_PRIMARY trust level")

        ai_value = await ai_fn(input_data)

        # If rule available, validate
        if rule_fn:
            try:
                rule_value = rule_fn(input_data)
                disagreement = rule_value != ai_value

                if disagreement:
                    self._disagreement_count += 1
                    logger.info(
                        f"[Hybrid] Disagreement ({self.product}): "
                        f"ai={ai_value}, rule={rule_value}. Using AI."
                    )

                return HybridResult(
                    value=ai_value,  # AI wins
                    source="ai" if not disagreement else "hybrid",
                    confidence=0.85 if not disagreement else 0.7,
                    disagreement=disagreement,
                    rule_value=rule_value,
                    ai_value=ai_value,
                )
            except Exception:
                pass

        return HybridResult(value=ai_value, source="ai", confidence=0.8)

    async def _ai_only(self, input_data: Any, ai_fn: Optional[Callable]) -> HybridResult:
        """100% AI — rule engine not used."""
        if ai_fn is None:
            raise ValueError("ai_fn required for AI_ONLY trust level")

        value = await ai_fn(input_data)
        return HybridResult(value=value, source="ai", confidence=0.75)

    def _resolve_trust_level(
        self, override: Optional[str], task_type: Optional[str]
    ) -> TrustLevel:
        """Resolve trust level from override or config."""
        if override:
            if isinstance(override, TrustLevel):
                return override
            try:
                return TrustLevel(override)
            except ValueError:
                pass

        if task_type and task_type in self._config:
            return self._config[task_type]

        return TrustLevel.RULE_PRIMARY  # Safe default

    def get_stats(self) -> Dict:
        """Get hybrid engine statistics."""
        return {
            "product": self.product,
            "total_decisions": self._total_decisions,
            "disagreements": self._disagreement_count,
            "disagreement_rate": (
                self._disagreement_count / max(self._total_decisions, 1)
            ),
        }
