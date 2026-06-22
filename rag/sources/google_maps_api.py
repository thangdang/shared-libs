"""
Resource Expansion Phase 4 — Google Maps Places API Source.

Fetches local business data for CareMate AI (clinics, pharmacies)
and SmartBuy (retail stores, electronics shops in Vietnam).

Usage:
    from shared_libs.rag.sources.google_maps_api import GoogleMapsSource

    source = GoogleMapsSource()
    places = source.search_nearby("pharmacy", lat=10.7769, lng=106.7009, radius=5000)
    details = source.get_place_details(place_id="ChIJ...")
"""

import logging
import os
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger("rag.sources.google_maps")

GOOGLE_MAPS_API_KEY = os.environ.get("GOOGLE_MAPS_API_KEY", "")
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")
PLACES_API_BASE = "https://maps.googleapis.com/maps/api/place"


class GoogleMapsSource:
    """
    Google Maps Places API integration for local business data.

    Use cases:
    - CareMate: Find nearby clinics, pharmacies, hospitals
    - SmartBuy: Find retail stores for in-store pickup options
    - TrendBrief: Local business news context
    """

    RATE_LIMIT_DELAY = 0.1  # 10 QPS allowed by Google

    def __init__(
        self,
        api_key: str = GOOGLE_MAPS_API_KEY,
        mongo_uri: str = MONGODB_URI,
    ):
        self.api_key = api_key
        self._client = MongoClient(mongo_uri)
        self._db = self._client["shared_places"]
        self._http = httpx.Client(timeout=10.0)
        self._last_request_time = 0.0

    def search_nearby(
        self,
        query: str,
        lat: float,
        lng: float,
        radius: int = 5000,
        place_type: Optional[str] = None,
        language: str = "vi",
        max_results: int = 20,
    ) -> list[dict]:
        """
        Search for places near a location.

        Args:
            query: Search text (e.g., "nhà thuốc", "pharmacy").
            lat: Latitude of center point.
            lng: Longitude of center point.
            radius: Search radius in meters (max 50000).
            place_type: Google place type filter (pharmacy, hospital, etc.).
            language: Response language (default: Vietnamese).
            max_results: Maximum results to return.

        Returns:
            List of place dicts with name, address, rating, location.
        """
        if not self._is_configured():
            logger.warning("Google Maps API key not configured")
            return []

        self._rate_limit()

        params = {
            "query": query,
            "location": f"{lat},{lng}",
            "radius": min(radius, 50000),
            "language": language,
            "key": self.api_key,
        }
        if place_type:
            params["type"] = place_type

        try:
            response = self._http.get(
                f"{PLACES_API_BASE}/textsearch/json", params=params
            )

            if response.status_code != 200:
                logger.error(f"Google Maps API error: {response.status_code}")
                return []

            data = response.json()
            if data.get("status") != "OK":
                logger.warning(f"Google Maps API status: {data.get('status')}")
                return []

            results = data.get("results", [])[:max_results]
            places = [self._normalize_place(r) for r in results]

            # Cache results
            for place in places:
                self._cache_place(place)

            return places

        except Exception as e:
            logger.error(f"Google Maps search failed: {e}")
            return []

    def get_place_details(self, place_id: str, language: str = "vi") -> Optional[dict]:
        """
        Get detailed information about a specific place.

        Args:
            place_id: Google Place ID.
            language: Response language.

        Returns:
            Detailed place dict or None.
        """
        # Check cache (7-day TTL for place details)
        from datetime import timedelta
        cached = self._db.place_details_cache.find_one({
            "place_id": place_id,
            "cached_at": {"$gte": datetime.now(timezone.utc) - timedelta(days=7)},
        })
        if cached:
            cached.pop("_id", None)
            return cached

        if not self._is_configured():
            return None

        self._rate_limit()

        params = {
            "place_id": place_id,
            "fields": "name,formatted_address,formatted_phone_number,opening_hours,rating,user_ratings_total,website,geometry,types,reviews",
            "language": language,
            "key": self.api_key,
        }

        try:
            response = self._http.get(
                f"{PLACES_API_BASE}/details/json", params=params
            )

            if response.status_code != 200:
                return None

            data = response.json()
            if data.get("status") != "OK":
                return None

            result = data.get("result", {})
            place = self._normalize_place_details(result, place_id)

            # Cache
            place["cached_at"] = datetime.now(timezone.utc)
            self._db.place_details_cache.update_one(
                {"place_id": place_id},
                {"$set": place},
                upsert=True,
            )

            return place

        except Exception as e:
            logger.error(f"Google Maps details failed for {place_id}: {e}")
            return None

    def find_pharmacies(self, lat: float, lng: float, radius: int = 3000) -> list[dict]:
        """Convenience: Find pharmacies near a location (for CareMate)."""
        return self.search_nearby(
            "nhà thuốc pharmacy", lat=lat, lng=lng, radius=radius, place_type="pharmacy"
        )

    def find_hospitals(self, lat: float, lng: float, radius: int = 10000) -> list[dict]:
        """Convenience: Find hospitals near a location (for CareMate)."""
        return self.search_nearby(
            "bệnh viện hospital", lat=lat, lng=lng, radius=radius, place_type="hospital"
        )

    def find_electronics_stores(self, lat: float, lng: float, radius: int = 5000) -> list[dict]:
        """Convenience: Find electronics stores (for SmartBuy)."""
        return self.search_nearby(
            "cửa hàng điện tử electronics", lat=lat, lng=lng, radius=radius, place_type="electronics_store"
        )

    # ─── Internal Methods ────────────────────────────────────────

    def _is_configured(self) -> bool:
        return bool(self.api_key)

    def _rate_limit(self):
        elapsed = time.time() - self._last_request_time
        if elapsed < self.RATE_LIMIT_DELAY:
            time.sleep(self.RATE_LIMIT_DELAY - elapsed)
        self._last_request_time = time.time()

    def _normalize_place(self, result: dict) -> dict:
        """Normalize a Places API search result."""
        location = result.get("geometry", {}).get("location", {})

        return {
            "place_id": result.get("place_id", ""),
            "name": result.get("name", ""),
            "address": result.get("formatted_address", ""),
            "lat": location.get("lat", 0),
            "lng": location.get("lng", 0),
            "rating": result.get("rating", 0),
            "total_ratings": result.get("user_ratings_total", 0),
            "types": result.get("types", []),
            "is_open": result.get("opening_hours", {}).get("open_now"),
            "price_level": result.get("price_level"),
            "source": "google_maps",
            "fetched_at": datetime.now(timezone.utc).isoformat(),
        }

    def _normalize_place_details(self, result: dict, place_id: str) -> dict:
        """Normalize a Places API details result."""
        location = result.get("geometry", {}).get("location", {})
        hours = result.get("opening_hours", {})

        reviews = []
        for review in result.get("reviews", [])[:5]:
            reviews.append({
                "author": review.get("author_name", ""),
                "rating": review.get("rating", 0),
                "text": review.get("text", "")[:200],
                "time": review.get("relative_time_description", ""),
            })

        return {
            "place_id": place_id,
            "name": result.get("name", ""),
            "address": result.get("formatted_address", ""),
            "phone": result.get("formatted_phone_number", ""),
            "website": result.get("website", ""),
            "lat": location.get("lat", 0),
            "lng": location.get("lng", 0),
            "rating": result.get("rating", 0),
            "total_ratings": result.get("user_ratings_total", 0),
            "types": result.get("types", []),
            "opening_hours": hours.get("weekday_text", []),
            "is_open": hours.get("open_now"),
            "reviews": reviews,
            "source": "google_maps",
        }

    def _cache_place(self, place: dict):
        """Cache place in MongoDB."""
        place_id = place.get("place_id")
        if place_id:
            self._db.places_cache.update_one(
                {"place_id": place_id},
                {"$set": {**place, "cached_at": datetime.now(timezone.utc)}},
                upsert=True,
            )

    def close(self):
        self._client.close()
        self._http.close()
