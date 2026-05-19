"""Rotating proxy pool manager.

Manages residential proxies with intelligent routing per domain.
Tracks proxy health and auto-rotates on failures.
"""

import logging
import random
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set

import redis.asyncio as aioredis

logger = logging.getLogger(__name__)


@dataclass
class ProxyConfig:
    """Configuration for the proxy pool."""

    provider: str = "brightdata"  # brightdata | oxylabs | smartproxy
    pool_size: int = 100
    geo: str = "VN"
    rotation_mode: str = "per_request"  # per_request | per_session | sticky
    redis_url: str = "redis://localhost:6379"

    # Provider credentials (loaded from env)
    username: str = ""
    password: str = ""
    host: str = ""
    port: int = 0

    # Domains that don't need proxy (RSS feeds, public APIs)
    no_proxy_domains: Set[str] = field(default_factory=lambda: {
        # RSS feeds - public, no blocking
        "dantri.com.vn",
        "zingnews.vn",
        "tuoitre.vn",
        "cafebiz.vn",
        "genk.vn",
        "ictnews.vietnamnet.vn",
        "baomoi.com",
        "kenh14.vn",
        "vietnamnet.vn",
        "thanhnien.vn",
        "suckhoedoisong.vn",
        # Public APIs
        "api.amazon.com",
        "api.iherb.com",
        "maps.googleapis.com",
        # Ollama (local)
        "localhost",
        "127.0.0.1",
    })

    # Domains requiring sticky sessions (login/session-based)
    sticky_domains: Set[str] = field(default_factory=lambda: {
        "mims.com",
        "thuocsi.vn",
    })


@dataclass
class ProxyInfo:
    """Information about a single proxy."""

    host: str
    port: int
    username: str
    password: str
    protocol: str = "http"
    session_id: Optional[str] = None

    @property
    def url(self) -> str:
        """Get proxy URL for httpx/requests."""
        auth = f"{self.username}:{self.password}@" if self.username else ""
        return f"{self.protocol}://{auth}{self.host}:{self.port}"

    @property
    def playwright_server(self) -> str:
        """Get proxy server URL for Playwright."""
        return f"{self.protocol}://{self.host}:{self.port}"


class ProxyPool:
    """Manages rotating residential proxies with health tracking.

    Features:
    - Per-domain routing (some domains skip proxy)
    - Health tracking per proxy per domain
    - Auto-rotation on failures
    - Sticky sessions for login-required sites
    - Redis-backed health metrics
    """

    def __init__(self, config: ProxyConfig):
        """Initialize proxy pool.

        Args:
            config: ProxyConfig with provider credentials and settings.
        """
        self.config = config
        self._redis: Optional[aioredis.Redis] = None
        self._session_counter = 0

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self.config.redis_url, decode_responses=True
            )
        return self._redis

    def _needs_proxy(self, domain: str) -> bool:
        """Check if domain needs proxy routing.

        Args:
            domain: Target domain.

        Returns:
            False if domain is in no_proxy list.
        """
        # Check exact match and parent domain
        for no_proxy in self.config.no_proxy_domains:
            if domain == no_proxy or domain.endswith(f".{no_proxy}"):
                return False
        return True

    def _get_rotation_mode(self, domain: str) -> str:
        """Get rotation mode for a domain.

        Args:
            domain: Target domain.

        Returns:
            Rotation mode string.
        """
        for sticky_domain in self.config.sticky_domains:
            if domain == sticky_domain or domain.endswith(f".{sticky_domain}"):
                return "sticky"
        return self.config.rotation_mode

    def _generate_session_id(self, domain: str) -> str:
        """Generate a session ID for sticky proxy sessions.

        Args:
            domain: Domain for the session.

        Returns:
            Unique session identifier.
        """
        self._session_counter += 1
        return f"{domain}_{self._session_counter}_{int(time.time())}"

    def _build_proxy(self, session_id: Optional[str] = None) -> ProxyInfo:
        """Build a ProxyInfo based on provider configuration.

        For Bright Data style providers, session is controlled via username suffix.

        Args:
            session_id: Optional session ID for sticky sessions.

        Returns:
            ProxyInfo with connection details.
        """
        username = self.config.username
        if session_id and self.config.provider == "brightdata":
            # Bright Data uses username suffix for session control
            username = f"{self.config.username}-session-{session_id}"
        elif session_id and self.config.provider == "oxylabs":
            username = f"{self.config.username}-sessid-{session_id}"

        return ProxyInfo(
            host=self.config.host,
            port=self.config.port,
            username=username,
            password=self.config.password,
            protocol="http",
            session_id=session_id,
        )

    async def get_proxy(self, domain: str) -> Optional[ProxyInfo]:
        """Get the best proxy for a domain.

        Args:
            domain: Target domain to crawl.

        Returns:
            ProxyInfo if proxy needed, None if domain skips proxy.
        """
        if not self._needs_proxy(domain):
            logger.debug("Domain '%s' skips proxy (no-proxy list)", domain)
            return None

        rotation_mode = self._get_rotation_mode(domain)

        if rotation_mode == "sticky":
            # Reuse session for this domain
            redis = await self._get_redis()
            session_key = f"proxy:session:{domain}"
            session_id = await redis.get(session_key)

            if not session_id:
                session_id = self._generate_session_id(domain)
                # Sticky sessions last 10 minutes
                await redis.set(session_key, session_id, ex=600)

            return self._build_proxy(session_id=session_id)

        elif rotation_mode == "per_request":
            # New session per request (maximum rotation)
            session_id = f"req_{random.randint(100000, 999999)}"
            return self._build_proxy(session_id=session_id)

        else:
            # Default: no session control, provider handles rotation
            return self._build_proxy()

    async def report_result(
        self, domain: str, success: bool, proxy: Optional[ProxyInfo] = None
    ) -> None:
        """Report crawl result for proxy health tracking.

        Args:
            domain: Domain that was crawled.
            success: Whether the request succeeded.
            proxy: The proxy that was used (None if direct).
        """
        if proxy is None:
            return  # No proxy used, nothing to track

        redis = await self._get_redis()
        health_key = f"proxy:health:{domain}"

        if success:
            await redis.hincrby(health_key, "success", 1)
        else:
            await redis.hincrby(health_key, "failure", 1)
            # If sticky session failed, invalidate it
            if proxy.session_id:
                session_key = f"proxy:session:{domain}"
                await redis.delete(session_key)
                logger.warning(
                    "Proxy session invalidated for domain '%s' after failure",
                    domain,
                )

        # Set TTL on health key (7 days)
        await redis.expire(health_key, 604800)

    async def get_health_stats(self) -> Dict[str, dict]:
        """Get proxy health statistics per domain.

        Returns:
            Dict mapping domain to {success, failure, success_rate}.
        """
        redis = await self._get_redis()
        stats = {}

        # Scan for all proxy health keys
        async for key in redis.scan_iter("proxy:health:*"):
            domain = key.replace("proxy:health:", "")
            data = await redis.hgetall(key)
            success = int(data.get("success", 0))
            failure = int(data.get("failure", 0))
            total = success + failure
            stats[domain] = {
                "success": success,
                "failure": failure,
                "success_rate": round(success / total, 3) if total > 0 else 0.0,
            }

        return stats

    async def invalidate_session(self, domain: str) -> None:
        """Force invalidate a sticky session for a domain.

        Args:
            domain: Domain whose session should be invalidated.
        """
        redis = await self._get_redis()
        session_key = f"proxy:session:{domain}"
        await redis.delete(session_key)
        logger.info("Proxy session invalidated for domain '%s'", domain)
