"""
Resource Expansion Phase 4 — iHerb Product Source.

Fetches health/supplement product data from iHerb for:
- CareMate AI health product recommendations
- SmartBuy supplement price comparison
- Affiliate revenue via iHerb partner program

Uses iHerb's affiliate API / web scraping with respectful rate limits.

Usage:
    from shared_libs.rag.sources.iherb_api import IHerbSource

    source = IHerbSource()
    products = source.search_products("vitamin D3", category="supplements")
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger("rag.sources.iherb_api")

IHERB_AFFILIATE_CODE = os.environ.get("IHERB_AFFILIATE_CODE", "")
IHERB_API_BASE = "https://www.iherb.com"
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

# iHerb category mapping
IHERB_CATEGORIES = {
    "supplements": "/c/supplements",
    "vitamins": "/c/vitamins",
    "herbs": "/c/herbs-homeopathy",
    "sports": "/c/sports",
    "beauty": "/c/beauty",
    "bath": "/c/bath-personal-care",
    "grocery": "/c/grocery",
    "baby": "/c/baby-kids",
    "pets": "/c/pets",
}


class IHerbSource:
    """
    iHerb product data source for health/supplement products.

    Fetches product information via iHerb's structured data and
    generates affiliate links for revenue tracking.
    """

    RATE_LIMIT_DELAY = 2.0  # 2 seconds between requests (respectful crawling)

    def __init__(
        self,
        affiliate_code: str = IHERB_AFFILIATE_CODE,
        mongo_uri: str = MONGODB_URI,
    ):
        self.affiliate_code = affiliate_code
        self._client = MongoClient(mongo_uri)
        self._db = self._client["smartbuy"]
        self._http = httpx.Client(
            timeout=15.0,
            headers={
                "User-Agent": "SmartBuyAI/1.0 (Product Comparison Bot)",
                "Accept-Language": "vi-VN,vi;q=0.9,en;q=0.8",
            },
        )
        self._last_request_time = 0.0

    def search_products(
        self,
        keywords: str,
        category: str = "supplements",
        max_results: int = 20,
    ) -> list[dict]:
        """
        Search iHerb products by keywords.

        Args:
            keywords: Search query.
            category: Product category (supplements, vitamins, etc.).
            max_results: Maximum results to return.

        Returns:
            List of normalized product dicts.
        """
        self._rate_limit()

        # Build search URL
        search_url = f"{IHERB_API_BASE}/search?kw={keywords.replace(' ', '+')}"
        if category in IHERB_CATEGORIES:
            search_url += f"&cat={category}"

        try:
            response = self._http.get(search_url)

            if response.status_code != 200:
                logger.warning(f"iHerb search returned {response.status_code}")
                return []

            # Parse structured data from response
            products = self._parse_search_results(response.text, max_results)

            # Cache results
            for product in products:
                self._cache_product(product)

            logger.info(f"iHerb search '{keywords}': found {len(products)} products")
            return products

        except Exception as e:
            logger.error(f"iHerb search failed for '{keywords}': {e}")
            return []

    def get_product_details(self, product_id: str) -> Optional[dict]:
        """
        Get detailed product information by iHerb product ID.

        Args:
            product_id: iHerb product identifier (e.g., "CGN-01001").

        Returns:
            Product dict with full details, or None.
        """
        # Check cache first (24h TTL)
        from datetime import timedelta
        cached = self._db.iherb_product_cache.find_one({
            "product_id": product_id,
            "cached_at": {"$gte": datetime.now(timezone.utc) - timedelta(hours=24)},
        })
        if cached:
            cached.pop("_id", None)
            return cached

        self._rate_limit()

        url = f"{IHERB_API_BASE}/pr/{product_id}"

        try:
            response = self._http.get(url)
            if response.status_code != 200:
                return None

            product = self._parse_product_page(response.text, product_id)
            if product:
                self._cache_product(product)

            return product

        except Exception as e:
            logger.error(f"iHerb product detail failed for {product_id}: {e}")
            return None

    def get_affiliate_link(self, product_url: str) -> str:
        """
        Generate an iHerb affiliate link.

        Args:
            product_url: Original iHerb product URL.

        Returns:
            URL with affiliate tracking code appended.
        """
        if not self.affiliate_code:
            return product_url

        separator = "&" if "?" in product_url else "?"
        return f"{product_url}{separator}rcode={self.affiliate_code}"

    def get_category_products(
        self, category: str, sort_by: str = "best-selling", limit: int = 50
    ) -> list[dict]:
        """
        Get top products from a category.

        Args:
            category: Category key from IHERB_CATEGORIES.
            sort_by: Sort order (best-selling, price-asc, rating).
            limit: Max products to fetch.

        Returns:
            List of product dicts.
        """
        if category not in IHERB_CATEGORIES:
            logger.warning(f"Unknown iHerb category: {category}")
            return []

        self._rate_limit()

        url = f"{IHERB_API_BASE}{IHERB_CATEGORIES[category]}?sr={sort_by}"

        try:
            response = self._http.get(url)
            if response.status_code != 200:
                return []

            products = self._parse_search_results(response.text, limit)
            return products

        except Exception as e:
            logger.error(f"iHerb category fetch failed for {category}: {e}")
            return []

    # ─── Internal Methods ────────────────────────────────────────

    def _rate_limit(self):
        """Enforce rate limit between requests."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def _parse_search_results(self, html: str, max_results: int) -> list[dict]:
        """
        Parse product data from iHerb search/category page HTML.

        Extracts JSON-LD structured data and product grid items.
        """
        import re
        import json

        products = []

        # Try to extract JSON-LD product data
        json_ld_pattern = r'<script type="application/ld\+json">(.*?)</script>'
        matches = re.findall(json_ld_pattern, html, re.DOTALL)

        for match in matches[:max_results]:
            try:
                data = json.loads(match)
                if isinstance(data, dict) and data.get("@type") == "Product":
                    products.append(self._normalize_jsonld_product(data))
                elif isinstance(data, list):
                    for item in data:
                        if isinstance(item, dict) and item.get("@type") == "Product":
                            products.append(self._normalize_jsonld_product(item))
            except json.JSONDecodeError:
                continue

        # Fallback: parse product grid with regex
        if not products:
            product_pattern = r'data-pid="([^"]+)".*?data-name="([^"]+)".*?data-price="([^"]+)"'
            grid_matches = re.findall(product_pattern, html)

            for pid, name, price in grid_matches[:max_results]:
                products.append({
                    "product_id": pid,
                    "title": name,
                    "price": float(price) if price else 0,
                    "currency": "USD",
                    "url": f"{IHERB_API_BASE}/pr/{pid}",
                    "affiliate_url": self.get_affiliate_link(f"{IHERB_API_BASE}/pr/{pid}"),
                    "source": "iherb",
                    "fetched_at": datetime.now(timezone.utc).isoformat(),
                })

        return products[:max_results]

    def _parse_product_page(self, html: str, product_id: str) -> Optional[dict]:
        """Parse a single product detail page."""
        import re
        import json

        json_ld_pattern = r'<script type="application/ld\+json">(.*?)</script>'
        matches = re.findall(json_ld_pattern, html, re.DOTALL)

        for match in matches:
            try:
                data = json.loads(match)
                if isinstance(data, dict) and data.get("@type") == "Product":
                    product = self._normalize_jsonld_product(data)
                    product["product_id"] = product_id
                    return product
            except json.JSONDecodeError:
                continue

        return None

    def _normalize_jsonld_product(self, data: dict) -> dict:
        """Normalize a JSON-LD Product schema to our standard format."""
        offers = data.get("offers", {})
        price = 0.0
        currency = "USD"

        if isinstance(offers, dict):
            price = float(offers.get("price", 0))
            currency = offers.get("priceCurrency", "USD")
        elif isinstance(offers, list) and offers:
            price = float(offers[0].get("price", 0))
            currency = offers[0].get("priceCurrency", "USD")

        rating = data.get("aggregateRating", {})

        return {
            "product_id": data.get("sku", ""),
            "title": data.get("name", ""),
            "description": data.get("description", "")[:500],
            "price": price,
            "currency": currency,
            "url": data.get("url", ""),
            "affiliate_url": self.get_affiliate_link(data.get("url", "")),
            "image_url": data.get("image", ""),
            "brand": data.get("brand", {}).get("name", "") if isinstance(data.get("brand"), dict) else str(data.get("brand", "")),
            "rating": float(rating.get("ratingValue", 0)) if rating else 0,
            "review_count": int(rating.get("reviewCount", 0)) if rating else 0,
            "category": data.get("category", ""),
            "source": "iherb",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    def _cache_product(self, product: dict):
        """Cache product in MongoDB."""
        pid = product.get("product_id") or product.get("title", "")[:50]
        if pid:
            self._db.iherb_product_cache.update_one(
                {"product_id": pid},
                {"$set": {**product, "cached_at": datetime.now(timezone.utc)}},
                upsert=True,
            )

    def close(self):
        """Clean up resources."""
        self._client.close()
        self._http.close()
