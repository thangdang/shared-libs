"""Unit tests for shared_crawler.rate_limiter module."""

import pytest
from shared_crawler.rate_limiter import RedisRateLimiter


class TestInMemoryFallback:
    """Tests for in-memory rate limiting fallback."""

    def setup_method(self):
        # Use invalid Redis URL to force in-memory fallback
        self.limiter = RedisRateLimiter("redis://invalid:9999")
        self.limiter._connected = False

    @pytest.mark.asyncio
    async def test_acquire_within_limit(self):
        """Requests within limit are allowed."""
        # Allow 5 requests per minute
        for _ in range(5):
            result = await self.limiter.acquire("example.com", 5)
            assert result is True

    @pytest.mark.asyncio
    async def test_acquire_exceeds_limit(self):
        """Requests exceeding limit are rejected."""
        # Allow 3 requests per minute
        for _ in range(3):
            await self.limiter.acquire("example.com", 3)

        # 4th request should be rejected
        result = await self.limiter.acquire("example.com", 3)
        assert result is False

    @pytest.mark.asyncio
    async def test_different_domains_independent(self):
        """Rate limits are per-domain."""
        # Fill up domain A
        for _ in range(2):
            await self.limiter.acquire("a.com", 2)

        # Domain B should still be allowed
        result = await self.limiter.acquire("b.com", 2)
        assert result is True

    @pytest.mark.asyncio
    async def test_acquire_returns_bool(self):
        """acquire() returns a boolean."""
        result = await self.limiter.acquire("test.com", 10)
        assert isinstance(result, bool)
