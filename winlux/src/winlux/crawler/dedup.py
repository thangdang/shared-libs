"""URL deduplication with normalization.

Prevents processing the same article multiple times across crawl cycles.
Uses Redis for persistent dedup state with URL normalization.
"""

import hashlib
from typing import Optional
from urllib.parse import urlparse, urlencode, parse_qs

import redis.asyncio as aioredis


class URLDeduplicator:
    """URL-based deduplication with normalization and Redis backend."""

    def __init__(self, redis_url: str, key_prefix: str = "dedup"):
        """Initialize deduplicator.

        Args:
            redis_url: Redis connection URL.
            key_prefix: Prefix for Redis keys (default "dedup").
        """
        self._redis_url = redis_url
        self._key_prefix = key_prefix
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._redis

    def normalize_url(self, url: str) -> str:
        """Normalize a URL for consistent deduplication.

        Normalization steps:
        - Lowercase scheme and host
        - Remove trailing slash from path
        - Sort query parameters alphabetically
        - Remove default ports (80 for http, 443 for https)
        - Remove fragment

        Args:
            url: URL to normalize.

        Returns:
            Normalized URL string.
        """
        parsed = urlparse(url)

        # Lowercase scheme and host
        scheme = parsed.scheme.lower()
        host = parsed.netloc.lower()

        # Remove default ports
        if host.endswith(":80") and scheme == "http":
            host = host[:-3]
        elif host.endswith(":443") and scheme == "https":
            host = host[:-4]

        # Remove trailing slash from path
        path = parsed.path.rstrip("/") or "/"

        # Sort query parameters
        query_params = parse_qs(parsed.query, keep_blank_values=True)
        sorted_query = urlencode(
            sorted(
                [(k, v[0] if len(v) == 1 else v) for k, v in query_params.items()]
            )
        ) if query_params else ""

        # Reconstruct without fragment
        normalized = f"{scheme}://{host}{path}"
        if sorted_query:
            normalized += f"?{sorted_query}"

        return normalized

    def hash_url(self, url: str) -> str:
        """Compute SHA-256 hash of normalized URL.

        Args:
            url: URL to hash (will be normalized first).

        Returns:
            Hex digest of SHA-256 hash.
        """
        normalized = self.normalize_url(url)
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    async def is_duplicate(self, url: str) -> bool:
        """Check if a URL has been processed before.

        Args:
            url: URL to check.

        Returns:
            True if URL was previously processed.
        """
        redis = await self._get_redis()
        url_hash = self.hash_url(url)
        key = f"{self._key_prefix}:{url_hash}"
        return await redis.exists(key) > 0

    async def mark_processed(self, url: str, ttl: int = 604800) -> None:
        """Record a URL as processed.

        Args:
            url: URL to mark as processed.
            ttl: Time-to-live in seconds (default 7 days).
        """
        redis = await self._get_redis()
        url_hash = self.hash_url(url)
        key = f"{self._key_prefix}:{url_hash}"
        await redis.set(key, "1", ex=ttl)
