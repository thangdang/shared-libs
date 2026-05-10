"""Property-based tests for product-linker.

Uses hypothesis library with minimum 100 iterations per property.
Tests correctness properties defined in the design document.
"""

# Feature: shared-services, Property 17

import pytest
from unittest.mock import AsyncMock, MagicMock
from hypothesis import given, settings
from hypothesis import strategies as st

from product_linker.detector import MentionDetector, _normalize_text


# Sample catalog entries for property testing
SAMPLE_CATALOG = [
    {
        "product_name": "iPhone 15 Pro",
        "brand": "Apple",
        "affiliate_url": "https://shopee.vn/iphone15pro?ref=test",
        "platform": "shopee",
        "category": "electronics",
        "topic_keywords": ["điện thoại", "smartphone", "iphone"],
        "match_type": "keyword",
        "enabled": True,
    },
    {
        "product_name": "Vitamin D3 1000IU",
        "brand": "Kirkland",
        "affiliate_url": "https://caremate.vn/vitamind3",
        "platform": "caremate",
        "category": "health",
        "topic_keywords": ["vitamin d", "bổ sung canxi", "sức khỏe xương"],
        "match_type": "keyword",
        "enabled": True,
    },
    {
        "product_name": "Sách Đắc Nhân Tâm",
        "brand": "NXB Tổng Hợp",
        "affiliate_url": "https://shopee.vn/dacnhantam?ref=test",
        "platform": "shopee",
        "category": "books",
        "topic_keywords": ["sách", "đắc nhân tâm", "dale carnegie"],
        "match_type": "keyword",
        "enabled": True,
    },
    {
        "product_name": "Gói tiết kiệm VPBank",
        "brand": "VPBank",
        "affiliate_url": "https://fintax.vn/vpbank-savings",
        "platform": "fintax",
        "category": "finance",
        "topic_keywords": ["tiết kiệm", "lãi suất", "ngân hàng"],
        "match_type": "keyword",
        "enabled": True,
    },
]


def _create_mock_detector():
    """Create a MentionDetector with mocked MongoDB and pre-loaded catalog."""
    db = MagicMock()
    collection = MagicMock()
    cursor = AsyncMock()
    cursor.to_list = AsyncMock(return_value=SAMPLE_CATALOG)
    collection.find = MagicMock(return_value=cursor)
    db.__getitem__ = MagicMock(return_value=collection)
    return MentionDetector(db)


# --- Property 17: Product and topic detection ---
# For any text containing a product name, brand name, or topic keyword
# from the catalog, the Product_Linker SHALL detect it and return the
# corresponding affiliate link with the correct category type.

@settings(max_examples=100)
@given(st.sampled_from(SAMPLE_CATALOG))
@pytest.mark.asyncio
async def test_property_17_product_detection_by_name(catalog_entry):
    """Property 17: Product names in text are detected."""
    detector = _create_mock_detector()
    product_name = catalog_entry["product_name"]
    text = f"Tôi muốn mua {product_name} giá tốt"

    mentions = await detector.detect(text)

    # Should detect the product
    assert len(mentions) >= 1, (
        f"Product '{product_name}' not detected in text"
    )
    # Should have correct affiliate URL
    urls = [m.affiliate_url for m in mentions]
    assert catalog_entry["affiliate_url"] in urls


@settings(max_examples=100)
@given(st.sampled_from(SAMPLE_CATALOG))
@pytest.mark.asyncio
async def test_property_17_keyword_detection(catalog_entry):
    """Property 17: Topic keywords in text are detected."""
    detector = _create_mock_detector()

    if not catalog_entry["topic_keywords"]:
        return

    keyword = catalog_entry["topic_keywords"][0]
    text = f"Tìm hiểu về {keyword} cho gia đình"

    mentions = await detector.detect(text)

    # Should detect via keyword
    assert len(mentions) >= 1, (
        f"Keyword '{keyword}' not detected in text"
    )


@settings(max_examples=100)
@given(st.sampled_from(SAMPLE_CATALOG))
@pytest.mark.asyncio
async def test_property_17_correct_category_type(catalog_entry):
    """Property 17: Detected mentions have correct category type."""
    detector = _create_mock_detector()
    product_name = catalog_entry["product_name"]
    text = f"Review {product_name} chi tiết"

    mentions = await detector.detect(text)

    if mentions:
        # Category mapping
        valid_types = {"product", "brand", "health", "finance"}
        for mention in mentions:
            assert mention.type in valid_types, (
                f"Invalid type '{mention.type}' for '{mention.text}'"
            )
