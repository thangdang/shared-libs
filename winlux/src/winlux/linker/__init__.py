"""Product Linker — Product/brand/topic detection and affiliate linking.

Usage:
    from winlux.linker import MentionDetector, detect_products
    from winlux.linker.api import app  # FastAPI app
"""

from winlux.linker.detector import MentionDetector
from winlux.linker.models import (
    CatalogEntry,
    CatalogStats,
    DetectedMention,
    LinkRequest,
    LinkResponse,
)

# Convenience aliases
ProductLinker = MentionDetector


async def detect_products(detector: MentionDetector, text: str) -> list:
    """Convenience function to detect products in text.

    Args:
        detector: MentionDetector instance.
        text: Text to scan for mentions.

    Returns:
        List of DetectedMention objects.
    """
    return await detector.detect(text)


def generate_affiliate_link(base_url: str, tracking_id: str) -> str:
    """Generate affiliate tracking URL.

    Args:
        base_url: Product page URL.
        tracking_id: Affiliate tracking ID.

    Returns:
        URL with affiliate tracking parameter.
    """
    separator = "&" if "?" in base_url else "?"
    return f"{base_url}{separator}ref={tracking_id}"


__all__ = [
    "MentionDetector",
    "ProductLinker",
    "CatalogEntry",
    "CatalogStats",
    "DetectedMention",
    "LinkRequest",
    "LinkResponse",
    "detect_products",
    "generate_affiliate_link",
]
