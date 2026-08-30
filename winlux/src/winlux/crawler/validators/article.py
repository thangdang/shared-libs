"""Article quality validator for TrendBrief.

Validates crawled articles meet quality standards:
- Minimum 100 characters content
- No exact duplicates (title similarity > 0.9 = reject)
- Valid URL
- Has title
"""

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import List, Optional, Set

logger = logging.getLogger(__name__)


@dataclass
class ArticleValidationResult:
    """Result of article quality validation."""

    is_valid: bool
    errors: List[str]
    warnings: List[str]
    is_duplicate: bool = False


class ArticleQualityValidator:
    """Validates crawled article quality.

    Rules (from Req 4.2):
    - Article must have minimum 100 characters content
    - No duplicate (check title similarity > 0.9 = reject)
    - Valid URL
    - Has title
    """

    def __init__(self):
        """Initialize validator with title cache for dedup."""
        self._seen_titles: Set[str] = set()
        self._title_hashes: Set[str] = set()

    def validate(self, article: dict) -> ArticleValidationResult:
        """Validate a single article.

        Args:
            article: Dict with article fields (title, content, url).

        Returns:
            ArticleValidationResult.
        """
        errors = []
        warnings = []
        is_duplicate = False

        # Title required
        title = article.get("title", "").strip()
        if not title:
            errors.append("Article title is empty")
        elif len(title) < 10:
            warnings.append("Article title very short (< 10 chars)")

        # Content minimum length
        content = article.get("content", "").strip()
        if not content:
            errors.append("Article content is empty")
        elif len(content) < 100:
            errors.append(f"Article content too short ({len(content)} chars, min 100)")

        # URL required
        url = article.get("url", "").strip()
        if not url:
            errors.append("Article URL is missing")
        elif not url.startswith("http"):
            errors.append(f"Article URL invalid: {url[:50]}")

        # Duplicate check (title similarity)
        if title:
            normalized_title = self._normalize_title(title)
            title_hash = hashlib.md5(normalized_title.encode()).hexdigest()

            if title_hash in self._title_hashes:
                is_duplicate = True
                errors.append("Duplicate article (exact title match)")
            else:
                # Check fuzzy similarity with recent titles
                for seen_title in list(self._seen_titles)[-500:]:  # Last 500
                    if self._title_similarity(normalized_title, seen_title) > 0.9:
                        is_duplicate = True
                        errors.append("Duplicate article (title similarity > 0.9)")
                        break

                if not is_duplicate:
                    self._seen_titles.add(normalized_title)
                    self._title_hashes.add(title_hash)

        # Clickbait detection (warning only)
        if title and self._is_clickbait(title):
            warnings.append("Possible clickbait title detected")

        return ArticleValidationResult(
            is_valid=len(errors) == 0,
            errors=errors,
            warnings=warnings,
            is_duplicate=is_duplicate,
        )

    def _normalize_title(self, title: str) -> str:
        """Normalize title for comparison.

        Args:
            title: Raw title string.

        Returns:
            Normalized lowercase title without extra whitespace.
        """
        text = title.lower().strip()
        text = re.sub(r'\s+', ' ', text)
        # Remove common prefixes like "Tin tổng hợp:", "Breaking:"
        text = re.sub(r'^(tin tổng hợp|breaking|nóng|mới)\s*[:|-]\s*', '', text)
        return text

    def _title_similarity(self, title1: str, title2: str) -> float:
        """Calculate title similarity using character overlap.

        Simple but fast approach for dedup checking.

        Args:
            title1: First normalized title.
            title2: Second normalized title.

        Returns:
            Similarity score (0.0 to 1.0).
        """
        if not title1 or not title2:
            return 0.0
        if title1 == title2:
            return 1.0

        # Use character n-gram overlap (trigrams)
        trigrams1 = set(title1[i:i+3] for i in range(len(title1) - 2))
        trigrams2 = set(title2[i:i+3] for i in range(len(title2) - 2))

        if not trigrams1 or not trigrams2:
            return 0.0

        intersection = trigrams1 & trigrams2
        union = trigrams1 | trigrams2

        return len(intersection) / len(union)

    def _is_clickbait(self, title: str) -> bool:
        """Detect potential clickbait titles.

        Args:
            title: Article title.

        Returns:
            True if title matches clickbait patterns.
        """
        clickbait_patterns = [
            r'bạn sẽ không tin',
            r'shock|sốc',
            r'kinh hoàng',
            r'không thể tin nổi',
            r'\d+ điều.*bạn chưa biết',
            r'bí mật.*được tiết lộ',
        ]
        title_lower = title.lower()
        return any(re.search(p, title_lower) for p in clickbait_patterns)

    def reset_dedup_cache(self) -> None:
        """Clear the in-memory dedup cache."""
        self._seen_titles.clear()
        self._title_hashes.clear()
