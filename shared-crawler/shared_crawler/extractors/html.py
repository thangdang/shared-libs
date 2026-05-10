"""HTML extractor using httpx + BeautifulSoup with CSS selectors."""

from typing import List

import httpx
from bs4 import BeautifulSoup

from shared_crawler.extractors.base import BaseExtractor


class HTMLExtractor(BaseExtractor):
    """Extract articles from HTML pages using CSS selectors."""

    async def extract(self, url: str, config: dict) -> List[dict]:
        """Fetch HTML page and extract articles using CSS selectors.

        Args:
            url: Target page URL.
            config: Must contain 'selectors' dict with keys:
                - article: CSS selector for article containers
                - title: CSS selector for title within article
                - content: CSS selector for content within article
                - link: CSS selector for link within article (optional)
                - image: CSS selector for image within article (optional)
                - published: CSS selector for date within article (optional)

        Returns:
            List of article dicts extracted from the page.
        """
        selectors = config.get("selectors", {})
        if not selectors:
            return []

        headers = config.get("headers", {})
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers)
            response.raise_for_status()

        soup = BeautifulSoup(response.text, "html.parser")
        article_selector = selectors.get("article", "article")
        articles = soup.select(article_selector)
        results = []

        for article in articles:
            # Extract title
            title_el = article.select_one(selectors.get("title", "h2"))
            title = title_el.get_text(strip=True) if title_el else ""

            # Extract content
            content_el = article.select_one(selectors.get("content", "p"))
            content = content_el.get_text(strip=True) if content_el else ""

            # Extract link
            link_el = article.select_one(selectors.get("link", "a"))
            link = link_el.get("href", "") if link_el else ""
            if link and not link.startswith("http"):
                # Resolve relative URL
                from urllib.parse import urljoin
                link = urljoin(url, link)

            # Extract image
            image_url = None
            img_selector = selectors.get("image", "img")
            img_el = article.select_one(img_selector)
            if img_el:
                image_url = img_el.get("src") or img_el.get("data-src")

            # Extract published date
            published_at = None
            pub_selector = selectors.get("published")
            if pub_selector:
                pub_el = article.select_one(pub_selector)
                if pub_el:
                    published_at = pub_el.get_text(strip=True)

            results.append({
                "url": link,
                "title": title,
                "content": content,
                "published_at": published_at,
                "image_url": image_url,
                "metadata": {"source_url": url},
            })

        return results
