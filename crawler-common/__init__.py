"""
Crawler Common Library
══════════════════════
Shared crawling infrastructure for all AI apps.

Features:
  - Multi-strategy extraction (fallback selectors)
  - Circuit breaker for source health
  - Incremental crawl mode
  - Selector validation
  - Rate limiting & retry
  - Content deduplication

Usage:
  from crawler_common import BaseCrawler, CircuitBreaker, SelectorStrategy
"""

from .base_crawler import BaseCrawler
from .circuit_breaker import CircuitBreaker, CircuitState
from .extraction import SelectorStrategy, ExtractionResult, extract_with_fallback
from .incremental import IncrementalCrawler, CrawlCheckpoint
from .rate_limiter import AdaptiveRateLimiter
from .health_monitor import SourceHealthMonitor, HealthStatus
from .deduplication import ContentDeduplicator
from .validation import SelectorValidator, ValidationResult


__all__ = [
    # Base
    "BaseCrawler",
    # Circuit Breaker
    "CircuitBreaker",
    "CircuitState",
    # Extraction
    "SelectorStrategy",
    "ExtractionResult",
    "extract_with_fallback",
    # Incremental
    "IncrementalCrawler",
    "CrawlCheckpoint",
    # Rate Limiting
    "AdaptiveRateLimiter",
    # Health
    "SourceHealthMonitor",
    "HealthStatus",
    # Dedup
    "ContentDeduplicator",
    # Validation
    "SelectorValidator",
    "ValidationResult",
]

__version__ = "1.0.0"
