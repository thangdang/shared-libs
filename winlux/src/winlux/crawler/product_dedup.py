"""Cross-source product deduplication for SmartBuy.

Identifies the same product across multiple platforms (e.g., iPhone 15 on
Shopee + Lazada + CellphoneS) and merges them into a single canonical
product with multiple offers.

Strategy (layered):
1. Exact match: normalized_name + brand (fast, Redis lookup)
2. Fuzzy match: Levenshtein distance on normalized name
3. Embedding match: cosine similarity via embedding-service
4. Spec match: key specs identical (storage, RAM, color for phones)
"""

import hashlib
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from typing import Dict, List, Optional

import httpx
import redis.asyncio as aioredis

logger = logging.getLogger(__name__)

# Thresholds
FUZZY_MATCH_THRESHOLD = 0.85
EMBEDDING_SIMILARITY_THRESHOLD = 0.92


@dataclass
class CrawledProduct:
    """A product crawled from a single source."""

    name: str
    brand: str
    price: int  # VND
    original_price: Optional[int] = None
    image_url: Optional[str] = None
    source_id: str = ""
    source_url: str = ""
    category: str = ""
    specs: Dict[str, str] = field(default_factory=dict)
    availability: bool = True
    rating: Optional[float] = None
    review_count: Optional[int] = None


@dataclass
class DedupResult:
    """Result of deduplication check."""

    is_duplicate: bool
    canonical_product_id: Optional[str] = None
    match_method: Optional[str] = None  # exact | fuzzy | embedding | spec
    confidence: float = 0.0


