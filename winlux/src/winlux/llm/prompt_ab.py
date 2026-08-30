"""Prompt A/B testing — track variant performance across products.

Logs each LLM call with prompt version info, then correlates with
downstream outcome scores to identify which prompt variant performs better.

Supports:
    - Multiple concurrent variants per (product, task_type)
    - Random 50/50 split or weighted selection by historical scores
    - Deferred outcome recording (score set after content is published)

MongoDB collection: `prompt_ab_logs`

Usage:
    from winlux.llm.prompt_ab import PromptABTracker, PromptVariant

    tracker = PromptABTracker(db=mongo_db)

    # Register variants
    tracker.register_variant(PromptVariant(
        variant_id="script_v2",
        prompt_template="Write a viral script about {topic}...",
        version="2.0",
    ))

    # Select variant + log the call
    log_id = tracker.log_call(
        product="childhood",
        task_type="script_writing",
        prompt_version="script_v2",
        model_used="qwen3:8b",
        latency_ms=1200,
    )

    # Later, after content is published and metrics come in:
    tracker.record_outcome(log_id, score=0.85)

    # Compare variants
    stats = tracker.get_variant_stats("childhood", "script_writing")
"""

import logging
import random
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from bson import ObjectId

logger = logging.getLogger(__name__)


@dataclass
class PromptVariant:
    """A prompt variant for A/B testing.

    Attributes:
        variant_id: Unique identifier (e.g., "script_v2", "hook_concise").
        prompt_template: The prompt template string.
        version: Semantic version (e.g., "1.0", "2.1").
        weight: Selection weight for weighted mode (default 1.0 = equal).
        active: Whether this variant is currently in the experiment.
    """

    variant_id: str
    prompt_template: str
    version: str
    weight: float = 1.0
    active: bool = True
    metadata: Dict[str, Any] = field(default_factory=dict)


