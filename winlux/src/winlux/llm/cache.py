"""Redis-backed LLM response cache.

Caches LLM responses by hashing model + prompt + parameters.
Skips caching gracefully if Redis is unavailable.
"""

import hashlib
import json
import logging
from typing import Optional

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


class LLMCache:
    """Redis-backed cache for LLM responses."""

    def __init__(self, redis_url: str, default_ttl: int = 86400):
        """Initialize LLM cache.

        Args:
            redis_url: Redis connection URL.
            default_ttl: Default time-to-live in seconds (default 24h).
        """
        self._redis_url = redis_url
        self._default_ttl = default_ttl
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        self._hits = 0
        self._misses = 0

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Get or create Redis connection."""
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    self._redis_url, decode_responses=True
                )
                await self._redis.ping()
                self._connected = True
            except Exception as e:
                logger.warning(f"Redis unavailable for cache: {e}")
                self._redis = None
                self._connected = False
        return self._redis

    def compute_key(self, model: str, prompt: str, params: dict) -> str:
        """Compute cache key from model, prompt, and parameters.

        Uses SHA-256 hash of the concatenation for collision avoidance.

        Args:
            model: Model name.
            prompt: Prompt text.
            params: Generation parameters (temperature, max_tokens, etc.).

        Returns:
            Cache key string in format "llm_cache:{hash}".
        """
        # Sort params for deterministic key
        sorted_params = json.dumps(params, sort_keys=True, default=str)
        key_input = f"{model}|{prompt}|{sorted_params}"
        hash_hex = hashlib.sha256(key_input.encode("utf-8")).hexdigest()
        return f"llm_cache:{hash_hex}"

    async def get(self, model: str, prompt: str, params: dict) -> Optional[str]:
        """Retrieve a cached response.

        Args:
            model: Model name.
            prompt: Prompt text.
            params: Generation parameters.

        Returns:
            Cached response string, or None on cache miss.
        """
        redis = await self._get_redis()
        if not redis:
            self._misses += 1
            return None

        try:
            key = self.compute_key(model, prompt, params)
            value = await redis.get(key)
            if value is not None:
                self._hits += 1
                return value
            self._misses += 1
            return None
        except Exception as e:
            logger.warning(f"Cache get error: {e}")
            self._misses += 1
            return None

    async def set(
        self, model: str, prompt: str, params: dict, response: str, ttl: int | None = None
    ) -> None:
        """Cache a response with TTL.

        Args:
            model: Model name.
            prompt: Prompt text.
            params: Generation parameters.
            response: Response content to cache.
            ttl: Time-to-live in seconds (uses default if None).
        """
        redis = await self._get_redis()
        if not redis:
            return

        try:
            key = self.compute_key(model, prompt, params)
            await redis.set(key, response, ex=ttl or self._default_ttl)
        except Exception as e:
            logger.warning(f"Cache set error: {e}")

    def get_stats(self) -> dict:
        """Get cache statistics.

        Returns:
            Dict with hits, misses, hit_rate, connected status.
        """
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0.0
        return {
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": round(hit_rate, 3),
            "connected": self._connected,
        }
