"""Proxy rotation pool for avoiding IP bans on crawled sources."""

from shared_crawler.proxy.pool import ProxyPool, ProxyConfig, ProxyInfo
from shared_crawler.proxy.health_check import ProxyHealthChecker

__all__ = [
    "ProxyPool",
    "ProxyConfig",
    "ProxyInfo",
    "ProxyHealthChecker",
]
