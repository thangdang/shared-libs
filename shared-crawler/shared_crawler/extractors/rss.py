"""RSS feed extractor using feedparser."""

from typing import List

import feedparser

from shared_crawler.extractors.base import BaseExtractor


class RSSExtractor(BaseExtractor):
    """Extract articles from RSS/Atom feeds."""

    async def extract(self, url: str, config: dict) -> List[dict]:
        """Parse an RSS/Atom feed and extract entries.

        Args:
            url: RSS feed URL.
            config: Optional rss_config with feed-specific options.

        Returns:
            List of article dicts extracted from feed entries.
        """
        feed = feedparser.parse(url)
        results = []

        for entry in feed.entries:
            # Extract content - prefer summary, fall back to content
            content = ""
            if hasattr(entry, "summary"):
                content = entry.summary
            elif hasattr(entry, "content") and entry.content:
                content = entry.content[0].get("value", "")

            # Extract published date
            published_at = None
            if hasattr(entry, "published"):
                published_at = entry.published
            elif hasattr(entry, "updated"):
                published_at = entry.updated

            # Extract image
            image_url = None
            if hasattr(entry, "media_content") and entry.media_content:
                image_url = entry.media_content[0].get("url")
            elif hasattr(entry, "enclosures") and entry.enclosures:
                for enc in entry.enclosures:
                    if enc.get("type", "").startswith("image/"):
                        image_url = enc.get("href")
                        break

            results.append({
                "url": entry.get("link", ""),
                "title": entry.get("title", ""),
                "content": content,
                "published_at": published_at,
                "image_url": image_url,
                "metadata": {
                    "feed_title": feed.feed.get("title", ""),
                    "entry_id": entry.get("id", ""),
                },
            })

        return results
