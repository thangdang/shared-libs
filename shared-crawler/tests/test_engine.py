"""Unit tests for shared_crawler.engine module."""

import pytest
from shared_crawler.engine import CrawlEngine, CrawlResult


class TestCrawlResult:
    """Tests for CrawlResult dataclass."""

    def test_create_crawl_result(self):
        """CrawlResult can be created with required fields."""
        result = CrawlResult(
            url="http://example.com/article",
            title="Test Article",
            content="Article content",
            published_at=None,
            source_id="test-source",
        )
        assert result.url == "http://example.com/article"
        assert result.title == "Test Article"
        assert result.source_id == "test-source"
        assert result.image_url is None
        assert result.metadata == {}

    def test_crawl_result_with_metadata(self):
        """CrawlResult accepts optional metadata."""
        result = CrawlResult(
            url="http://example.com/article",
            title="Test",
            content="Content",
            published_at=None,
            source_id="src",
            image_url="http://example.com/img.jpg",
            metadata={"author": "Test Author"},
        )
        assert result.image_url == "http://example.com/img.jpg"
        assert result.metadata["author"] == "Test Author"


class TestCrawlEngineInit:
    """Tests for CrawlEngine initialization."""

    def test_engine_has_extractors(self):
        """Engine initializes with all extractor types."""
        engine = CrawlEngine(
            mongo_uri="mongodb://localhost:27017/test",
            redis_url="redis://localhost:6379",
        )
        assert "rss" in engine._extractors
        assert "html" in engine._extractors
        assert "api" in engine._extractors
        assert "playwright" in engine._extractors

    def test_engine_get_domain(self):
        """Engine correctly extracts domain from URL."""
        engine = CrawlEngine(
            mongo_uri="mongodb://localhost:27017/test",
            redis_url="redis://localhost:6379",
        )
        assert engine._get_domain("https://vnexpress.net/path") == "vnexpress.net"
        assert engine._get_domain("http://example.com:8080/p") == "example.com:8080"