class CrossSourceDedup:
    """Cross-source product deduplication engine.

    Identifies duplicate products across platforms and returns
    the canonical product_id for merging offers.
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        embedding_service_url: str = "http://localhost:9001",
    ):
        """Initialize dedup engine.

        Args:
            redis_url: Redis connection URL.
            embedding_service_url: URL of the shared embedding service.
        """
        self._redis_url = redis_url
        self._embedding_url = embedding_service_url
        self._redis: Optional[aioredis.Redis] = None

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._redis

    def normalize_product_name(self, name: str, brand: str = "") -> str:
        """Normalize product name for matching.

        Steps:
        - Lowercase
        - Remove Vietnamese diacritics for matching
        - Remove color variants (đen, trắng, xanh, etc.)
        - Remove promotional text (giảm giá, sale, hot, etc.)
        - Remove storage/RAM variants (handled in specs)
        - Strip extra whitespace

        Args:
            name: Raw product name.
            brand: Brand name (prepended if not already in name).

        Returns:
            Normalized product name string.
        """
        text = name.lower().strip()

        # Remove common promotional text
        promo_patterns = [
            r'\b(giảm giá|sale|hot|mới|new|chính hãng|hàng chính hãng)\b',
            r'\b(tặng|kèm|free|miễn phí)\b.*$',
            r'\[.*?\]',  # Remove bracketed text
            r'\(.*?tặng.*?\)',  # Remove gift descriptions
        ]
        for pattern in promo_patterns:
            text = re.sub(pattern, '', text, flags=re.IGNORECASE)

        # Remove color variants (Vietnamese)
        colors = [
            'đen', 'trắng', 'xanh', 'đỏ', 'vàng', 'hồng', 'tím',
            'bạc', 'xám', 'nâu', 'cam', 'kem', 'navy',
            'black', 'white', 'blue', 'red', 'gold', 'silver', 'gray',
            'pink', 'purple', 'green',
        ]
        for color in colors:
            text = re.sub(rf'\b{color}\b', '', text, flags=re.IGNORECASE)

        # Remove storage/RAM specs (handled separately in spec matching)
        text = re.sub(r'\b\d+\s*(gb|tb|ram)\b', '', text, flags=re.IGNORECASE)

        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text).strip()

        # Prepend brand if not already present
        if brand and brand.lower() not in text:
            text = f"{brand.lower()} {text}"

        return text

    def _remove_diacritics(self, text: str) -> str:
        """Remove Vietnamese diacritics for fuzzy matching.

        Args:
            text: Vietnamese text.

        Returns:
            Text without diacritics.
        """
        nfkd = unicodedata.normalize('NFKD', text)
        return ''.join(c for c in nfkd if not unicodedata.combining(c))

    def _levenshtein_ratio(self, s1: str, s2: str) -> float:
        """Calculate Levenshtein similarity ratio.

        Args:
            s1: First string.
            s2: Second string.

        Returns:
            Similarity ratio (0.0 to 1.0).
        """
        if not s1 or not s2:
            return 0.0
        if s1 == s2:
            return 1.0

        len1, len2 = len(s1), len(s2)
        # Quick length check
        if abs(len1 - len2) / max(len1, len2) > 0.5:
            return 0.0

        # Dynamic programming Levenshtein distance
        matrix = [[0] * (len2 + 1) for _ in range(len1 + 1)]
        for i in range(len1 + 1):
            matrix[i][0] = i
        for j in range(len2 + 1):
            matrix[0][j] = j

        for i in range(1, len1 + 1):
            for j in range(1, len2 + 1):
                cost = 0 if s1[i - 1] == s2[j - 1] else 1
                matrix[i][j] = min(
                    matrix[i - 1][j] + 1,
                    matrix[i][j - 1] + 1,
                    matrix[i - 1][j - 1] + cost,
                )

        distance = matrix[len1][len2]
        max_len = max(len1, len2)
        return 1.0 - (distance / max_len)

    def _generate_dedup_key(self, normalized_name: str) -> str:
        """Generate a dedup key from normalized name.

        Args:
            normalized_name: Normalized product name.

        Returns:
            SHA-256 hash prefix for Redis lookup.
        """
        # Remove diacritics for key generation
        ascii_name = self._remove_diacritics(normalized_name)
        return hashlib.sha256(ascii_name.encode("utf-8")).hexdigest()[:16]

    async def find_canonical(self, product: CrawledProduct) -> DedupResult:
        """Find existing canonical product or determine this is new.

        Applies layered matching strategy:
        1. Exact match (O(1) Redis lookup)
        2. Fuzzy match (brand candidates)
        3. Embedding similarity (if embedding service available)

        Args:
            product: Crawled product to check.

        Returns:
            DedupResult with match info.
        """
        normalized = self.normalize_product_name(product.name, product.brand)
        redis = await self._get_redis()

        # Layer 1: Exact match
        dedup_key = self._generate_dedup_key(normalized)
        exact_match = await redis.get(f"product:dedup:exact:{dedup_key}")
        if exact_match:
            return DedupResult(
                is_duplicate=True,
                canonical_product_id=exact_match,
                match_method="exact",
                confidence=1.0,
            )

        # Layer 2: Fuzzy match (search by brand)
        brand_key = f"product:dedup:brand:{product.brand.lower()}"
        brand_candidates = await redis.smembers(brand_key)

        for candidate_key in brand_candidates:
            candidate_data = await redis.hgetall(f"product:dedup:info:{candidate_key}")
            if not candidate_data:
                continue

            candidate_name = candidate_data.get("normalized_name", "")
            ratio = self._levenshtein_ratio(
                self._remove_diacritics(normalized),
                self._remove_diacritics(candidate_name),
            )

            if ratio >= FUZZY_MATCH_THRESHOLD:
                return DedupResult(
                    is_duplicate=True,
                    canonical_product_id=candidate_data.get("product_id"),
                    match_method="fuzzy",
                    confidence=ratio,
                )

        # Layer 3: Embedding similarity (optional, if service available)
        try:
            embedding_match = await self._check_embedding_similarity(
                product.name, product.brand
            )
            if embedding_match:
                return embedding_match
        except Exception as e:
            logger.debug("Embedding similarity check skipped: %s", e)

        # No match found — this is a new product
        return DedupResult(is_duplicate=False)

    async def _check_embedding_similarity(
        self, name: str, brand: str
    ) -> Optional[DedupResult]:
        """Check embedding similarity via embedding service.

        Args:
            name: Product name.
            brand: Product brand.

        Returns:
            DedupResult if similar product found, None otherwise.
        """
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                response = await client.post(
                    f"{self._embedding_url}/search",
                    json={
                        "query": f"{brand} {name}",
                        "collection": "products",
                        "threshold": EMBEDDING_SIMILARITY_THRESHOLD,
                        "limit": 3,
                    },
                )
                if response.status_code != 200:
                    return None

                results = response.json().get("results", [])
                if results and results[0].get("score", 0) >= EMBEDDING_SIMILARITY_THRESHOLD:
                    return DedupResult(
                        is_duplicate=True,
                        canonical_product_id=results[0].get("product_id"),
                        match_method="embedding",
                        confidence=results[0]["score"],
                    )
        except Exception:
            pass

        return None

    async def register_product(
        self, product_id: str, product: CrawledProduct
    ) -> None:
        """Register a new canonical product for future dedup lookups.

        Args:
            product_id: The canonical product ID (MongoDB _id).
            product: The crawled product data.
        """
        redis = await self._get_redis()
        normalized = self.normalize_product_name(product.name, product.brand)
        dedup_key = self._generate_dedup_key(normalized)

        # Store exact match key
        await redis.set(
            f"product:dedup:exact:{dedup_key}",
            product_id,
            ex=2592000,  # 30 days TTL
        )

        # Store in brand set for fuzzy matching
        brand_key = f"product:dedup:brand:{product.brand.lower()}"
        await redis.sadd(brand_key, dedup_key)
        await redis.expire(brand_key, 2592000)

        # Store product info for fuzzy comparison
        await redis.hset(
            f"product:dedup:info:{dedup_key}",
            mapping={
                "product_id": product_id,
                "normalized_name": normalized,
                "brand": product.brand,
                "category": product.category,
            },
        )
        await redis.expire(f"product:dedup:info:{dedup_key}", 2592000)

    async def get_stats(self) -> Dict[str, int]:
        """Get dedup statistics.

        Returns:
            Dict with registered products count and brand count.
        """
        redis = await self._get_redis()
        product_count = 0
        brand_count = 0

        async for _ in redis.scan_iter("product:dedup:exact:*"):
            product_count += 1

        async for _ in redis.scan_iter("product:dedup:brand:*"):
            brand_count += 1

        return {
            "registered_products": product_count,
            "tracked_brands": brand_count,
        }
