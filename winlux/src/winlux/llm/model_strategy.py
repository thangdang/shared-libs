"""Model Strategy — YAML-driven model routing for all products.

Loads per-product YAML config files that define task→model mappings,
hybrid engine trust levels, cache TTLs, and sensitivity routing.

Extends ModelRouter with YAML configuration support.

Usage:
    from winlux.llm.model_strategy import ModelStrategy

    strategy = ModelStrategy(product="smartbuy")
    model_name = strategy.get_model("query_intent", max_tokens=100)
    # Returns: "qwen2.5:1.5b"

    trust_level = strategy.get_trust_level("pricing")
    # Returns: "rule_only"

    cache_ttl = strategy.get_cache_ttl("query_intent")
    # Returns: 86400
"""

import logging
from pathlib import Path
from typing import Dict, Optional, Any

from winlux.llm.model_router import ModelRouter, ModelSelection, Complexity

logger = logging.getLogger(__name__)

# Config directory (relative to this file)
CONFIGS_DIR = Path(__file__).parent / "configs"

# Complexity string → enum mapping
COMPLEXITY_MAP = {
    "simple": Complexity.SIMPLE,
    "medium": Complexity.MEDIUM,
    "complex": Complexity.COMPLEX,
    "thinking": Complexity.THINKING,
    "creative": Complexity.CREATIVE,
}


def _load_yaml(path: Path) -> Dict:
    """Load YAML file. Uses PyYAML if available, else basic parser."""
    try:
        import yaml
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)
    except ImportError:
        # Fallback: basic YAML-like parser for simple configs
        return _parse_simple_yaml(path)


def _parse_simple_yaml(path: Path) -> Dict:
    """Minimal YAML parser for flat key-value configs (no library dependency)."""
    result = {}
    current_section = None
    current_task = None

    with open(path, "r", encoding="utf-8") as f:
        for line in f:
            stripped = line.rstrip()
            if not stripped or stripped.startswith("#"):
                continue

            indent = len(line) - len(line.lstrip())

            if indent == 0 and ":" in stripped:
                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if value:
                    result[key] = value
                else:
                    result[key] = {}
                    current_section = key
                    current_task = None

            elif indent == 2 and current_section and ":" in stripped:
                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                if value:
                    if isinstance(result[current_section], dict):
                        result[current_section][key] = value
                else:
                    if isinstance(result[current_section], dict):
                        result[current_section][key] = {}
                    current_task = key

            elif indent == 4 and current_section and current_task and ":" in stripped:
                key, _, value = stripped.partition(":")
                key = key.strip()
                value = value.strip().strip('"').strip("'")
                section_data = result.get(current_section, {})
                if isinstance(section_data, dict) and current_task in section_data:
                    task_data = section_data[current_task]
                    if isinstance(task_data, dict):
                        # Type conversion
                        if value.isdigit():
                            value = int(value)
                        elif value in ("true", "True"):
                            value = True
                        elif value in ("false", "False"):
                            value = False
                        task_data[key] = value

    return result


