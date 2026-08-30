"""Proxy health monitoring.

Periodically checks proxy pool availability and alerts on degradation.
"""

import logging
from typing import Dict, List

import httpx
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Test URLs for proxy health verification
HEALTH_CHECK_URLS = [
    "https://httpbin.org/ip",
    "https://api.ipify.org?format=json",
]


class ProxyHealthChecker:
    """Monitors proxy pool health and availability."""

    def __init__(self, redis_url: str):
        """Initialize health checker.

        Args:
            redis_url: Redis connection URL for storing metrics.
        """
        self._redis_url = redis_url
        self._redis: aioredis.Redis | None = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._redis

    async def check_proxy(self, proxy_url: str, timeout: float = 10.0) -> bool:
        """Test if a proxy is working by making a request through it.

        Args:
            proxy_url: Full proxy URL (http://user:pass@host:port).
            timeout: Request timeout in seconds.

        Returns:
            True if proxy is functional.
        """
        try:
            async with httpx.AsyncClient(
                proxy=proxy_url, timeout=timeout
            ) as client:
                response = await client.get(HEALTH_CHECK_URLS[0])
                return response.status_code == 200
        except Exception as e:
            logger.debug("Proxy health check failed for %s: %s", proxy_url, e)
            return False

    async def get_pool_status(self) -> Dict[str, any]:
        """Get overall proxy pool status from Redis metrics.

        Returns:
            Dict with pool health summary.
        """
        redis = await self._get_redis()
        stats: Dict[str, dict] = {}
        total_success = 0
        total_failure = 0

        async for key in redis.scan_iter("proxy:health:*"):
            domain = key.replace("proxy:health:", "")
            data = await redis.hgetall(key)
            success = int(data.get("success", 0))
            failure = int(data.get("failure", 0))
            total_success += success
            total_failure += failure
            stats[domain] = {"success": success, "failure": failure}

        total = total_success + total_failure
        overall_rate = round(total_success / total, 3) if total > 0 else 0.0

        return {
            "total_requests": total,
            "total_success": total_success,
            "total_failure": total_failure,
            "overall_success_rate": overall_rate,
            "domains_tracked": len(stats),
            "per_domain": stats,
            "status": "healthy" if overall_rate >= 0.85 else "degraded",
        }

    async def get_alerts(self) -> List[Dict[str, any]]:
        """Get active proxy alerts (domains with low success rate).

        Returns:
            List of alert dicts for domains below 70% success rate.
        """
        redis = await self._get_redis()
        alerts = []

        async for key in redis.scan_iter("proxy:health:*"):
            domain = key.replace("proxy:health:", "")
            data = await redis.hgetall(key)
            success = int(data.get("success", 0))
            failure = int(data.get("failure", 0))
            total = success + failure

            if total >= 10:  # Only alert after sufficient samples
                rate = success / total
                if rate < 0.7:
                    alerts.append({
                        "domain": domain,
                        "success_rate": round(rate, 3),
                        "total_requests": total,
                        "alert_type": "low_proxy_success_rate",
                    })

        return alerts
