"""
Redis Embedding Cache — RAG Performance Optimization

TTL-based caching for embeddings to avoid repeated computation.
Reduces latency by ~50ms for repeated queries.

Usage:
    from winlux.rag.embedding_cache import EmbeddingCache
    
    cache = EmbeddingCache(redis_url="redis://localhost:6379")
    
    # Check cache first
    cached = cache.get(text)
    if cached is not None:
        return cached
    
    # Compute and cache
    embedding = embedder.encode_single(text)
    cache.set(text, embedding, ttl=3600)
"""

import hashlib
import json
import logging
import os
from typing import Optional

import numpy as np

logger = logging.getLogger(__name__)

# Default TTL:  1 hour for embeddings
DEFAULT_TTL_SECONDS = 3600

# Redis key prefix to namespace RAG embeddings
KEY_PREFIX = "rag:emb:"


class EmbeddingCache:
    """Redis-based embedding cache with TTL support.

    Features:
    - SHA256 hash of text as cache key (handles long texts)
    - Configurable TTL per embedding
    - Batch get/set operations
    - Graceful fallback when Redis unavailable
    - Model-aware caching (different models = different keys)
    """

    def __init__(
        self,
        redis_url: Optional[str] = None,
        default_ttl: int = DEFAULT_TTL_SECONDS,
        model_name: str = "default",
    ):
        """Initialize embedding cache.

        Args:
            redis_url: Redis connection URL.  Default: env REDIS_URL or redis://localhost:6379
            default_ttl: Default TTL in seconds for cached embeddings
            model_name: Embedding model name (included in cache key for model-aware caching)
        """
        self._redis_url = redis_url or os.getenv("REDIS_URL", "redis://localhost:6379")
        self._default_ttl = default_ttl
        self._model_name = model_name
        self._client = None
        self._connected = False

    def _connect(self) -> bool:
        """Lazy-connect to Redis.  Returns True if connected."""
        if self._client is not None:
            return self._connected

        try:
            import redis

            self._client = redis.from_url(
                self._redis_url,
                decode_responses=False,  # We store binary data
                socket_connect_timeout=2,
                socket_timeout=2,
            )
            # Test connection
            self._client.ping()
            self._connected = True
            logger.info("EmbeddingCache connected to Redis at %s", self._redis_url)
            return True

        except ImportError:
            logger.warning("redis package not installed — EmbeddingCache disabled")
            self._connected = False
            return False

        except Exception as exc:
            logger.warning("Redis connection failed: %s — EmbeddingCache disabled", exc)
            self._connected = False
            return False

    def _make_key(self, text: str) -> str:
        """Generate cache key from text.

        Uses SHA256 hash to handle long texts and ensure consistent key length.
        Includes model name to avoid cross-model collisions.
        """
        text_hash = hashlib.sha256(text.encode("utf-8")).hexdigest()[:32]
        return f"{KEY_PREFIX}{self._model_name}:{text_hash}"

    def get(self, text: str) -> Optional[np.ndarray]:
        """Get cached embedding for text.

        Args:
            text: Input text that was embedded

        Returns:
            numpy array of embedding, or None if not cached
        """
        if not self._connect():
            return None

        try:
            key = self._make_key(text)
            data = self._client.get(key)

            if data is None:
                return None

            # Deserialize numpy array from JSON
            embedding_list = json.loads(data)
            return np.array(embedding_list, dtype=np.float32)

        except Exception as exc:
            logger.debug("Cache get failed for key: %s", exc)
            return None

    def set(
        self,
        text: str,
        embedding: np.ndarray,
        ttl: Optional[int] = None,
    ) -> bool:
        """Cache an embedding.

        Args:
            text: Input text that was embedded
            embedding: The embedding vector (numpy array or list)
            ttl: TTL in seconds.  Default: use default_ttl from init

        Returns:
            True if cached successfully, False otherwise
        """
        if not self._connect():
            return False

        try:
            key = self._make_key(text)
            ttl = ttl or self._default_ttl

            # Serialize numpy array to JSON
            if isinstance(embedding, np.ndarray):
                embedding_list = embedding.tolist()
            else:
                embedding_list = list(embedding)

            data = json.dumps(embedding_list)
            self._client.setex(key, ttl, data)
            return True

        except Exception as exc:
            logger.debug("Cache set failed: %s", exc)
            return False

    def get_batch(self, texts: list[str]) -> dict[str, Optional[np.ndarray]]:
        """Get cached embeddings for multiple texts.

        Args:
            texts: List of input texts

        Returns:
            Dict mapping text -> embedding (or None if not cached)
        """
        if not self._connect() or not texts:
            return {t: None for t in texts}

        try:
            keys = [self._make_key(t) for t in texts]
            values = self._client.mget(keys)

            result = {}
            for text, data in zip(texts, values):
                if data is None:
                    result[text] = None
                else:
                    embedding_list = json.loads(data)
                    result[text] = np.array(embedding_list, dtype=np.float32)

            return result

        except Exception as exc:
            logger.debug("Batch cache get failed: %s", exc)
            return {t: None for t in texts}

    def set_batch(
        self,
        texts: list[str],
        embeddings: list[np.ndarray],
        ttl: Optional[int] = None,
    ) -> int:
        """Cache multiple embeddings.

        Args:
            texts: List of input texts
            embeddings: List of embedding vectors
            ttl: TTL in seconds.  Default: use default_ttl from init

        Returns:
            Number of embeddings cached successfully
        """
        if not self._connect() or not texts:
            return 0

        try:
            ttl = ttl or self._default_ttl
            pipe = self._client.pipeline()

            for text, embedding in zip(texts, embeddings):
                key = self._make_key(text)

                if isinstance(embedding, np.ndarray):
                    embedding_list = embedding.tolist()
                else:
                    embedding_list = list(embedding)

                data = json.dumps(embedding_list)
                pipe.setex(key, ttl, data)

            results = pipe.execute()
            return sum(1 for r in results if r)

        except Exception as exc:
            logger.debug("Batch cache set failed: %s", exc)
            return 0

    def delete(self, text: str) -> bool:
        """Delete cached embedding.

        Args:
            text: Input text to remove from cache

        Returns:
            True if deleted, False otherwise
        """
        if not self._connect():
            return False

        try:
            key = self._make_key(text)
            return self._client.delete(key) > 0

        except Exception as exc:
            logger.debug("Cache delete failed: %s", exc)
            return False

    def clear_model_cache(self) -> int:
        """Clear all cached embeddings for the current model.

        Returns:
            Number of keys deleted
        """
        if not self._connect():
            return 0

        try:
            pattern = f"{KEY_PREFIX}{self._model_name}:*"
            keys = list(self._client.scan_iter(match=pattern, count=1000))

            if not keys:
                return 0

            return self._client.delete(*keys)

        except Exception as exc:
            logger.debug("Cache clear failed: %s", exc)
            return 0

    def stats(self) -> dict:
        """Get cache statistics.

        Returns:
            Dict with cache stats (keys_count, memory_used, etc.)
        """
        if not self._connect():
            return {"status": "disconnected"}

        try:
            pattern = f"{KEY_PREFIX}{self._model_name}:*"
            keys = list(self._client.scan_iter(match=pattern, count=10000))

            info = self._client.info("memory")

            return {
                "status": "connected",
                "model": self._model_name,
                "cached_embeddings": len(keys),
                "redis_memory_used": info.get("used_memory_human", "unknown"),
                "default_ttl_seconds": self._default_ttl,
            }

        except Exception as exc:
            return {"status": "error", "error": str(exc)}


