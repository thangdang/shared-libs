"""Mention detection logic for Product Linker.

Detects product, brand, health, and finance mentions in text
by matching against a MongoDB affiliate catalog.
"""

import logging
import time
import unicodedata
from typing import List

from motor.motor_asyncio import AsyncIOMotorDatabase

from winlux.linker.models import CatalogEntry, DetectedMention

logger = logging.getLogger(__name__)


def _normalize_text(text: str) -> str:
    """Normalize text for matching: lowercase and remove diacritics."""
    text_lower = text.lower()
    # Remove Vietnamese diacritics for fuzzy matching
    nfkd = unicodedata.normalize("NFKD", text_lower)
    return "".join(c for c in nfkd if not unicodedata.combining(c))


class MentionDetector:
    """Detects product, brand, health, and finance mentions in text."""

    def __init__(self, db: AsyncIOMotorDatabase):
        """Initialize detector with MongoDB database.

        Args:
            db: Motor async MongoDB database instance.
        """
        self._db = db
        self._collection = db["affiliate_catalog"]
        self._catalog: List[CatalogEntry] = []
        self._last_refresh: float = 0.0
        self._refresh_interval: int = 300  # 5 minutes

    async def _refresh_catalog(self) -> None:
        """Reload catalog from MongoDB if stale (>5 min)."""
        now = time.time()
        if now - self._last_refresh < self._refresh_interval and self._catalog:
            return

        try:
            cursor = self._collection.find({"enabled": True})
            docs = await cursor.to_list(length=None)
            self._catalog = [
                CatalogEntry(**{k: v for k, v in doc.items() if k != "_id"})
                for doc in docs
            ]
            self._last_refresh = now
            logger.info(f"Catalog refreshed: {len(self._catalog)} entries")
        except Exception as e:
            logger.error(f"Failed to refresh catalog: {e}")
            # Keep existing catalog if refresh fails

    async def detect(self, text: str) -> List[DetectedMention]:
        """Detect mentions using catalog matching.

        Strategy:
        1. Refresh catalog from MongoDB if stale (>5 min)
        2. Normalize input text (lowercase, remove diacritics)
        3. Match against product_name, brand, and topic_keywords
        4. Return matches with affiliate URLs

        Args:
            text: Input text to scan for mentions.

        Returns:
            List of DetectedMention objects.
        """
        await self._refresh_catalog()

        if not text or not self._catalog:
            return []

        normalized_text = _normalize_text(text)
        text_lower = text.lower()
        mentions = []

        for entry in self._catalog:
            matched = False
            matched_text = ""
            confidence = 0.0

            # Match by product name
            product_norm = _normalize_text(entry.product_name)
            if product_norm in normalized_text:
                matched = True
                matched_text = entry.product_name
                confidence = 0.95

            # Match by brand
            if not matched:
                brand_norm = _normalize_text(entry.brand)
                if brand_norm and brand_norm in normalized_text:
                    matched = True
                    matched_text = entry.brand
                    confidence = 0.85

            # Match by topic keywords
            if not matched:
                for keyword in entry.topic_keywords:
                    kw_norm = _normalize_text(keyword)
                    if kw_norm in normalized_text:
                        matched = True
                        matched_text = keyword
                        confidence = 0.7
                        break

            if matched:
                # Map category to type
                type_map = {
                    "electronics": "product",
                    "fashion": "product",
                    "beauty": "product",
                    "food": "product",
                    "health": "health",
                    "finance": "finance",
                }
                mention_type = type_map.get(entry.category, "product")
                if entry.brand and _normalize_text(entry.brand) == _normalize_text(matched_text):
                    mention_type = "brand"

                mentions.append(DetectedMention(
                    text=matched_text,
                    type=mention_type,
                    affiliate_url=entry.affiliate_url,
                    platform=entry.platform,
                    confidence=confidence,
                ))

        return mentions

    async def get_catalog_stats(self) -> dict:
        """Get catalog statistics."""
        await self._refresh_catalog()
        categories: dict = {}
        for entry in self._catalog:
            categories[entry.category] = categories.get(entry.category, 0) + 1

        return {
            "total_entries": len(self._catalog),
            "enabled_entries": len(self._catalog),
            "last_refresh": self._last_refresh,
            "categories": categories,
        }
