"""Shared Crawler Self-Healing.

When a crawler breaks (selector returns empty/wrong data), this module:
1. Detects the failure (validation gate)
2. Attempts auto-repair (LLM suggests new selectors)
3. Validates repair against known good data
4. Rolls back if repair is bad

Used by: SmartBuy crawler (8 spiders), CareMate crawler (pharmacy data).
"""

import hashlib
import logging
import time
from dataclasses import dataclass
from typing import Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class CrawlResult:
    """Result from a single crawl attempt."""
    source: str
    url: str
    success: bool
    items_count: int
    data: list
    error: Optional[str] = None
    duration_ms: float = 0


@dataclass
class ValidationResult:
    """Result from data validation."""
    valid: bool
    issues: List[str]
    confidence: float  # 0-1


class SelfHealingCrawler:
    """Self-healing wrapper for any crawler.

    Monitors crawl health and auto-repairs when selectors break.

    Usage:
        healer = SelfHealingCrawler(
            source="shopee",
            validator=my_validation_fn,
            repair_fn=my_llm_repair_fn,  # Optional: LLM-based selector repair
        )

        result = await healer.crawl_with_healing(crawl_fn, url)
    """

    # Max auto-repair attempts per day (prevent runaway LLM costs)
    MAX_REPAIRS_PER_DAY = 5

    def __init__(
        self,
        source: str,
        validator: Callable[[list], ValidationResult],
        repair_fn: Optional[Callable[[str, str], Optional[dict]]] = None,
        max_retries: int = 2,
    ):
        self.source = source
        self.validator = validator
        self.repair_fn = repair_fn
        self.max_retries = max_retries
        self._repair_count_today = 0
        self._repair_day = ""
        self._last_known_good: Dict[str, list] = {}  # url_hash → last good data

    async def crawl_with_healing(
        self,
        crawl_fn: Callable,
        url: str,
        **crawl_kwargs,
    ) -> CrawlResult:
        """Crawl with automatic validation and self-healing.

        Flow:
        1. Crawl normally
        2. Validate results
        3. If invalid → retry with existing selectors
        4. If still invalid → attempt self-repair (LLM)
        5. If repair fails → use cached data + alert
        """
        start = time.time()

        # Attempt 1: Normal crawl
        try:
            data = await crawl_fn(url, **crawl_kwargs)
        except Exception as e:
            return CrawlResult(
                source=self.source, url=url, success=False,
                items_count=0, data=[], error=str(e),
                duration_ms=(time.time() - start) * 1000,
            )

        # Validate
        validation = self.validator(data)
        if validation.valid:
            self._cache_good_data(url, data)
            return CrawlResult(
                source=self.source, url=url, success=True,
                items_count=len(data), data=data,
                duration_ms=(time.time() - start) * 1000,
            )

        # Attempt 2: Retry (sometimes transient)
        logger.warning(f"[SelfHealing] {self.source}/{url}: validation failed ({validation.issues}), retrying...")
        try:
            data = await crawl_fn(url, **crawl_kwargs)
            validation = self.validator(data)
            if validation.valid:
                self._cache_good_data(url, data)
                return CrawlResult(
                    source=self.source, url=url, success=True,
                    items_count=len(data), data=data,
                    duration_ms=(time.time() - start) * 1000,
                )
        except Exception:
            pass

        # Attempt 3: Self-repair (if repair_fn provided)
        if self.repair_fn and self._can_repair():
            logger.info(f"[SelfHealing] {self.source}: attempting auto-repair...")
            try:
                repaired_config = await self.repair_fn(self.source, url)
                if repaired_config:
                    data = await crawl_fn(url, config_override=repaired_config, **crawl_kwargs)
                    validation = self.validator(data)
                    if validation.valid:
                        self._record_repair()
                        self._cache_good_data(url, data)
                        logger.info(f"[SelfHealing] {self.source}: auto-repair SUCCESS")
                        return CrawlResult(
                            source=self.source, url=url, success=True,
                            items_count=len(data), data=data,
                            duration_ms=(time.time() - start) * 1000,
                        )
                    else:
                        logger.warning(f"[SelfHealing] {self.source}: repair produced invalid data — rolling back")
            except Exception as e:
                logger.error(f"[SelfHealing] {self.source}: repair failed: {e}")

        # Fallback: return cached data (stale but valid)
        cached = self._get_cached_data(url)
        if cached:
            logger.warning(f"[SelfHealing] {self.source}: using cached data (stale)")
            return CrawlResult(
                source=self.source, url=url, success=False,
                items_count=len(cached), data=cached,
                error="using_stale_cache",
                duration_ms=(time.time() - start) * 1000,
            )

        # Complete failure
        return CrawlResult(
            source=self.source, url=url, success=False,
            items_count=0, data=[],
            error=f"all_attempts_failed: {validation.issues}",
            duration_ms=(time.time() - start) * 1000,
        )

    def _cache_good_data(self, url: str, data: list) -> None:
        """Cache last known good data for a URL."""
        key = hashlib.md5(url.encode()).hexdigest()[:16]
        self._last_known_good[key] = data

    def _get_cached_data(self, url: str) -> Optional[list]:
        key = hashlib.md5(url.encode()).hexdigest()[:16]
        return self._last_known_good.get(key)

    def _can_repair(self) -> bool:
        """Check if repair budget allows another attempt."""
        today = time.strftime("%Y-%m-%d")
        if self._repair_day != today:
            self._repair_day = today
            self._repair_count_today = 0
        return self._repair_count_today < self.MAX_REPAIRS_PER_DAY

    def _record_repair(self) -> None:
        self._repair_count_today += 1
