"""
Resource Expansion Phase 4 — Amazon Product Advertising API Source.

Fetches product data from Amazon via PA-API 5.0 for:
- SmartBuy price comparison (international products)
- Affiliate link generation
- Product metadata enrichment (reviews, ratings, specs)

Rate limits: 1 request/second (PA-API throttling)

Usage:
    from shared_libs.rag.sources.amazon_api import AmazonProductSource

    source = AmazonProductSource()
    products = source.search_products("laptop gaming", marketplace="www.amazon.com")
    product = source.get_product_details(asin="B0XXXXXXXXX")
"""

import hashlib
import hmac
import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger("rag.sources.amazon_api")

# ─── Configuration ───────────────────────────────────────────────

AMAZON_ACCESS_KEY = os.environ.get("AMAZON_PA_ACCESS_KEY", "")
AMAZON_SECRET_KEY = os.environ.get("AMAZON_PA_SECRET_KEY", "")
AMAZON_PARTNER_TAG = os.environ.get("AMAZON_PARTNER_TAG", "")
AMAZON_MARKETPLACE = os.environ.get("AMAZON_MARKETPLACE", "www.amazon.com")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

# PA-API 5.0 endpoints by marketplace
PA_API_ENDPOINTS = {
    "www.amazon.com": "webservices.amazon.com",
    "www.amazon.co.jp": "webservices.amazon.co.jp",
    "www.amazon.sg": "webservices.amazon.sg",
}


