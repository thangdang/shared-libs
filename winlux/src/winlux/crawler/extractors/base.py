"""Base extractor abstract class."""

from abc import ABC, abstractmethod
from typing import List


class BaseExtractor(ABC):
    """Abstract base class for all crawl extractors."""

    @abstractmethod
    async def extract(self, url: str, config: dict) -> List[dict]:
        """Extract articles from a URL using type-specific logic.

        Args:
            url: Target URL to crawl.
            config: Type-specific configuration (selectors, headers, etc.).

        Returns:
            List of article dictionaries with keys:
                - url: Article URL
                - title: Article title
                - content: Article content/summary
                - published_at: Publication datetime string or None
                - image_url: Featured image URL or None
                - metadata: Additional metadata dict
        """
        ...
