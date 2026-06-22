"""Model router — routes tasks to the optimal model based on complexity.

Rule-based routing (zero overhead) that selects the cheapest model
capable of handling each task type.  No ML, just config-driven rules.

Routing strategy:
    SIMPLE (≤100 tokens, classification)  → qwen2.5:1.5b (fast, cheap)
    MEDIUM (analysis, summarization)      → qwen2.5:7b (balanced)
    COMPLEX (reasoning, multi-step)       → qwen3:8b (best quality)
    THINKING (deep reasoning needed)      → qwen3:8b /think mode
    CREATIVE (script, content gen)        → qwen3:8b (quality matters)
    FALLBACK (external, overflow)         → groq:qwen3-235b-a22b

Usage:
    router = ModelRouter(product="childhood")
    model = router.get_model(task_type="topic_scoring", max_tokens=50)
    # Returns: "qwen2.5:1.5b"
"""

import logging
from dataclasses import dataclass
from enum import Enum
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class Complexity(Enum):
    """Task complexity levels."""
    SIMPLE = "simple"       # Classification, scoring, yes/no
    MEDIUM = "medium"       # Summarization, extraction, moderate analysis
    COMPLEX = "complex"     # Multi-step reasoning, diagnosis
    THINKING = "thinking"   # Deep reasoning (uses /think mode)
    CREATIVE = "creative"   # Content generation, script writing


@dataclass
class ModelSelection:
    """Model selection result."""
    model: str
    complexity: Complexity
    thinking_mode: bool
    timeout_seconds: float
    reason: str


# Model capabilities
MODELS = {
    "qwen2.5:1.5b": {"speed": "fast", "quality": "basic", "ram_gb": 2, "tokens_per_sec": 80},
    "qwen2.5:7b": {"speed": "medium", "quality": "good", "ram_gb": 6, "tokens_per_sec": 40},
    "qwen3:8b": {"speed": "medium", "quality": "excellent", "ram_gb": 8, "tokens_per_sec": 35},
    "groq:qwen3-235b-a22b": {"speed": "fast", "quality": "best", "ram_gb": 0, "tokens_per_sec": 100},
}

# Per-product task → complexity mapping
PRODUCT_TASK_CONFIG: Dict[str, Dict[str, Complexity]] = {
    "childhood": {
        "topic_scoring": Complexity.SIMPLE,
        "hook_scoring": Complexity.SIMPLE,
        "seo_tags": Complexity.SIMPLE,
        "trend_analysis": Complexity.MEDIUM,
        "content_planning": Complexity.THINKING,
        "script_writing": Complexity.CREATIVE,
        "quality_gate": Complexity.MEDIUM,
        "humanization": Complexity.CREATIVE,
        "channel_strategy": Complexity.MEDIUM,
    },
    "caremate": {
        "intent_classification": Complexity.SIMPLE,
        "severity_scoring": Complexity.SIMPLE,
        "symptom_extraction": Complexity.MEDIUM,
        "symptom_analysis": Complexity.THINKING,
        "drug_check": Complexity.SIMPLE,
        "response_generation": Complexity.COMPLEX,
        "article_summary": Complexity.MEDIUM,
    },
    "fintax": {
        "income_classification": Complexity.MEDIUM,
        "deduction_validation": Complexity.SIMPLE,
        "tax_explanation": Complexity.COMPLEX,
        "document_extraction": Complexity.MEDIUM,
        "anomaly_detection": Complexity.MEDIUM,
    },
    "smartbuy": {
        "query_intent": Complexity.SIMPLE,
        "product_categorization": Complexity.SIMPLE,
        "comparison_text": Complexity.MEDIUM,
        "review_summary": Complexity.MEDIUM,
        "recommendation": Complexity.MEDIUM,
    },
    "trendbriefai": {
        "article_categorization": Complexity.SIMPLE,
        "trend_scoring": Complexity.SIMPLE,
        "summarization": Complexity.MEDIUM,
        "title_generation": Complexity.SIMPLE,
        "deep_analysis": Complexity.COMPLEX,
    },
    "doctorcar": {
        "symptom_extraction": Complexity.MEDIUM,
        "severity_assessment": Complexity.MEDIUM,
        "diagnosis_reasoning": Complexity.THINKING,
        "cost_estimation": Complexity.SIMPLE,
        "content_generation": Complexity.CREATIVE,
        "safety_check": Complexity.SIMPLE,
    },
}


class ModelRouter:
    """Routes tasks to the optimal LLM model based on complexity.

    Zero overhead — pure config lookup, no ML classification.
    """

    def __init__(self, product: str, custom_config: Optional[Dict] = None):
        """Initialize router for a specific product.

        Args:
            product: Product name (childhood, caremate, fintax, etc.)
            custom_config: Override task→complexity mapping.
        """
        self.product = product.lower()
        self._config = custom_config or PRODUCT_TASK_CONFIG.get(self.product, {})

    def get_model(
        self,
        task_type: str,
        max_tokens: int = 500,
        force_complexity: Optional[Complexity] = None,
    ) -> ModelSelection:
        """Select the optimal model for a task.

        Args:
            task_type: Task identifier (e.g., "topic_scoring", "diagnosis_reasoning").
            max_tokens: Expected output tokens.
            force_complexity: Override auto-detection.

        Returns:
            ModelSelection with model name, timeout, and reasoning.
        """
        # Determine complexity
        if force_complexity:
            complexity = force_complexity
        elif task_type in self._config:
            complexity = self._config[task_type]
        else:
            # Auto-classify based on token count
            complexity = self._auto_classify(max_tokens)

        # Map complexity to model
        model, thinking, timeout = self._select_model(complexity, max_tokens)

        selection = ModelSelection(
            model=model,
            complexity=complexity,
            thinking_mode=thinking,
            timeout_seconds=timeout,
            reason=f"{task_type} → {complexity.value} → {model}",
        )

        logger.debug(f"Model routing: {selection.reason}")
        return selection

    def _auto_classify(self, max_tokens: int) -> Complexity:
        """Auto-classify complexity based on output token count."""
        if max_tokens <= 50:
            return Complexity.SIMPLE
        elif max_tokens <= 300:
            return Complexity.MEDIUM
        elif max_tokens <= 1000:
            return Complexity.COMPLEX
        else:
            return Complexity.CREATIVE

    def _select_model(self, complexity: Complexity, max_tokens: int) -> tuple:
        """Map complexity to model, thinking mode, and timeout.

        Returns:
            Tuple of (model_name, thinking_mode, timeout_seconds)
        """
        match complexity:
            case Complexity.SIMPLE:
                return ("qwen2.5:1.5b", False, 5.0)
            case Complexity.MEDIUM:
                return ("qwen2.5:7b", False, 15.0)
            case Complexity.COMPLEX:
                return ("qwen3:8b", False, 30.0)
            case Complexity.THINKING:
                return ("qwen3:8b", True, 60.0)
            case Complexity.CREATIVE:
                return ("qwen3:8b", False, 45.0)
            case _:
                return ("qwen2.5:7b", False, 15.0)

    def get_all_tasks(self) -> Dict[str, Complexity]:
        """Return all configured tasks for this product."""
        return dict(self._config)

    def get_model_stats(self) -> Dict:
        """Return model usage distribution for this product's config."""
        stats = {"qwen2.5:1.5b": 0, "qwen2.5:7b": 0, "qwen3:8b": 0}
        for task_type, complexity in self._config.items():
            model, _, _ = self._select_model(complexity, 500)
            stats[model] = stats.get(model, 0) + 1
        return stats
