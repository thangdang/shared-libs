"""Vietnamese few-shot example system — auto-learning from successful outputs.

Stores and retrieves per-product per-task few-shot examples.
Auto-updates from validated AI outputs and user feedback.
Caps at 20 examples per task type (keeps best by quality_score).

Usage:
    fs = FewShotManager(product="caremate", db=mongo_db)
    examples = await fs.get_examples(task_type="severity_scoring", limit=3)
    await fs.add_example(task_type="severity_scoring", input_vi=..., output=..., quality_score=0.9)
"""

import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# Max examples per task type
MAX_EXAMPLES_PER_TASK = 20
DEFAULT_FETCH_LIMIT = 3


class FewShotManager:
    """Manages few-shot examples for Vietnamese LLM prompts.

    Stores examples in MongoDB collection `ai_few_shot_examples` within
    the product's database.  Retrieves top examples by quality_score.
    """

    def __init__(self, product: str, db):
        """Initialize.

        Args:
            product: Product name.
            db: MongoDB database instance.
        """
        self.product = product.lower()
        self._db = db
        self._collection = db.ai_few_shot_examples

    async def get_examples(
        self,
        task_type: str,
        limit: int = DEFAULT_FETCH_LIMIT,
    ) -> List[Dict]:
        """Get top few-shot examples for a task type.

        Args:
            task_type: Task identifier (e.g., "severity_scoring").
            limit: Max examples to return.

        Returns:
            List of dicts with input_vi and output fields.
        """
        try:
            examples = list(
                self._collection.find(
                    {"product": self.product, "task_type": task_type},
                    {"input_vi": 1, "output": 1, "quality_score": 1, "_id": 0},
                )
                .sort("quality_score", -1)
                .limit(limit)
            )
            return examples
        except Exception as e:
            logger.warning(f"[FewShot] Failed to get examples: {e}")
            return []

    async def add_example(
        self,
        task_type: str,
        input_vi: str,
        output: Dict,
        quality_score: float = 0.8,
        source: str = "auto",
    ) -> bool:
        """Add a new few-shot example.

        If collection exceeds MAX_EXAMPLES_PER_TASK for this task_type,
        removes the lowest quality example.

        Args:
            task_type: Task identifier.
            input_vi: Vietnamese input text.
            output: Expected output (dict).
            quality_score: Quality score 0.0-1.0.
            source: Where this example came from ("auto", "manual", "feedback").

        Returns:
            True if added successfully.
        """
        try:
            # Check existing count
            count = self._collection.count_documents(
                {"product": self.product, "task_type": task_type}
            )

            # If at cap, remove lowest quality
            if count >= MAX_EXAMPLES_PER_TASK:
                lowest = self._collection.find_one(
                    {"product": self.product, "task_type": task_type},
                    sort=[("quality_score", 1)],
                )
                if lowest and lowest.get("quality_score", 0) < quality_score:
                    self._collection.delete_one({"_id": lowest["_id"]})
                else:
                    # New example isn't better than worst existing
                    return False

            # Insert new example
            self._collection.insert_one({
                "product": self.product,
                "task_type": task_type,
                "input_vi": input_vi,
                "output": output,
                "quality_score": quality_score,
                "source": source,
                "created_at": datetime.now(timezone.utc),
            })

            logger.debug(
                f"[FewShot] Added example for {self.product}/{task_type} "
                f"(score={quality_score:.2f}, source={source})"
            )
            return True

        except Exception as e:
            logger.error(f"[FewShot] Failed to add example: {e}")
            return False

    async def update_score(
        self,
        task_type: str,
        input_vi: str,
        new_score: float,
    ) -> bool:
        """Update quality score for an existing example (from user feedback).

        Args:
            task_type: Task identifier.
            input_vi: Input text to match.
            new_score: Updated quality score.

        Returns:
            True if updated.
        """
        try:
            result = self._collection.update_one(
                {
                    "product": self.product,
                    "task_type": task_type,
                    "input_vi": input_vi,
                },
                {"$set": {"quality_score": new_score, "updated_at": datetime.now(timezone.utc)}},
            )
            return result.modified_count > 0
        except Exception as e:
            logger.warning(f"[FewShot] Failed to update score: {e}")
            return False

    def format_for_prompt(self, examples: List[Dict]) -> str:
        """Format examples into a prompt section.

        Args:
            examples: List from get_examples().

        Returns:
            Formatted string ready to inject into prompt.
        """
        if not examples:
            return ""

        lines = ["=== VÍ DỤ THAM KHẢO ==="]
        for i, ex in enumerate(examples, 1):
            input_text = ex.get("input_vi", "")[:200]
            output_text = ex.get("output", {})
            if isinstance(output_text, dict):
                import json
                output_text = json.dumps(output_text, ensure_ascii=False)
            lines.append(f"Ví dụ {i}:")
            lines.append(f"  Input: {input_text}")
            lines.append(f"  Output: {output_text}")
        lines.append("")

        return "\n".join(lines)

    async def get_stats(self) -> Dict:
        """Get statistics for this product's few-shot examples."""
        try:
            pipeline = [
                {"$match": {"product": self.product}},
                {
                    "$group": {
                        "_id": "$task_type",
                        "count": {"$sum": 1},
                        "avg_score": {"$avg": "$quality_score"},
                    }
                },
                {"$sort": {"count": -1}},
            ]
            results = list(self._collection.aggregate(pipeline))
            return {
                "product": self.product,
                "task_types": {
                    r["_id"]: {"count": r["count"], "avg_score": round(r["avg_score"], 2)}
                    for r in results
                },
                "total_examples": sum(r["count"] for r in results),
            }
        except Exception as e:
            return {"product": self.product, "error": str(e)}
