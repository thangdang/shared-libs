"""JSON API extractor using httpx."""

from typing import List

import httpx

from shared_crawler.extractors.base import BaseExtractor


class APIExtractor(BaseExtractor):
    """Extract articles from JSON API endpoints."""

    async def extract(self, url: str, config: dict) -> List[dict]:
        """Fetch JSON from an API endpoint and extract articles.

        Args:
            url: API endpoint URL.
            config: api_config dict with keys:
                - headers: Request headers (optional)
                - params: Query parameters (optional)
                - data_path: Dot-notation path to articles array
                  (e.g., "data.articles") (optional, defaults to root)
                - field_map: Mapping of standard fields to API fields
                  (optional, e.g., {"title": "headline", "url": "link"})

        Returns:
            List of article dicts extracted from the API response.
        """
        api_config = config.get("api_config", {})
        headers = api_config.get("headers", {})
        params = api_config.get("params", {})

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(url, headers=headers, params=params)
            response.raise_for_status()

        data = response.json()

        # Navigate to articles array using data_path
        data_path = api_config.get("data_path", "")
        if data_path:
            for key in data_path.split("."):
                if isinstance(data, dict):
                    data = data.get(key, [])
                else:
                    break

        # Ensure data is a list
        if not isinstance(data, list):
            data = [data] if isinstance(data, dict) else []

        # Map fields
        field_map = api_config.get("field_map", {})
        results = []

        for item in data:
            if not isinstance(item, dict):
                continue

            results.append({
                "url": item.get(field_map.get("url", "url"), ""),
                "title": item.get(field_map.get("title", "title"), ""),
                "content": item.get(field_map.get("content", "content"), ""),
                "published_at": item.get(field_map.get("published_at", "published_at")),
                "image_url": item.get(field_map.get("image_url", "image_url")),
                "metadata": {
                    k: v for k, v in item.items()
                    if k not in ("url", "title", "content", "published_at", "image_url")
                },
            })

        return results
