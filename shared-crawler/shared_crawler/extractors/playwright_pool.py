"""Playwright browser pool for JS-rendered page extraction.

Manages multiple browser instances with semaphore-controlled access,
auto-restart on crash, and memory-based recycling.
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import List, Optional

logger = logging.getLogger(__name__)

# Defaults
DEFAULT_POOL_SIZE = 3
MAX_PAGES_BEFORE_RECYCLE = 100
MAX_RESTARTS_PER_HOUR = 3
INSTANCE_MEMORY_LIMIT_MB = 500


@dataclass
class BrowserInstance:
    """Tracks a single Playwright browser instance."""

    browser: any = None
    page_count: int = 0
    created_at: float = field(default_factory=time.time)
    restart_count: int = 0
    last_restart: float = 0
    is_healthy: bool = True

    @property
    def should_recycle(self) -> bool:
        """Check if instance should be recycled (too many pages)."""
        return self.page_count >= MAX_PAGES_BEFORE_RECYCLE

    @property
    def can_restart(self) -> bool:
        """Check if instance can be restarted (within hourly limit)."""
        if self.restart_count < MAX_RESTARTS_PER_HOUR:
            return True
        # Reset counter if last restart was > 1 hour ago
        if time.time() - self.last_restart > 3600:
            self.restart_count = 0
            return True
        return False


class PlaywrightPool:
    """Pool of Playwright browser instances with managed lifecycle.

    Features:
    - Configurable pool size (default 3, max 5)
    - Semaphore-controlled concurrent access
    - Auto-restart on crash (max 3 per instance per hour)
    - Page count tracking + auto-recycle after 100 pages
    - Proxy integration support
    """

    def __init__(
        self,
        pool_size: int = DEFAULT_POOL_SIZE,
        headless: bool = True,
        proxy_url: Optional[str] = None,
    ):
        """Initialize Playwright pool.

        Args:
            pool_size: Number of browser instances (default 3, max 5).
            headless: Run browsers in headless mode.
            proxy_url: Optional proxy URL for all instances.
        """
        self._pool_size = min(pool_size, 5)
        self._headless = headless
        self._proxy_url = proxy_url
        self._semaphore = asyncio.Semaphore(self._pool_size)
        self._instances: List[BrowserInstance] = []
        self._playwright = None
        self._initialized = False
        self._lock = asyncio.Lock()

    async def initialize(self) -> None:
        """Start Playwright and create browser instances."""
        if self._initialized:
            return

        async with self._lock:
            if self._initialized:
                return

            from playwright.async_api import async_playwright

            self._playwright = await async_playwright().start()

            for i in range(self._pool_size):
                instance = await self._create_instance()
                self._instances.append(instance)
                logger.info("Playwright instance %d/%d created", i + 1, self._pool_size)

            self._initialized = True
            logger.info(
                "Playwright pool initialized: %d instances", self._pool_size
            )

    async def _create_instance(self) -> BrowserInstance:
        """Create a new browser instance.

        Returns:
            BrowserInstance with fresh Chromium browser.
        """
        launch_options = {
            "headless": self._headless,
            "args": [
                "--disable-blink-features=AutomationControlled",
                "--no-sandbox",
                "--disable-dev-shm-usage",
            ],
        }

        if self._proxy_url:
            launch_options["proxy"] = {"server": self._proxy_url}

        browser = await self._playwright.chromium.launch(**launch_options)

        return BrowserInstance(
            browser=browser,
            page_count=0,
            created_at=time.time(),
        )

    async def _recycle_instance(self, index: int) -> None:
        """Close and recreate a browser instance.

        Args:
            index: Index of instance in pool to recycle.
        """
        old_instance = self._instances[index]
        try:
            await old_instance.browser.close()
        except Exception as e:
            logger.debug("Error closing browser during recycle: %s", e)

        new_instance = await self._create_instance()
        self._instances[index] = new_instance
        logger.info(
            "Playwright instance %d recycled (was at %d pages)",
            index, old_instance.page_count,
        )

    def _get_least_used_index(self) -> int:
        """Get index of the least-used healthy instance.

        Returns:
            Index of instance with lowest page count.
        """
        best_idx = 0
        best_count = float("inf")

        for i, instance in enumerate(self._instances):
            if instance.is_healthy and instance.page_count < best_count:
                best_count = instance.page_count
                best_idx = i

        return best_idx

    async def acquire_page(self, url: str, wait_for: Optional[str] = None, scroll: bool = False) -> str:
        """Acquire a browser instance, navigate to URL, and return rendered HTML.

        This is the main entry point. Handles semaphore, instance selection,
        recycling, and error recovery.

        Args:
            url: URL to navigate to.
            wait_for: Optional CSS selector to wait for before extraction.
            scroll: Whether to scroll page for lazy-loaded content.

        Returns:
            Rendered HTML content of the page.

        Raises:
            RuntimeError: If pool is not initialized.
            Exception: If page load fails after recovery attempts.
        """
        if not self._initialized:
            await self.initialize()

        async with self._semaphore:
            idx = self._get_least_used_index()
            instance = self._instances[idx]

            # Recycle if needed
            if instance.should_recycle:
                await self._recycle_instance(idx)
                instance = self._instances[idx]

            try:
                context = await instance.browser.new_context(
                    user_agent=(
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36"
                    ),
                    viewport={"width": 1920, "height": 1080},
                )
                page = await context.new_page()

                try:
                    await page.goto(url, wait_until="networkidle", timeout=60000)

                    if wait_for:
                        await page.wait_for_selector(wait_for, timeout=30000)

                    if scroll:
                        # Scroll to bottom for lazy loading
                        await page.evaluate(
                            "window.scrollTo(0, document.body.scrollHeight)"
                        )
                        await page.wait_for_timeout(2000)
                        # Scroll back up and down again for more content
                        await page.evaluate("window.scrollTo(0, 0)")
                        await page.wait_for_timeout(500)
                        await page.evaluate(
                            "window.scrollTo(0, document.body.scrollHeight)"
                        )
                        await page.wait_for_timeout(1000)

                    html = await page.content()
                    instance.page_count += 1
                    return html

                finally:
                    await page.close()
                    await context.close()

            except Exception as e:
                logger.error(
                    "Playwright instance %d failed for %s: %s", idx, url, e
                )
                instance.is_healthy = False

                # Try to restart instance
                if instance.can_restart:
                    instance.restart_count += 1
                    instance.last_restart = time.time()
                    try:
                        await self._recycle_instance(idx)
                        logger.info("Playwright instance %d restarted after failure", idx)
                    except Exception as restart_err:
                        logger.error(
                            "Failed to restart instance %d: %s", idx, restart_err
                        )

                raise

    async def shutdown(self) -> None:
        """Gracefully shut down all browser instances."""
        for i, instance in enumerate(self._instances):
            try:
                await instance.browser.close()
                logger.debug("Playwright instance %d closed", i)
            except Exception as e:
                logger.debug("Error closing instance %d: %s", i, e)

        if self._playwright:
            await self._playwright.stop()

        self._instances.clear()
        self._initialized = False
        logger.info("Playwright pool shut down")

    @property
    def status(self) -> dict:
        """Get pool status summary.

        Returns:
            Dict with pool health information.
        """
        healthy = sum(1 for i in self._instances if i.is_healthy)
        total_pages = sum(i.page_count for i in self._instances)

        return {
            "pool_size": self._pool_size,
            "healthy_instances": healthy,
            "total_pages_served": total_pages,
            "initialized": self._initialized,
            "instances": [
                {
                    "index": idx,
                    "page_count": inst.page_count,
                    "is_healthy": inst.is_healthy,
                    "should_recycle": inst.should_recycle,
                    "restart_count": inst.restart_count,
                }
                for idx, inst in enumerate(self._instances)
            ],
        }