class PromptABTracker:
    """Tracks prompt variant performance via A/B split logging.

    Stores logs in MongoDB collection `prompt_ab_logs`.
    Each log entry captures the variant used, model, latency, and
    an optional outcome_score that gets set after content performance
    is measured.

    Selection modes:
        - "random": Pure 50/50 (or equal split for >2 variants)
        - "weighted": Weighted by historical outcome scores
    """

    COLLECTION = "prompt_ab_logs"

    def __init__(self, db=None):
        """Initialize the A/B tracker.

        Args:
            db: pymongo Database instance.  If None, logs to stdout only.
        """
        self._db = db
        self._variants: Dict[str, Dict[str, PromptVariant]] = {}
        # Key: (product, task_type) → {variant_id: PromptVariant}

    def register_variant(
        self,
        product: str,
        task_type: str,
        variant: PromptVariant,
    ) -> None:
        """Register a prompt variant for a product/task_type pair.

        Args:
            product: Product name (e.g., "childhood", "caremate").
            task_type: Task identifier (e.g., "script_writing").
            variant: PromptVariant instance to register.
        """
        key = f"{product.lower()}:{task_type}"
        if key not in self._variants:
            self._variants[key] = {}
        self._variants[key][variant.variant_id] = variant
        logger.info(
            f"Registered variant '{variant.variant_id}' v{variant.version} "
            f"for {product}/{task_type}"
        )

    def select_variant(
        self,
        product: str,
        task_type: str,
        mode: str = "random",
    ) -> Optional[PromptVariant]:
        """Select a variant for the next LLM call.

        Args:
            product: Product name.
            task_type: Task identifier.
            mode: Selection mode — "random" or "weighted".

        Returns:
            Selected PromptVariant, or None if no variants registered.
        """
        key = f"{product.lower()}:{task_type}"
        variants = self._variants.get(key, {})

        # Filter active variants only
        active = [v for v in variants.values() if v.active]
        if not active:
            return None

        if mode == "weighted":
            return self._weighted_select(active, product, task_type)
        else:
            return random.choice(active)

    def _weighted_select(
        self,
        variants: List[PromptVariant],
        product: str,
        task_type: str,
    ) -> PromptVariant:
        """Select variant weighted by historical outcome scores.

        Variants with higher avg outcome scores get proportionally
        more traffic.  Falls back to equal weight if no scores exist.
        """
        weights: List[float] = []

        for variant in variants:
            stats = self._get_single_variant_stats(
                product, task_type, variant.variant_id
            )
            avg_score = stats.get("avg_score", 0.0)
            # Use variant.weight as base, boost by historical performance
            # Minimum weight of 0.1 to ensure exploration
            effective_weight = max(0.1, variant.weight * (0.5 + avg_score))
            weights.append(effective_weight)

        # Weighted random selection
        total = sum(weights)
        r = random.uniform(0, total)
        cumulative = 0.0
        for i, w in enumerate(weights):
            cumulative += w
            if r <= cumulative:
                return variants[i]

        return variants[-1]  # Fallback

    def log_call(
        self,
        product: str,
        task_type: str,
        prompt_version: str,
        model_used: str,
        latency_ms: float,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Optional[str]:
        """Log an LLM call with prompt variant info.

        Args:
            product: Product name.
            task_type: Task identifier.
            prompt_version: Variant ID / version used.
            model_used: Model name (e.g., "qwen3:8b").
            latency_ms: Call latency in milliseconds.
            metadata: Optional extra context (topic, content_id, etc.).

        Returns:
            Log entry ID (str) for later outcome recording, or None if DB unavailable.
        """
        entry = {
            "product": product.lower(),
            "task_type": task_type,
            "prompt_version": prompt_version,
            "model_used": model_used,
            "latency_ms": round(latency_ms, 1),
            "outcome_score": None,  # Set later via record_outcome()
            "metadata": metadata or {},
            "created_at": datetime.now(timezone.utc),
            "scored_at": None,
        }

        if self._db is not None:
            try:
                collection = self._db[self.COLLECTION]
                result = collection.insert_one(entry)
                log_id = str(result.inserted_id)
                logger.debug(
                    f"AB log [{product}/{task_type}] variant={prompt_version} "
                    f"model={model_used} latency={latency_ms:.0f}ms id={log_id}"
                )
                return log_id
            except Exception as e:
                logger.error(f"Failed to log prompt AB entry: {e}")
                return None
        else:
            logger.info(
                f"AB log [{product}/{task_type}] variant={prompt_version} "
                f"model={model_used} latency={latency_ms:.0f}ms (no DB)"
            )
            return None

    def record_outcome(self, log_id: str, score: float) -> bool:
        """Record the outcome score for a previously logged call.

        Called after content is published and performance metrics are available.

        Args:
            log_id: The log entry ID returned by log_call().
            score: Outcome score 0.0–1.0 (e.g., engagement rate, quality score).

        Returns:
            True if updated successfully, False otherwise.
        """
        if self._db is None:
            logger.warning("Cannot record outcome — no DB connection")
            return False

        score = max(0.0, min(1.0, score))  # Clamp to [0, 1]

        try:
            collection = self._db[self.COLLECTION]
            result = collection.update_one(
                {"_id": ObjectId(log_id)},
                {
                    "$set": {
                        "outcome_score": score,
                        "scored_at": datetime.now(timezone.utc),
                    }
                },
            )
            if result.modified_count > 0:
                logger.debug(f"Recorded outcome score={score:.3f} for log={log_id}")
                return True
            else:
                logger.warning(f"No log entry found for id={log_id}")
                return False
        except Exception as e:
            logger.error(f"Failed to record outcome: {e}")
            return False

    def get_variant_stats(
        self,
        product: str,
        task_type: str,
        days: int = 30,
    ) -> Dict[str, Any]:
        """Get performance stats for all variants of a product/task_type.

        Args:
            product: Product name.
            task_type: Task identifier.
            days: Look-back window in days.

        Returns:
            Dict with per-variant stats:
            {
                "variants": {
                    "script_v1": {"count": 50, "scored": 40, "avg_score": 0.72, "avg_latency_ms": 1100},
                    "script_v2": {"count": 48, "scored": 38, "avg_score": 0.81, "avg_latency_ms": 1250},
                },
                "winner": "script_v2",
                "confidence": "high",  # high if >30 scored samples per variant
            }
        """
        if self._db is None:
            return {"variants": {}, "winner": None, "confidence": "none"}

        from datetime import timedelta

        since = datetime.now(timezone.utc) - timedelta(days=days)

        try:
            collection = self._db[self.COLLECTION]
            pipeline = [
                {
                    "$match": {
                        "product": product.lower(),
                        "task_type": task_type,
                        "created_at": {"$gte": since},
                    }
                },
                {
                    "$group": {
                        "_id": "$prompt_version",
                        "count": {"$sum": 1},
                        "scored": {
                            "$sum": {"$cond": [{"$ne": ["$outcome_score", None]}, 1, 0]}
                        },
                        "total_score": {
                            "$sum": {"$ifNull": ["$outcome_score", 0]}
                        },
                        "avg_latency_ms": {"$avg": "$latency_ms"},
                    }
                },
            ]

            results = list(collection.aggregate(pipeline))

            variants_stats: Dict[str, Dict] = {}
            best_variant = None
            best_score = -1.0

            for row in results:
                variant_id = row["_id"]
                scored = row["scored"]
                avg_score = row["total_score"] / max(scored, 1)

                variants_stats[variant_id] = {
                    "count": row["count"],
                    "scored": scored,
                    "avg_score": round(avg_score, 4),
                    "avg_latency_ms": round(row["avg_latency_ms"], 1),
                }

                if avg_score > best_score and scored >= 5:
                    best_score = avg_score
                    best_variant = variant_id

            # Confidence based on sample size
            min_scored = min(
                (v["scored"] for v in variants_stats.values()), default=0
            )
            if min_scored >= 30:
                confidence = "high"
            elif min_scored >= 10:
                confidence = "medium"
            elif min_scored >= 5:
                confidence = "low"
            else:
                confidence = "insufficient"

            return {
                "variants": variants_stats,
                "winner": best_variant,
                "confidence": confidence,
            }

        except Exception as e:
            logger.error(f"Failed to get variant stats: {e}")
            return {"variants": {}, "winner": None, "confidence": "error"}

    def _get_single_variant_stats(
        self,
        product: str,
        task_type: str,
        variant_id: str,
    ) -> Dict[str, float]:
        """Get stats for a single variant (used internally for weighted selection).

        Returns:
            Dict with avg_score and count.
        """
        if self._db is None:
            return {"avg_score": 0.0, "count": 0}

        from datetime import timedelta

        since = datetime.now(timezone.utc) - timedelta(days=14)

        try:
            collection = self._db[self.COLLECTION]
            pipeline = [
                {
                    "$match": {
                        "product": product.lower(),
                        "task_type": task_type,
                        "prompt_version": variant_id,
                        "outcome_score": {"$ne": None},
                        "created_at": {"$gte": since},
                    }
                },
                {
                    "$group": {
                        "_id": None,
                        "avg_score": {"$avg": "$outcome_score"},
                        "count": {"$sum": 1},
                    }
                },
            ]

            results = list(collection.aggregate(pipeline))
            if results:
                return {
                    "avg_score": results[0]["avg_score"] or 0.0,
                    "count": results[0]["count"],
                }
            return {"avg_score": 0.0, "count": 0}

        except Exception:
            return {"avg_score": 0.0, "count": 0}

    def ensure_indexes(self) -> None:
        """Create MongoDB indexes for efficient querying.

        Call once during app startup.
        """
        if self._db is None:
            return

        collection = self._db[self.COLLECTION]
        collection.create_index(
            [("product", 1), ("task_type", 1), ("created_at", -1)],
            name="idx_product_task_time",
        )
        collection.create_index(
            [("product", 1), ("task_type", 1), ("prompt_version", 1), ("outcome_score", 1)],
            name="idx_variant_scores",
        )
        collection.create_index(
            [("created_at", 1)],
            name="idx_ttl_cleanup",
            expireAfterSeconds=90 * 86400,  # 90 days retention
        )
        logger.info(f"Ensured indexes on {self.COLLECTION}")
