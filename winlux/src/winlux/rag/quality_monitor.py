"""RAG Quality Monitor — Tasks 45-49.

Logs RAG queries, detects low relevance, tracks hallucination rate,
supports user feedback and A/B testing.
"""

import logging
import os
import time
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

# A/B testing flag
RAG_ENABLED = os.getenv("RAG_ENABLED", "true").lower() == "true"


class RAGQualityMonitor:
    """Monitor and log RAG pipeline quality metrics.

    Tracks:
    - Query logs (latency, retrieved docs, validation results)
    - Relevance alerts (top-1 score < 0.5)
    - Hallucination detection rate
    - User feedback (positive/negative)
    """

    def __init__(self, db=None, engine_name: str = "unknown"):
        self._db = db
        self._engine = engine_name
        self._low_relevance_count = 0
        self._total_queries = 0
        self._hallucination_count = 0

    def set_db(self, db):
        self._db = db

    async def log_query(
        self,
        query: str,
        intent: str,
        retrieved_ids: list[str],
        retrieved_scores: list[float],
        response_length: int,
        latency_ms: dict,
        validation: dict,
    ) -> str | None:
        """Log a RAG query for quality monitoring (Task 45).

        Returns:
            rag_log_id (str) for feedback reference, or None if logging fails
        """
        self._total_queries += 1

        # Check relevance (Task 46)
        if retrieved_scores and retrieved_scores[0] < 0.5:
            self._low_relevance_count += 1
            logger.warning(
                "Low relevance for query (top-1 score: %.3f): %s",
                retrieved_scores[0], query[:50],
            )

        # Track hallucination (Task 47)
        if not validation.get("valid", True):
            self._hallucination_count += 1

        # Log to database
        if not self._db:
            return None

        try:
            doc = {
                "engine": self._engine,
                "query_hash": hash(query) % (10**10),  # Don't store full query (privacy)
                "query_preview": query[:50],  # Truncated for debugging
                "intent": intent,
                "retrieved_ids": retrieved_ids[:10],
                "retrieved_scores": [round(s, 3) for s in retrieved_scores[:10]],
                "response_length": response_length,
                "latency_ms": latency_ms,
                "validation": validation,
                "created_at": datetime.now(timezone.utc),
            }
            result = await self._db.rag_logs.insert_one(doc)
            return str(result.inserted_id)
        except Exception as e:
            logger.debug("RAG log insert failed: %s", e)
            return None

    async def record_feedback(self, rag_log_id: str, rating: str, comment: str = "") -> bool:
        """Record user feedback for a RAG response (Task 48).

        Args:
            rag_log_id: ID from log_query
            rating: "positive" or "negative"
            comment: Optional user comment
        """
        if not self._db:
            return False

        try:
            from bson import ObjectId
            doc = {
                "rag_log_id": ObjectId(rag_log_id),
                "rating": rating,
                "comment": comment[:500],
                "created_at": datetime.now(timezone.utc),
            }
            await self._db.rag_feedback.insert_one(doc)
            return True
        except Exception as e:
            logger.debug("RAG feedback insert failed: %s", e)
            return False

    def get_metrics(self) -> dict:
        """Get current quality metrics."""
        total = max(self._total_queries, 1)
        return {
            "engine": self._engine,
            "total_queries": self._total_queries,
            "low_relevance_count": self._low_relevance_count,
            "low_relevance_rate": round(self._low_relevance_count / total, 3),
            "hallucination_count": self._hallucination_count,
            "hallucination_rate": round(self._hallucination_count / total, 3),
            "rag_enabled": RAG_ENABLED,
        }

    @staticmethod
    def is_rag_enabled() -> bool:
        """Check A/B testing flag (Task 49)."""
        return RAG_ENABLED
