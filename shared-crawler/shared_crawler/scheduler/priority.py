"""Priority-based crawl scheduler with Redis job queue.

Manages crawl jobs across all sources with priority ordering,
exponential backoff for failures, and auto-disable for persistently
failing sources.
"""

import logging
import time
from dataclasses import dataclass
from enum import IntEnum
from typing import List, Optional

import redis.asyncio as aioredis
from motor.motor_asyncio import AsyncIOMotorDatabase

logger = logging.getLogger(__name__)


class Priority(IntEnum):
    """Crawl priority levels with associated intervals."""

    CRITICAL = 4  # Every 30 min
    HIGH = 3      # Every 1 hour
    MEDIUM = 2    # Every 4 hours
    LOW = 1       # Every 12 hours


# Interval in seconds per priority level
PRIORITY_INTERVALS = {
    Priority.CRITICAL: 1800,    # 30 min
    Priority.HIGH: 3600,        # 1 hour
    Priority.MEDIUM: 14400,     # 4 hours
    Priority.LOW: 43200,        # 12 hours
}

# Auto-disable threshold
AUTO_DISABLE_FAIL_RATE = 0.5  # 50% failure rate over 24h
AUTO_DISABLE_MIN_ATTEMPTS = 10  # Minimum attempts before auto-disable

# Backoff settings
MAX_BACKOFF_MULTIPLIER = 8  # Max 8x the normal interval


@dataclass
class CrawlJob:
    """Represents a scheduled crawl job."""

    source_id: str
    url: str
    source_type: str  # rss | html | api | playwright
    priority: Priority
    interval_seconds: int
    next_run_at: float  # Unix timestamp
    last_success: Optional[float] = None
    last_attempt: Optional[float] = None
    consecutive_failures: int = 0
    enabled: bool = True
    product: str = ""  # smartbuy | trendbriefai | caremate

    @property
    def priority_score(self) -> int:
        """Score for sorting (higher = more urgent)."""
        return int(self.priority)

    @property
    def is_overdue(self) -> bool:
        """Check if this job is past its scheduled time."""
        return time.time() >= self.next_run_at