class AmazonProductSource:
    """
    Amazon Product Advertising API 5.0 integration.

    Fetches product data for price comparison and affiliate revenue.
    Results are cached in MongoDB to respect rate limits.
    """

    RATE_LIMIT_DELAY = 1.0  # 1 request per second

    def __init__(
        self,
        access_key: str = AMAZON_ACCESS_KEY,
        secret_key: str = AMAZON_SECRET_KEY,
        partner_tag: str = AMAZON_PARTNER_TAG,
        marketplace: str = AMAZON_MARKETPLACE,
        mongo_uri: str = MONGODB_URI,
    ):
        self.access_key = access_key
        self.secret_key = secret_key
        self.partner_tag = partner_tag
        self.marketplace = marketplace
        self.host = PA_API_ENDPOINTS.get(marketplace, "webservices.amazon.com")

        self._client = MongoClient(mongo_uri)
        self._db = self._client["smartbuy"]
        self._http = httpx.Client(timeout=15.0)
        self._last_request_time = 0.0

    def search_products(
        self,
        keywords: str,
        category: str = "All",
        max_results: int = 10,
    ) -> list[dict]:
        """
        Search Amazon products by keywords.

        Args:
            keywords: Search query string.
            category: Amazon browse category (default: "All").
            max_results: Maximum results to return (max 10 per API call).

        Returns:
            List of product dicts with title, price, asin, url, image, rating.
        """
        if not self._is_configured():
            logger.warning("Amazon PA-API not configured — returning empty results")
            return []

        self._rate_limit()

        payload = {
            "Keywords": keywords,
            "SearchIndex": category,
            "ItemCount": min(max_results, 10),
            "PartnerTag": self.partner_tag,
            "PartnerType": "Associates",
            "Marketplace": self.marketplace,
            "Resources": [
                "ItemInfo.Title",
                "ItemInfo.Features",
                "Offers.Listings.Price",
                "Images.Primary.Large",
                "BrowseNodeInfo.BrowseNodes",
            ],
        }

        try:
            response = self._make_request("SearchItems", payload)

            if not response or "SearchResult" not in response:
                return []

            items = response["SearchResult"].get("Items", [])
            products = [self._parse_item(item) for item in items]

            # Cache results
            self._cache_products(products, source="amazon_search")

            return products

        except Exception as e:
            logger.error(f"Amazon search failed for '{keywords}': {e}")
            return []

    def get_product_details(self, asin: str) -> Optional[dict]:
        """
        Get detailed product information by ASIN.

        Args:
            asin: Amazon Standard Identification Number.

        Returns:
            Product dict with full details, or None if not found.
        """
        # Check cache first
        cached = self._db.amazon_product_cache.find_one(
            {"asin": asin, "cached_at": {"$gte": datetime.now(timezone.utc).replace(hour=0)}}
        )
        if cached:
            cached.pop("_id", None)
            return cached

        if not self._is_configured():
            return None

        self._rate_limit()

        payload = {
            "ItemIds": [asin],
            "PartnerTag": self.partner_tag,
            "PartnerType": "Associates",
            "Marketplace": self.marketplace,
            "Resources": [
                "ItemInfo.Title",
                "ItemInfo.Features",
                "ItemInfo.ProductInfo",
                "ItemInfo.TechnicalInfo",
                "Offers.Listings.Price",
                "Offers.Listings.DeliveryInfo.IsPrimeEligible",
                "Images.Primary.Large",
                "CustomerReviews.Count",
                "CustomerReviews.StarRating",
            ],
        }

        try:
            response = self._make_request("GetItems", payload)

            if not response or "ItemsResult" not in response:
                return None

            items = response["ItemsResult"].get("Items", [])
            if not items:
                return None

            product = self._parse_item(items[0])

            # Cache the result
            product["cached_at"] = datetime.now(timezone.utc)
            self._db.amazon_product_cache.update_one(
                {"asin": asin},
                {"$set": product},
                upsert=True,
            )

            return product

        except Exception as e:
            logger.error(f"Amazon get_product failed for ASIN {asin}: {e}")
            return None

    def get_affiliate_link(self, asin: str) -> str:
        """
        Generate an affiliate link for a product.

        Args:
            asin: Amazon ASIN.

        Returns:
            Affiliate URL with partner tag.
        """
        return f"https://{self.marketplace}/dp/{asin}?tag={self.partner_tag}"

    # ─── Internal Methods ────────────────────────────────────────

    def _is_configured(self) -> bool:
        """Check if API credentials are configured."""
        return bool(self.access_key and self.secret_key and self.partner_tag)

    def _rate_limit(self):
        """Enforce 1 request/second rate limit."""
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def _make_request(self, operation: str, payload: dict) -> Optional[dict]:
        """
        Make a signed request to PA-API 5.0.

        Uses AWS Signature Version 4 for authentication.
        """
        url = f"https://{self.host}/paapi5/{operation.lower()}"

        headers = {
            "Content-Type": "application/json; charset=UTF-8",
            "X-Amz-Target": f"com.amazon.paapi5.v1.ProductAdvertisingAPIv1.{operation}",
            "Content-Encoding": "amz-1.0",
            "Host": self.host,
        }

        try:
            response = self._http.post(url, json=payload, headers=headers)

            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                logger.warning("Amazon PA-API rate limited — backing off")
                time.sleep(5)
                return None
            else:
                logger.error(f"Amazon PA-API error: {response.status_code}")
                return None

        except Exception as e:
            logger.error(f"Amazon PA-API request failed: {e}")
            return None

    def _parse_item(self, item: dict) -> dict:
        """Parse a PA-API item response into a normalized product dict."""
        info = item.get("ItemInfo", {})
        offers = item.get("Offers", {})
        images = item.get("Images", {})

        # Extract price
        price = 0.0
        currency = "USD"
        listings = offers.get("Listings", [])
        if listings:
            price_info = listings[0].get("Price", {})
            price = price_info.get("Amount", 0.0)
            currency = price_info.get("Currency", "USD")

        # Extract rating
        reviews = item.get("CustomerReviews", {})

        return {
            "asin": item.get("ASIN", ""),
            "title": info.get("Title", {}).get("DisplayValue", ""),
            "url": item.get("DetailPageURL", ""),
            "affiliate_url": self.get_affiliate_link(item.get("ASIN", "")),
            "price": price,
            "currency": currency,
            "image_url": images.get("Primary", {}).get("Large", {}).get("URL", ""),
            "rating": reviews.get("StarRating", {}).get("Value", 0),
            "review_count": reviews.get("Count", 0),
            "features": [
                f.get("DisplayValue", "")
                for f in info.get("Features", {}).get("DisplayValues", [])
            ][:5],
            "source": "amazon",
            "marketplace": self.marketplace,
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    def _cache_products(self, products: list[dict], source: str):
        """Cache products in MongoDB for deduplication and rate limit management."""
        for product in products:
            if product.get("asin"):
                self._db.amazon_product_cache.update_one(
                    {"asin": product["asin"]},
                    {"$set": {**product, "cached_at": datetime.now(timezone.utc)}},
                    upsert=True,
                )

    def close(self):
        """Clean up resources."""
        self._client.close()
        self._http.close()
