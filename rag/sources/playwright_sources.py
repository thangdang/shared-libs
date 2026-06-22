"""
Resource Expansion Phase 4 — Playwright-Based Crawl Sources.

Handles JavaScript-rendered pages that require a full browser:
- Single Page Applications (SPAs)
- Lazy-loaded product listings
- Dynamic pricing pages
- Anti-bot protected sites (with stealth mode)

Usage:
    from shared_libs.rag.sources.playwright_sources import PlaywrightCrawlSource

    source = PlaywrightCrawlSource()
    products = await source.crawl_page("https://example.com/products", selectors={...})
"""

import asyncio
import logging
import os
import random
import time
from datetime import datetime, timezone
from typing import Optional

from pymongo import MongoClient

logger = logging.getLogger("rag.sources.playwright")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

# Stealth mode user agents (rotate to avoid detection)
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
]


class PlaywrightCrawlSource:
    """
    Playwright-based crawler for JavaScript-rendered pages.

    Features:
    - Headless Chromium with stealth patches
    - Auto-scroll for lazy-loaded content
    - Cookie/session persistence
    - Screenshot on error for debugging
    - Configurable wait strategies (networkidle, selector, timeout)
    """

    def __init__(self, mongo_uri: str = MONGODB_URI, headless: bool = True):
        self._client = MongoClient(mongo_uri)
        self._db = self._client["smartbuy"]
        self._headless = headless
        self._browser = None
        self._context = None

    async def initialize(self):
        """Initialize Playwright browser instance."""
        try:
            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()
            self._browser = await self._playwright.chromium.launch(
                headless=self._headless,
                args=[
                    "--disable-blink-features=AutomationControlled",
                    "--disable-dev-shm-usage",
                    "--no-sandbox",
                ],
            )

            # Create context with stealth settings
            self._context = await self._browser.new_context(
                user_agent=random.choice(USER_AGENTS),
                viewport={"width": 1920, "height": 1080},
                locale="vi-VN",
                timezone_id="Asia/Ho_Chi_Minh",
            )

            # Add stealth scripts
            await self._context.add_init_script("""
                Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
                Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3] });
            """)

            logger.info("Playwright browser initialized (headless=%s)", self._headless)

        except ImportError:
            logger.error("playwright not installed. Run: pip install playwright && playwright install chromium")
            raise

    async def crawl_page(
        self,
        url: str,
        selectors: dict,
        wait_for: str = "networkidle",
        scroll_to_bottom: bool = True,
        max_scroll_attempts: int = 5,
        timeout_ms: int = 30000,
    ) -> list[dict]:
        """
        Crawl a JavaScript-rendered page and extract product data.

        Args:
            url: Page URL to crawl.
            selectors: CSS selectors for data extraction:
                - product_list: Container selector for product items
                - product_name: Name within each item
                - price: Price within each item
                - image_url: Image URL within each item
                - url: Product link within each item
            wait_for: Wait strategy ("networkidle", "domcontentloaded", or CSS selector).
            scroll_to_bottom: Whether to auto-scroll for lazy loading.
            max_scroll_attempts: Max scroll iterations.
            timeout_ms: Page load timeout in milliseconds.

        Returns:
            List of extracted product dicts.
        """
        if not self._browser:
            await self.initialize()

        page = await self._context.new_page()

        try:
            # Navigate with timeout
            await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)

            # Wait for content
            if wait_for == "networkidle":
                await page.wait_for_load_state("networkidle", timeout=timeout_ms)
            elif wait_for.startswith(".") or wait_for.startswith("#"):
                await page.wait_for_selector(wait_for, timeout=timeout_ms)

            # Auto-scroll for lazy-loaded content
            if scroll_to_bottom:
                await self._auto_scroll(page, max_scroll_attempts)

            # Extract products
            products = await self._extract_products(page, selectors, url)

            # Cache results
            for product in products:
                self._cache_product(product)

            logger.info(f"Playwright crawled {url}: {len(products)} products extracted")
            return products

        except Exception as e:
            logger.error(f"Playwright crawl failed for {url}: {e}")
            # Screenshot for debugging
            try:
                screenshot_path = f"/tmp/playwright_error_{int(time.time())}.png"
                await page.screenshot(path=screenshot_path)
                logger.info(f"Error screenshot saved: {screenshot_path}")
            except Exception:
                pass
            return []

        finally:
            await page.close()

    async def crawl_with_pagination(
        self,
        base_url: str,
        selectors: dict,
        pagination_selector: str,
        max_pages: int = 10,
    ) -> list[dict]:
        """
        Crawl multiple pages with pagination support.

        Args:
            base_url: First page URL.
            selectors: Product extraction selectors.
            pagination_selector: CSS selector for "next page" button.
            max_pages: Maximum pages to crawl.

        Returns:
            Aggregated list of products from all pages.
        """
        all_products = []

        if not self._browser:
            await self.initialize()

        page = await self._context.new_page()

        try:
            await page.goto(base_url, wait_until="networkidle", timeout=30000)

            for page_num in range(max_pages):
                # Extract products from current page
                products = await self._extract_products(page, selectors, base_url)
                all_products.extend(products)

                logger.info(f"Page {page_num + 1}: extracted {len(products)} products")

                # Try to navigate to next page
                next_button = await page.query_selector(pagination_selector)
                if not next_button:
                    break

                await next_button.click()
                await page.wait_for_load_state("networkidle", timeout=15000)

                # Random delay between pages
                await asyncio.sleep(random.uniform(1.0, 3.0))

        except Exception as e:
            logger.error(f"Pagination crawl failed at page: {e}")

        finally:
            await page.close()

        return all_products

    # ─── Internal Methods ────────────────────────────────────────

    async def _auto_scroll(self, page, max_attempts: int):
        """Scroll to bottom to trigger lazy loading."""
        for _ in range(max_attempts):
            previous_height = await page.evaluate("document.body.scrollHeight")
            await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
            await asyncio.sleep(1.5)
            new_height = await page.evaluate("document.body.scrollHeight")

            if new_height == previous_height:
                break

    async def _extract_products(self, page, selectors: dict, source_url: str) -> list[dict]:
        """Extract product data using configured selectors."""
        products = []

        product_list_selector = selectors.get("product_list", ".product-item")
        items = await page.query_selector_all(product_list_selector)

        for item in items:
            try:
                product = await self._extract_single_product(item, selectors, source_url)
                if product and product.get("title"):
                    products.append(product)
            except Exception as e:
                logger.debug(f"Failed to extract product item: {e}")
                continue

        return products

    async def _extract_single_product(self, item, selectors: dict, source_url: str) -> dict:
        """Extract data from a single product element."""
        product = {
            "source": "playwright",
            "source_url": source_url,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

        # Name
        name_sel = selectors.get("product_name", ".product-name")
        name_el = await item.query_selector(name_sel)
        if name_el:
            product["title"] = (await name_el.inner_text()).strip()

        # Price
        price_sel = selectors.get("price", ".price")
        price_el = await item.query_selector(price_sel)
        if price_el:
            price_text = (await price_el.inner_text()).strip()
            product["price_text"] = price_text
            product["price"] = self._parse_price(price_text)

        # Image
        img_sel = selectors.get("image_url", "img")
        img_el = await item.query_selector(img_sel)
        if img_el:
            product["image_url"] = (
                await img_el.get_attribute("src")
                or await img_el.get_attribute("data-src")
                or ""
            )

        # URL
        url_sel = selectors.get("url", "a")
        url_el = await item.query_selector(url_sel)
        if url_el:
            href = await url_el.get_attribute("href")
            if href:
                if href.startswith("/"):
                    from urllib.parse import urljoin
                    href = urljoin(source_url, href)
                product["url"] = href

        return product

    @staticmethod
    def _parse_price(price_text: str) -> float:
        """Parse Vietnamese price text to float (e.g., '12.990.000₫' → 12990000)."""
        import re
        # Remove currency symbols and whitespace
        cleaned = re.sub(r'[₫đ$VND\s]', '', price_text)
        # Handle Vietnamese number format (dots as thousands separator)
        cleaned = cleaned.replace('.', '').replace(',', '.')
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def _cache_product(self, product: dict):
        """Cache crawled product."""
        url = product.get("url", "")
        if url:
            self._db.playwright_crawl_cache.update_one(
                {"url": url},
                {"$set": {**product, "cached_at": datetime.now(timezone.utc)}},
                upsert=True,
            )

    async def close(self):
        """Clean up browser and MongoDB resources."""
        if self._context:
            await self._context.close()
        if self._browser:
            await self._browser.close()
        if hasattr(self, '_playwright'):
            await self._playwright.stop()
        self._client.close()