class CachedEmbeddingService:
    """Wrapper around EmbeddingService that adds Redis caching.

    Drop-in replacement for EmbeddingService with automatic caching.

    Usage:
        from winlux.rag.embedding_cache import CachedEmbeddingService
        
        # Wraps existing embedder with caching
        embedder = CachedEmbeddingService(
            model_key="vietnamese-bi-encoder",
            redis_url="redis://localhost:6379"
        )
        
        # First call: computes and caches
        vec1 = embedder.encode_single("xin chào")
        
        # Second call: returns from cache (~50ms faster)
        vec2 = embedder.encode_single("xin chào")
    """

    def __init__(
        self,
        model_key: Optional[str] = None,
        redis_url: Optional[str] = None,
        cache_ttl: int = DEFAULT_TTL_SECONDS,
    ):
        """Initialize cached embedding service.

        Args:
            model_key: Embedding model key (vietnamese-bi-encoder, vietnamese-sbert, etc.)
            redis_url: Redis connection URL
            cache_ttl: Cache TTL in seconds
        """
        from winlux.rag.embedding_service import EmbeddingService

        self._embedder = EmbeddingService(model_key)
        self._cache = EmbeddingCache(
            redis_url=redis_url,
            default_ttl=cache_ttl,
            model_name=self._embedder.model_name,
        )

    @property
    def dimension(self) -> int:
        return self._embedder.dimension

    @property
    def model_name(self) -> str:
        return self._embedder.model_name

    def is_loaded(self) -> bool:
        return self._embedder.is_loaded()

    def encode_single(self, text: str) -> np.ndarray:
        """Encode single text with caching.

        Returns cached embedding if available, otherwise computes and caches.
        """
        # Check cache first
        cached = self._cache.get(text)
        if cached is not None:
            logger.debug("Cache HIT for embedding")
            return cached

        # Compute embedding
        embedding = self._embedder.encode_single(text)

        # Cache for future
        self._cache.set(text, embedding)
        logger.debug("Cache MISS — computed and cached embedding")

        return embedding

    def encode(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Encode multiple texts with caching.

        Checks cache for each text, only computes missing ones.
        """
        if not texts:
            return []

        # Check cache for all texts
        cached_map = self._cache.get_batch(texts)

        # Separate hits and misses
        results = [None] * len(texts)
        texts_to_compute = []
        indices_to_compute = []

        for i, text in enumerate(texts):
            cached = cached_map.get(text)
            if cached is not None:
                results[i] = cached.tolist()
            else:
                texts_to_compute.append(text)
                indices_to_compute.append(i)

        cache_hits = len(texts) - len(texts_to_compute)
        logger.debug("Batch encode: %d cache hits, %d misses", cache_hits, len(texts_to_compute))

        # Compute missing embeddings
        if texts_to_compute:
            computed = self._embedder.encode(texts_to_compute, batch_size=batch_size)

            # Store in results and cache
            embeddings_to_cache = []
            for i, (idx, embedding) in enumerate(zip(indices_to_compute, computed)):
                results[idx] = embedding
                embeddings_to_cache.append(np.array(embedding, dtype=np.float32))

            # Batch cache the new embeddings
            self._cache.set_batch(texts_to_compute, embeddings_to_cache)

        return results

    def cache_stats(self) -> dict:
        """Get cache statistics."""
        return self._cache.stats()
