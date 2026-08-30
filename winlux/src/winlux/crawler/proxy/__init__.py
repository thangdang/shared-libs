"""Proxy rotation pool for avoiding IP bans on crawled sources."""

from winlux.crawler.proxy.pool import ProxyPool, ProxyConfig, ProxyInfo
from winlux.crawler.proxy.health_check import ProxyHealthChecker

__all__ = [
    "ProxyPool",
    "ProxyConfig",
    "ProxyInfo",
    "ProxyHealthChecker",
]
