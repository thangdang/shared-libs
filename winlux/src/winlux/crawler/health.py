"""Crawl health tracking per source.

Tracks success/failure per source in MongoDB.
Marks sources as "degraded" after 3+ consecutive failures.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)

DEGRADED_THRESHOLD = 3


class CrawlHealthTracker:
    """Tracks crawl health metrics per source in MongoDB."""

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize health tracker.

        Args:
            db: Motor async MongoDB database instance.
        """
        self._collection = db["crawl_health"]

    async def record_success(self, source_id: str) -> None:
        """Record a successful crawl for a source.

        Resets consecutive failure count and updates last success time.

        Args:
            source_id: The crawl source identifier.
        """
        now = datetime.now(timezone.utc)
        await self._collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "source_id": source_id,
                    "last_success": now,
                    "consecutive_failures": 0,
                    "status": "healthy",
                    "updated_at": now,
                },
                "$inc": {"total_successes": 1},
                "$setOnInsert": {"created_at": now, "total_failures": 0},
            },
            upsert=True,
        )

    async def record_failure(self, source_id: str, error: str = "") -> None:
        """Record a failed crawl for a source.

        Increments consecutive failure count. Marks as degraded after
        3+ consecutive failures.

        Args:
            source_id: The crawl source identifier.
            error: Error message for logging.
        """
        now = datetime.now(timezone.utc)

        # Get current state to determine new status
        doc = await self._collection.find_one({"source_id": source_id})
        current_failures = (doc.get("consecutive_failures", 0) if doc else 0) + 1
        status = "degraded" if current_failures >= DEGRADED_THRESHOLD else "healthy"

        await self._collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "source_id": source_id,
                    "consecutive_failures": current_failures,
                    "last_error": error,
                    "last_failure": now,
                    "status": status,
                    "updated_at": now,
                },
                "$inc": {"total_failures": 1},
                "$setOnInsert": {
                    "created_at": now,
                    "total_successes": 0,
                    "last_success": None,
                },
            },
            upsert=True,
        )

        if status == "degraded":
            logger.warning(
                f"Source '{source_id}' marked as degraded "
                f"({current_failures} consecutive failures)"
            )

    async def get_health(self, source_id: str) -> Optional[dict]:
        """Get health status for a specific source.

        Args:
            source_id: The crawl source identifier.

        Returns:
            Health document or None if source not tracked yet.
        """
        return await self._collection.find_one(
            {"source_id": source_id}, {"_id": 0}
        )

    async def get_health_summary(self) -> List[dict]:
        """Get health summary for all tracked sources.

        Returns:
            List of dicts with per-source: source_id, status,
            success_rate, last_success, consecutive_failures.
        """
        cursor = self._collection.find({}, {"_id": 0})
        results = []

        async for doc in cursor:
            total = doc.get("total_successes", 0) + doc.get("total_failures", 0)
            success_rate = (
                doc.get("total_successes", 0) / total if total > 0 else 0.0
            )
            results.append({
                "source_id": doc["source_id"],
                "status": doc.get("status", "unknown"),
                "success_rate": round(success_rate, 3),
                "last_success": doc.get("last_success"),
                "consecutive_failures": doc.get("consecutive_failures", 0),
            })

        return results

    async def is_degraded(self, source_id: str) -> bool:
        """Check if a source is currently degraded.

        Args:
            source_id: The crawl source identifier.

        Returns:
            True if source has 3+ consecutive failures.
        """
        doc = await self._collection.find_one({"source_id": source_id})
        if not doc:
            return False
        return doc.get("status") == "degraded"