class ModelStrategy:
    """YAML-driven model strategy for a specific product.

    Combines:
    - Model routing (task → model)
    - Hybrid engine trust levels (task → rule_only/rule_primary/ai_primary/ai_only)
    - Cache TTLs (task → seconds)
    - Sensitivity routing (task → high/medium/low)
    """

    def __init__(self, product: str, config_path: Optional[Path] = None):
        """Initialize strategy from YAML config.

        Args:
            product: Product name (smartbuy, caremate, fintax, etc.)
            config_path: Custom config file path. If None, loads from configs/{product}.yaml.
        """
        self.product = product.lower()
        self._config: Dict[str, Any] = {}
        self._tasks: Dict[str, Dict] = {}
        self._hybrid_rules: Dict[str, str] = {}
        self._cache_ttls: Dict[str, int] = {}
        self._sensitivity: Dict[str, str] = {}

        # Load config
        path = config_path or (CONFIGS_DIR / f"{self.product}.yaml")
        if path.exists():
            self._config = _load_yaml(path)
            self._tasks = self._config.get("tasks", {})
            self._hybrid_rules = self._config.get("hybrid_rules", {})
            self._cache_ttls = self._config.get("cache_ttl", {})
            self._sensitivity = self._config.get("sensitivity", {})
            logger.info(f"Loaded model strategy for '{product}' ({len(self._tasks)} tasks)")
        else:
            logger.warning(f"No config found at {path}, using defaults")

        # Build ModelRouter with task→complexity mapping from YAML
        task_complexity = {}
        for task_name, task_config in self._tasks.items():
            if isinstance(task_config, dict):
                complexity_str = task_config.get("complexity", "medium")
                task_complexity[task_name] = COMPLEXITY_MAP.get(complexity_str, Complexity.MEDIUM)

        self._router = ModelRouter(product=product, custom_config=task_complexity)

    def get_model(self, task_type: str, max_tokens: int = 500) -> str:
        """Get the optimal model for a task.

        Args:
            task_type: Task identifier.
            max_tokens: Expected output size.

        Returns:
            Model name string (e.g., "qwen2.5:1.5b").
        """
        # Check YAML config first for explicit model override
        task_config = self._tasks.get(task_type, {})
        if isinstance(task_config, dict) and "model" in task_config:
            return task_config["model"]

        # Fall back to ModelRouter logic
        selection = self._router.get_model(task_type, max_tokens)
        return selection.model

    def get_model_selection(self, task_type: str, max_tokens: int = 500) -> ModelSelection:
        """Get full model selection details for a task.

        Returns:
            ModelSelection with model, complexity, timeout, reasoning.
        """
        task_config = self._tasks.get(task_type, {})
        if isinstance(task_config, dict) and "model" in task_config:
            complexity_str = task_config.get("complexity", "medium")
            complexity = COMPLEXITY_MAP.get(complexity_str, Complexity.MEDIUM)
            thinking = task_config.get("thinking_mode", False)
            timeout = task_config.get("timeout", 15)

            return ModelSelection(
                model=task_config["model"],
                complexity=complexity,
                thinking_mode=thinking,
                timeout_seconds=float(timeout),
                reason=f"YAML config: {task_type} → {task_config['model']}",
            )

        return self._router.get_model(task_type, max_tokens)

    def get_trust_level(self, task_type: str) -> str:
        """Get hybrid engine trust level for a task.

        Returns:
            One of: "rule_only", "rule_primary", "ai_primary", "ai_only"
        """
        return self._hybrid_rules.get(task_type, "ai_primary")

    def get_cache_ttl(self, task_type: str) -> int:
        """Get cache TTL (seconds) for a task.

        Returns:
            TTL in seconds. 0 means never cache.
        """
        ttl = self._cache_ttls.get(task_type, 86400)
        if isinstance(ttl, str):
            return int(ttl)
        return ttl

    def get_sensitivity(self, task_type: str) -> str:
        """Get sensitivity level for a task (affects provider routing).

        Returns:
            One of: "high" (Ollama only), "medium" (prefer Ollama), "low" (any provider)
        """
        return self._sensitivity.get(task_type, "low")

    def is_thinking_mode(self, task_type: str) -> bool:
        """Check if a task should use /think mode."""
        task_config = self._tasks.get(task_type, {})
        if isinstance(task_config, dict):
            return task_config.get("thinking_mode", False)
        return False

    def get_timeout(self, task_type: str) -> float:
        """Get timeout for a task."""
        task_config = self._tasks.get(task_type, {})
        if isinstance(task_config, dict):
            return float(task_config.get("timeout", 15))
        return 15.0

    def get_all_tasks(self) -> Dict[str, Dict]:
        """Return all configured tasks with their settings."""
        return dict(self._tasks)

    def get_stats(self) -> Dict:
        """Return strategy stats for monitoring."""
        model_counts: Dict[str, int] = {}
        for task_name, task_config in self._tasks.items():
            if isinstance(task_config, dict):
                model = task_config.get("model", "unknown")
                model_counts[model] = model_counts.get(model, 0) + 1

        return {
            "product": self.product,
            "total_tasks": len(self._tasks),
            "model_distribution": model_counts,
            "hybrid_rules": len(self._hybrid_rules),
            "cached_tasks": sum(1 for ttl in self._cache_ttls.values() if ttl and int(ttl) > 0),
        }
