"""Redis-backed per-domain rate limiter.

Enforces shared rate limits across all consumers via Redis counters.
Falls back to in-memory rate limiting if Redis is unavailable.
"""

import asyncio
import time
from collections import defaultdict
from typing import Optional

import redis.asyncio as aioredis


class RedisRateLimiter:
    """Per-domain rate limiter backed by Redis."""

    def __init__(self, redis_url: str):
        """Initialize rate limiter.

        Args:
            redis_url: Redis connection URL (e.g., "redis://localhost:6379").
        """
        self._redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None
        self._connected = False
        # In-memory fallback counters: {domain: [(timestamp, count)]}
        self._memory_counters: dict[str, list[float]] = defaultdict(list)

    async def _get_redis(self) -> Optional[aioredis.Redis]:
        """Get or create Redis connection."""
        if self._redis is None:
            try:
                self._redis = aioredis.from_url(
                    self._redis_url, decode_responses=True
                )
                await self._redis.ping()
                self._connected = True
            except Exception:
                self._redis = None
                self._connected = False
        return self._redis

    async def acquire(self, domain: str, rpm_limit: int) -> bool:
        """Acquire a rate limit token for a domain.

        Non-blocking check. Returns True if the request is allowed,
        False if the domain has reached its rate limit.

        Args:
            domain: The domain to rate limit.
            rpm_limit: Maximum requests per minute for this domain.

        Returns:
            True if allowed, False if rate limit reached.
        """
        redis = await self._get_redis()

        if redis and self._connected:
            return await self._acquire_redis(redis, domain, rpm_limit)
        else:
            return self._acquire_memory(domain, rpm_limit)

    async def _acquire_redis(
        self, redis: aioredis.Redis, domain: str, rpm_limit: int
    ) -> bool:
        """Redis-backed rate limit check using sliding window."""
        key = f"rate_limit:{domain}"
        now = time.time()
        window_start = now - 60.0

        try:
            pipe = redis.pipeline()
            # Remove expired entries
            pipe.zremrangebyscore(key, 0, window_start)
            # Count current entries in window
            pipe.zcard(key)
            results = await pipe.execute()
            current_count = results[1]

            if current_count >= rpm_limit:
                return False

            # Add new request timestamp
            await redis.zadd(key, {str(now): now})
            await redis.expire(key, 120)  # TTL slightly longer than window
            return True
        except Exception:
            # Fall back to memory on Redis error
            self._connected = False
            return self._acquire_memory(domain, rpm_limit)

    def _acquire_memory(self, domain: str, rpm_limit: int) -> bool:
        """In-memory fallback rate limiting (per-process only)."""
        now = time.time()
        window_start = now - 60.0

        # Clean old entries
        self._memory_counters[domain] = [
            t for t in self._memory_counters[domain] if t > window_start
        ]

        if len(self._memory_counters[domain]) >= rpm_limit:
            return False

        self._memory_counters[domain].append(now)
        return True

    async def wait_and_acquire(self, domain: str, rpm_limit: int) -> None:
        """Block until a rate limit token is available.

        Args:
            domain: The domain to rate limit.
            rpm_limit: Maximum requests per minute for this domain.
        """
        while not await self.acquire(domain, rpm_limit):
            await asyncio.sleep(1.0)
