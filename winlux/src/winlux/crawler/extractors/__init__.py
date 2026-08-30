"""Crawl extractors for different source types."""

from winlux.crawler.extractors.base import BaseExtractor
from winlux.crawler.extractors.rss import RSSExtractor
from winlux.crawler.extractors.html import HTMLExtractor
from winlux.crawler.extractors.api import APIExtractor
from winlux.crawler.extractors.playwright_ext import PlaywrightExtractor
from winlux.crawler.extractors.playwright_pool import PlaywrightPool

__all__ = [
    "BaseExtractor",
    "RSSExtractor",
    "HTMLExtractor",
    "APIExtractor",
    "PlaywrightExtractor",
    "PlaywrightPool",
]