class CrawlScheduler:
    """Priority-based crawl scheduler with Redis job queue.

    Features:
    - Priority ordering (CRITICAL > HIGH > MEDIUM > LOW)
    - Exponential backoff for failed sources
    - Auto-disable sources with > 50% failure rate over 24h
    - Redis sorted set for efficient job queue
    - MongoDB for persistent source configs
    """

    def __init__(self, db: AsyncIOMotorDatabase, redis_url: str):
        """Initialize scheduler.

        Args:
            db: Motor async MongoDB database instance.
            redis_url: Redis connection URL.
        """
        self._db = db
        self._sources_collection = db["crawl_sources"]
        self._redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._redis

    def _priority_from_string(self, priority_str: str) -> Priority:
        """Convert string priority to enum.

        Args:
            priority_str: Priority string (critical/high/medium/low).

        Returns:
            Priority enum value.
        """
        mapping = {
            "critical": Priority.CRITICAL,
            "high": Priority.HIGH,
            "medium": Priority.MEDIUM,
            "low": Priority.LOW,
        }
        return mapping.get(priority_str.lower(), Priority.MEDIUM)

    async def load_jobs_from_db(self, product: Optional[str] = None) -> List[CrawlJob]:
        """Load all enabled crawl source configs as jobs.

        Args:
            product: Optional filter by product (smartbuy/trendbriefai/caremate).

        Returns:
            List of CrawlJob objects.
        """
        query = {"enabled": True}
        if product:
            query["product"] = product

        cursor = self._sources_collection.find(query)
        jobs = []

        async for doc in cursor:
            priority = self._priority_from_string(doc.get("priority", "medium"))
            interval = doc.get(
                "crawl_interval_seconds",
                PRIORITY_INTERVALS.get(priority, 3600),
            )

            # Calculate next run time
            last_success = doc.get("health", {}).get("last_success")
            last_success_ts = last_success.timestamp() if last_success else 0
            next_run = last_success_ts + interval

            jobs.append(CrawlJob(
                source_id=doc["source_id"],
                url=doc["url"],
                source_type=doc["type"],
                priority=priority,
                interval_seconds=interval,
                next_run_at=next_run,
                last_success=last_success_ts if last_success_ts > 0 else None,
                last_attempt=None,
                consecutive_failures=doc.get("health", {}).get("consecutive_failures", 0),
                enabled=doc.get("enabled", True),
                product=doc.get("product", ""),
            ))

        return jobs

    async def get_due_jobs(self, product: Optional[str] = None, limit: int = 20) -> List[CrawlJob]:
        """Get jobs that are due to run, sorted by priority.

        Args:
            product: Optional filter by product.
            limit: Maximum number of jobs to return.

        Returns:
            List of due CrawlJob objects, sorted by priority (highest first),
            then by staleness (longest since last success first).
        """
        all_jobs = await self.load_jobs_from_db(product)
        now = time.time()

        # Filter to due jobs only
        due_jobs = [j for j in all_jobs if j.is_overdue and j.enabled]

        # Sort: priority DESC, then staleness DESC (oldest first)
        due_jobs.sort(
            key=lambda j: (-j.priority_score, j.last_success or 0)
        )

        return due_jobs[:limit]

    async def report_success(self, source_id: str, items_count: int = 0) -> None:
        """Report successful crawl for a source.

        Resets backoff and updates health metrics.

        Args:
            source_id: Source identifier.
            items_count: Number of items crawled.
        """
        now = time.time()
        redis = await self._get_redis()

        # Reset consecutive failures
        await redis.delete(f"scheduler:backoff:{source_id}")

        # Update MongoDB health
        await self._sources_collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "health.last_success": now,
                    "health.consecutive_failures": 0,
                    "health.last_items_count": items_count,
                },
                "$inc": {"health.total_crawls": 1},
            },
        )

        # Track success in Redis (24h window for fail rate calculation)
        await redis.lpush(f"scheduler:results:{source_id}", f"s:{now}")
        await redis.ltrim(f"scheduler:results:{source_id}", 0, 99)
        await redis.expire(f"scheduler:results:{source_id}", 86400)

        logger.info(
            "Crawl success: source='%s', items=%d", source_id, items_count
        )

    async def report_failure(self, source_id: str, error: str = "") -> None:
        """Report failed crawl for a source.

        Applies exponential backoff and checks for auto-disable.

        Args:
            source_id: Source identifier.
            error: Error message.
        """
        now = time.time()
        redis = await self._get_redis()

        # Increment consecutive failures
        failures = await redis.incr(f"scheduler:backoff:{source_id}")
        await redis.expire(f"scheduler:backoff:{source_id}", 86400)

        # Update MongoDB
        await self._sources_collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "health.consecutive_failures": failures,
                    "health.last_error": error,
                    "health.last_failure": now,
                },
                "$inc": {"health.total_crawls": 1, "health.total_failures": 1},
            },
        )

        # Track failure in Redis
        await redis.lpush(f"scheduler:results:{source_id}", f"f:{now}")
        await redis.ltrim(f"scheduler:results:{source_id}", 0, 99)
        await redis.expire(f"scheduler:results:{source_id}", 86400)

        # Check auto-disable
        fail_rate = await self._get_fail_rate_24h(source_id)
        total_attempts = await redis.llen(f"scheduler:results:{source_id}")

        if (
            fail_rate > AUTO_DISABLE_FAIL_RATE
            and total_attempts >= AUTO_DISABLE_MIN_ATTEMPTS
        ):
            await self._auto_disable(source_id, fail_rate)

        logger.warning(
            "Crawl failure: source='%s', consecutive=%d, error='%s'",
            source_id, failures, error[:100],
        )

    async def _get_fail_rate_24h(self, source_id: str) -> float:
        """Calculate failure rate over last 24h.

        Args:
            source_id: Source identifier.

        Returns:
            Failure rate (0.0 to 1.0).
        """
        redis = await self._get_redis()
        results = await redis.lrange(f"scheduler:results:{source_id}", 0, -1)

        if not results:
            return 0.0

        failures = sum(1 for r in results if r.startswith("f:"))
        return failures / len(results)

    async def _auto_disable(self, source_id: str, fail_rate: float) -> None:
        """Auto-disable a source due to high failure rate.

        Args:
            source_id: Source to disable.
            fail_rate: Current failure rate.
        """
        await self._sources_collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "enabled": False,
                    "health.auto_disabled": True,
                    "health.auto_disabled_at": time.time(),
                    "health.auto_disabled_reason": f"fail_rate={fail_rate:.2f} > {AUTO_DISABLE_FAIL_RATE}",
                },
            },
        )

        logger.error(
            "AUTO-DISABLED source '%s': fail_rate=%.2f exceeds threshold %.2f",
            source_id, fail_rate, AUTO_DISABLE_FAIL_RATE,
        )

    async def re_enable_source(self, source_id: str) -> None:
        """Manually re-enable a disabled source.

        Args:
            source_id: Source to re-enable.
        """
        redis = await self._get_redis()

        await self._sources_collection.update_one(
            {"source_id": source_id},
            {
                "$set": {
                    "enabled": True,
                    "health.auto_disabled": False,
                    "health.consecutive_failures": 0,
                },
            },
        )

        # Reset backoff
        await redis.delete(f"scheduler:backoff:{source_id}")
        await redis.delete(f"scheduler:results:{source_id}")

        logger.info("Re-enabled source '%s'", source_id)

    def calculate_backoff_interval(self, job: CrawlJob) -> int:
        """Calculate next crawl interval with exponential backoff.

        Args:
            job: The crawl job.

        Returns:
            Interval in seconds (with backoff applied).
        """
        if job.consecutive_failures == 0:
            return job.interval_seconds

        # Exponential backoff: interval * 2^failures, capped at MAX_BACKOFF_MULTIPLIER
        multiplier = min(2 ** job.consecutive_failures, MAX_BACKOFF_MULTIPLIER)
        return job.interval_seconds * multiplier
