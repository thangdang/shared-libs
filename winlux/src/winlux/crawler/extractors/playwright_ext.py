"""Playwright extractor for JavaScript-rendered pages."""

from typing import List

from winlux.crawler.extractors.base import BaseExtractor


class PlaywrightExtractor(BaseExtractor):
    """Extract articles from JS-rendered pages using Playwright."""

    async def extract(self, url: str, config: dict) -> List[dict]:
        """Render a page with Playwright and extract articles.

        Args:
            url: Target page URL.
            config: playwright_config dict with keys:
                - wait_for: CSS selector to wait for before extraction
                - scroll: Whether to scroll page for lazy loading (bool)
                - selectors: Same format as HTMLExtractor selectors

        Returns:
            List of article dicts extracted from rendered page.
        """
        from playwright.async_api import async_playwright
        from bs4 import BeautifulSoup

        pw_config = config.get("playwright_config", {})
        selectors = config.get("selectors", pw_config.get("selectors", {}))
        wait_for = pw_config.get("wait_for")
        scroll = pw_config.get("scroll", False)

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(url, wait_until="networkidle", timeout=60000)

                if wait_for:
                    await page.wait_for_selector(wait_for, timeout=30000)

                if scroll:
                    # Scroll to bottom to trigger lazy loading
                    await page.evaluate(
                        "window.scrollTo(0, document.body.scrollHeight)"
                    )
                    await page.wait_for_timeout(2000)

                html = await page.content()
            finally:
                await browser.close()

        # Parse with BeautifulSoup using same logic as HTML extractor
        soup = BeautifulSoup(html, "html.parser")
        article_selector = selectors.get("article", "article")
        articles = soup.select(article_selector)
        results = []

        for article in articles:
            title_el = article.select_one(selectors.get("title", "h2"))
            title = title_el.get_text(strip=True) if title_el else ""

            content_el = article.select_one(selectors.get("content", "p"))
            content = content_el.get_text(strip=True) if content_el else ""

            link_el = article.select_one(selectors.get("link", "a"))
            link = link_el.get("href", "") if link_el else ""
            if link and not link.startswith("http"):
                from urllib.parse import urljoin
                link = urljoin(url, link)

            image_url = None
            img_el = article.select_one(selectors.get("image", "img"))
            if img_el:
                image_url = img_el.get("src") or img_el.get("data-src")

            results.append({
                "url": link,
                "title": title,
                "content": content,
                "published_at": None,
                "image_url": image_url,
                "metadata": {"source_url": url, "rendered": True},
            })

        return results
