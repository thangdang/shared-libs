"""Shared config-driven crawl engine for AI engines.

Public API:
    CrawlEngine — Config-driven crawl orchestrator
    CrawlResult — Dataclass representing a crawled article
    ProxyPool — Rotating proxy pool manager
    CrawlScheduler — Priority-based crawl scheduler
    TranslationPipeline — EN→VI translation with caching
    PlaywrightPool — Browser instance pool for JS-rendered pages
    CrossSourceDedup — Product deduplication across platforms
    CrawlerCircuitBreaker — Per-source circuit breaker
    RedisRateLimiter — Per-domain rate limiter
"""

from winlux.crawler.engine import CrawlEngine, CrawlResult
from winlux.crawler.proxy import ProxyPool, ProxyConfig, ProxyInfo
from winlux.crawler.scheduler import CrawlScheduler, CrawlJob, Priority
from winlux.crawler.translate import TranslationPipeline, TranslatedText
from winlux.crawler.extractors.playwright_pool import PlaywrightPool
from winlux.crawler.product_dedup import CrossSourceDedup, CrawledProduct, DedupResult
from winlux.crawler.circuit_breaker import CrawlerCircuitBreaker, CircuitState
from winlux.crawler.rate_limiter import RedisRateLimiter

__all__ = [
    # Core
    "CrawlEngine",
    "CrawlResult",
    # Proxy
    "ProxyPool",
    "ProxyConfig",
    "ProxyInfo",
    # Scheduler
    "CrawlScheduler",
    "CrawlJob",
    "Priority",
    # Translation
    "TranslationPipeline",
    "TranslatedText",
    # Playwright Pool
    "PlaywrightPool",
    # Product Dedup
    "CrossSourceDedup",
    "CrawledProduct",
    "DedupResult",
    # Circuit Breaker
    "CrawlerCircuitBreaker",
    "CircuitState",
    # Rate Limiter
    "RedisRateLimiter",
]
