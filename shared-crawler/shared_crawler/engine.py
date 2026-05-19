"""Config-driven crawl orchestrator.

Loads crawl source configurations from MongoDB and dispatches
to the appropriate extractor. Integrates rate limiting, retry,
deduplication, health tracking, anti-bot measures, and proxy rotation.
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import AsyncIterator, List, Optional
from urllib.parse import urlparse

from motor.motor_asyncio import AsyncIOMotorClient

from shared_crawler.anti_bot import AntiBotManager
from shared_crawler.dedup import URLDeduplicator
from shared_crawler.extractors.api import APIExtractor
from shared_crawler.extractors.html import HTMLExtractor
from shared_crawler.extractors.playwright_ext import PlaywrightExtractor
from shared_crawler.extractors.rss import RSSExtractor
from shared_crawler.health import CrawlHealthTracker
from shared_crawler.proxy.pool import ProxyPool, ProxyConfig
from shared_crawler.rate_limiter import RedisRateLimiter
from shared_crawler.retry import with_retry

logger = logging.getLogger(__name__)


@dataclass
class CrawlResult:
    """Result of crawling a single article."""

    url: str
    title: str
    content: str
    published_at: Optional[datetime]
    source_id: str
    image_url: Optional[str] = None
    metadata: dict = field(default_factory=dict)


class CrawlEngine:
    """Config-driven crawl orchestrator.

    Reads source configurations from MongoDB and dispatches crawls
    to the appropriate extractor type.
    """

    def __init__(self, mongo_uri: str, redis_url: str, proxy_config: Optional[ProxyConfig] = None):
        """Initialize crawl engine.

        Args:
            mongo_uri: MongoDB connection URI.
            redis_url: Redis connection URL.
            proxy_config: Optional proxy pool configuration.
        """
        self._mongo_client = AsyncIOMotorClient(mongo_uri)
        self._db = self._mongo_client.get_default_database()
        self._configs_collection = self._db["crawl_sources"]

        self._rate_limiter = RedisRateLimiter(redis_url)
        self._dedup = URLDeduplicator(redis_url)
        self._health = CrawlHealthTracker(self._db)
        self._anti_bot = AntiBotManager()

        # Proxy pool (optional — only for sources that need it)
        self._proxy_pool: Optional[ProxyPool] = None
        if proxy_config:
            self._proxy_pool = ProxyPool(proxy_config)

        # Extractor instances
        self._extractors = {
            "rss": RSSExtractor(),
            "html": HTMLExtractor(),
            "api": APIExtractor(),
            "playwright": PlaywrightExtractor(),
        }

    async def _load_config(self, source_id: str) -> Optional[dict]:
        """Load a single source config from MongoDB."""
        return await self._configs_collection.find_one(
            {"source_id": source_id, "enabled": True}
        )

    async def _load_configs_for_consumer(self, consumer: str) -> List[dict]:
        """Load all enabled configs for a specific consumer."""
        cursor = self._configs_collection.find(
            {"consumers": consumer, "enabled": True}
        )
        return await cursor.to_list(length=None)

    def _get_domain(self, url: str) -> str:
        """Extract domain from URL."""
        return urlparse(url).netloc

    async def _crawl_with_extractor(
        self, source_config: dict
    ) -> List[dict]:
        """Execute crawl using the appropriate extractor."""
        source_type = source_config["type"]
        url = source_config["url"]
        extractor = self._extractors.get(source_type)

        if not extractor:
            raise ValueError(f"Unknown extractor type: {source_type}")

        return await extractor.extract(url, source_config)

    async def crawl_source(self, source_id: str) -> List[CrawlResult]:
        """Crawl a single source by its config ID.

        Applies rate limiting, retry, dedup, health tracking,
        anti-bot measures, and proxy rotation.

        Args:
            source_id: The source identifier in MongoDB.

        Returns:
            List of CrawlResult objects for new (non-duplicate) articles.
        """
        config = await self._load_config(source_id)
        if not config:
            logger.warning(f"Source config not found or disabled: {source_id}")
            return []

        domain = self._get_domain(config["url"])
        rpm_limit = config.get("rate_limit_rpm", 10)

        # Rate limiting
        await self._rate_limiter.wait_and_acquire(domain, rpm_limit)

        # Anti-bot delay
        await self._anti_bot.randomize_delay()

        # Get proxy if needed
        proxy_info = None
        if self._proxy_pool and config.get("requires_proxy", False):
            proxy_info = await self._proxy_pool.get_proxy(domain)

        try:
            # Retry on transient errors
            raw_results = await with_retry(
                self._crawl_with_extractor, config, max_retries=3
            )

            # Record success
            await self._health.record_success(source_id)

            # Report proxy success
            if self._proxy_pool and proxy_info:
                await self._proxy_pool.report_result(domain, True, proxy_info)

        except Exception as e:
            # Record failure
            await self._health.record_failure(source_id, str(e))

            # Report proxy failure
            if self._proxy_pool and proxy_info:
                await self._proxy_pool.report_result(domain, False, proxy_info)

            logger.error(f"Crawl failed for source '{source_id}': {e}")
            return []

        # Dedup and convert results
        results = []
        for raw in raw_results:
            article_url = raw.get("url", "")
            if not article_url:
                continue

            # Skip duplicates
            try:
                if await self._dedup.is_duplicate(article_url):
                    continue
                await self._dedup.mark_processed(article_url)
            except Exception:
                # If dedup fails, still process the article
                pass

            # Parse published_at if string
            published_at = raw.get("published_at")
            if isinstance(published_at, str):
                # Keep as string in metadata, set to None for dataclass
                raw.setdefault("metadata", {})["published_at_raw"] = published_at
                published_at = None

            results.append(CrawlResult(
                url=article_url,
                title=raw.get("title", ""),
                content=raw.get("content", ""),
                published_at=published_at,
                source_id=source_id,
                image_url=raw.get("image_url"),
                metadata=raw.get("metadata", {}),
            ))

        return results

    async def crawl_all(self, consumer: str) -> AsyncIterator[CrawlResult]:
        """Crawl all sources for a specific consumer.

        Only delivers results from sources that list this consumer
        in their 'consumers' field.

        Args:
            consumer: Consumer identifier (e.g., "trend-brief").

        Yields:
            CrawlResult objects as they are crawled.
        """
        configs = await self._load_configs_for_consumer(consumer)

        for config in configs:
            source_id = config["source_id"]
            try:
                results = await self.crawl_source(source_id)
                for result in results:
                    yield result
            except Exception as e:
                logger.error(
                    f"Error crawling source '{source_id}' "
                    f"for consumer '{consumer}': {e}"
                )
                continue

    async def get_health_summary(self) -> List[dict]:
        """Get per-source health summary.

        Returns:
            List of dicts with: source_id, status, success_rate,
            last_success, consecutive_failures.
        """
        return await self._health.get_health_summary()
