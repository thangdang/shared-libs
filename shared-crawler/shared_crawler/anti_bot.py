"""Anti-bot measures: User-Agent rotation and request timing randomization.

Helps avoid detection and blocking by target websites.
"""

import asyncio
import random
from typing import Dict, Optional

# Pool of 12 realistic browser User-Agent strings
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
]

# Extended backoff delay for 403/429 responses (seconds)
EXTENDED_BACKOFF_DELAY = 30.0


class AntiBotManager:
    """Manages User-Agent rotation and request timing."""

    def __init__(self):
        """Initialize anti-bot manager."""
        self._ua_index = 0
        self._blocked_domains: Dict[str, float] = {}

    def get_user_agent(self) -> str:
        """Get the next User-Agent from the rotation pool.

        Rotates through the pool sequentially for even distribution.

        Returns:
            A User-Agent string.
        """
        ua = USER_AGENTS[self._ua_index % len(USER_AGENTS)]
        self._ua_index += 1
        return ua

    def get_random_user_agent(self) -> str:
        """Get a random User-Agent (used after blocks).

        Returns:
            A randomly selected User-Agent string.
        """
        return random.choice(USER_AGENTS)

    def get_headers(self, extra_headers: Optional[Dict[str, str]] = None) -> Dict[str, str]:
        """Get request headers with rotated User-Agent.

        Args:
            extra_headers: Additional headers to include.

        Returns:
            Headers dict with User-Agent and common browser headers.
        """
        headers = {
            "User-Agent": self.get_user_agent(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    async def randomize_delay(self, min_delay: float = 0.5, max_delay: float = 3.0) -> None:
        """Apply a random delay to avoid detectable request patterns.

        Args:
            min_delay: Minimum delay in seconds.
            max_delay: Maximum delay in seconds.
        """
        delay = random.uniform(min_delay, max_delay)
        await asyncio.sleep(delay)

    def handle_block(self, domain: str) -> Dict[str, str]:
        """Handle a 403/429 response by switching User-Agent.

        Records the domain as blocked and returns new headers
        with a different User-Agent.

        Args:
            domain: The domain that returned 403/429.

        Returns:
            New headers with a different User-Agent.
        """
        import time
        self._blocked_domains[domain] = time.time()
        return self.get_headers({"User-Agent": self.get_random_user_agent()})

    async def wait_after_block(self) -> None:
        """Apply extended backoff delay after receiving a block response."""
        await asyncio.sleep(EXTENDED_BACKOFF_DELAY)

    def is_recently_blocked(self, domain: str, window: float = 300.0) -> bool:
        """Check if a domain was recently blocked (within window).

        Args:
            domain: Domain to check.
            window: Time window in seconds (default 5 minutes).

        Returns:
            True if domain was blocked within the window.
        """
        import time
        blocked_at = self._blocked_domains.get(domain)
        if blocked_at is None:
            return False
        return (time.time() - blocked_at) < window
