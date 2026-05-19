"""Shared config-driven crawl engine for AI engines.

Public API:
    CrawlEngine — Config-driven crawl orchestrator
    CrawlResult — Dataclass representing a crawled article
    ProxyPool — Rotating proxy pool manager
    CrawlScheduler — Priority-based crawl scheduler
    TranslationPipeline — EN→VI translation with caching
    PlaywrightPool — Browser instance pool for JS-rendered pages
    CrossSourceDedup — Product deduplication across platforms
"""

from shared_crawler.engine import CrawlEngine, CrawlResult
from shared_crawler.proxy import ProxyPool, ProxyConfig, ProxyInfo
from shared_crawler.scheduler import CrawlScheduler, CrawlJob, Priority
from shared_crawler.translate import TranslationPipeline, TranslatedText
from shared_crawler.extractors.playwright_pool import PlaywrightPool
from shared_crawler.product_dedup import CrossSourceDedup, CrawledProduct, DedupResult

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
]
