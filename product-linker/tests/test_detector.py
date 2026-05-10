"""Unit tests for product_linker.detector module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from product_linker.detector import MentionDetector, _normalize_text
from product_linker.models import DetectedMention


class TestNormalizeText:
    """Tests for text normalization helper."""

    def test_lowercase(self):
        """Text is lowercased."""
        assert _normalize_text("Hello World") == "hello world"

    def test_remove_diacritics(self):
        """Vietnamese diacritics are removed."""
        result = _normalize_text("Hà Nội")
        assert "à" not in result
        assert "ộ" not in result

    def test_empty_string(self):
        """Empty string returns empty string."""
        assert _normalize_text("") == ""


class TestMentionDetector:
    """Tests for MentionDetector with mocked MongoDB."""

    @pytest.fixture
    def mock_db(self):
        """Create a mock MongoDB database."""
        db = MagicMock()
        collection = MagicMock()
        cursor = AsyncMock()
        cursor.to_list = AsyncMock(return_value=[
            {
                "product_name": "iPhone 15",
                "brand": "Apple",
                "affiliate_url": "https://shopee.vn/iphone15?ref=abc",
                "platform": "shopee",
                "category": "electronics",
                "topic_keywords": ["điện thoại", "smartphone"],
                "match_type": "keyword",
                "enabled": True,
            },
            {
                "product_name": "Vitamin D3",
                "brand": "Kirkland",
                "affiliate_url": "https://caremate.vn/vitamind3",
                "platform": "caremate",
                "category": "health",
                "topic_keywords": ["vitamin", "bổ sung"],
                "match_type": "keyword",
                "enabled": True,
            },
        ])
        collection.find = MagicMock(return_value=cursor)
        db.__getitem__ = MagicMock(return_value=collection)
        return db

    @pytest.mark.asyncio
    async def test_detect_product_name(self, mock_db):
        """Detects product by exact name match."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("Tôi muốn mua iPhone 15")
        assert len(mentions) >= 1
        assert any(m.text == "iPhone 15" for m in mentions)

    @pytest.mark.asyncio
    async def test_detect_brand(self, mock_db):
        """Detects brand name."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("Sản phẩm Apple rất tốt")
        assert len(mentions) >= 1
        assert any(m.type == "brand" for m in mentions)

    @pytest.mark.asyncio
    async def test_detect_keyword(self, mock_db):
        """Detects by topic keyword."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("Tôi cần bổ sung vitamin")
        assert len(mentions) >= 1

    @pytest.mark.asyncio
    async def test_detect_empty_text(self, mock_db):
        """Empty text returns empty list."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("")
        assert mentions == []

    @pytest.mark.asyncio
    async def test_detect_no_match(self, mock_db):
        """Text without matches returns empty list."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("Hôm nay trời đẹp quá")
        assert mentions == []

    @pytest.mark.asyncio
    async def test_mention_has_affiliate_url(self, mock_db):
        """Detected mentions include affiliate URLs."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("Mua iPhone 15 ở đâu")
        assert len(mentions) >= 1
        assert mentions[0].affiliate_url.startswith("http")

    @pytest.mark.asyncio
    async def test_mention_confidence_range(self, mock_db):
        """Confidence scores are between 0 and 1."""
        detector = MentionDetector(mock_db)
        mentions = await detector.detect("iPhone 15 Apple vitamin")
        for m in mentions:
            assert 0.0 <= m.confidence <= 1.0
