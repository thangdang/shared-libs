"""Shared config-driven crawl engine for AI engines.

Public API:
    CrawlEngine — Config-driven crawl orchestrator
    CrawlResult — Dataclass representing a crawled article
"""

from shared_crawler.engine import CrawlEngine, CrawlResult

__all__ = [
    "CrawlEngine",
    "CrawlResult",
]
