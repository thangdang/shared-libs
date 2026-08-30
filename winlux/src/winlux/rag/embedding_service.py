"""Shared Embedding Service — Task 1.

Vietnamese-optimized embedding with lazy model loading.
Supports 3 models: vietnamese-bi-encoder (768-dim), vietnamese-sbert (768-dim),
multilingual-MiniLM (384-dim). Auto-download on first use, cache locally.
"""

import logging
import os

import numpy as np

logger = logging.getLogger(__name__)

# Model registry
MODELS = {
    "vietnamese-bi-encoder": {
        "name": "bkai-foundation-models/vietnamese-bi-encoder",
        "dim": 768,
    },
    "vietnamese-sbert": {
        "name": "keepitreal/vietnamese-sbert",
        "dim": 768,
    },
    "multilingual-minilm": {
        "name": "paraphrase-multilingual-MiniLM-L12-v2",
        "dim": 384,
    },
}


class EmbeddingService:
    """Vietnamese-optimized embedding with lazy model loading.

    Config model via env var EMBEDDING_MODEL. Default: vietnamese-bi-encoder.
    """

    def __init__(self, model_key: str | None = None):
        self._model_key = model_key or os.getenv("EMBEDDING_MODEL", "vietnamese-bi-encoder")
        self._model = None

    def _load_model(self):
        """Lazy-load the sentence transformer model."""
        if self._model is not None:
            return
        from sentence_transformers import SentenceTransformer

        config = MODELS.get(self._model_key)
        if not config:
            raise ValueError(f"Unknown embedding model: {self._model_key}. Available: {list(MODELS.keys())}")

        logger.info("Loading embedding model: %s (%s)", self._model_key, config["name"])
        self._model = SentenceTransformer(config["name"])
        logger.info("✅ Embedding model loaded: dim=%d", self.dimension)

    @property
    def dimension(self) -> int:
        """Return embedding dimension without loading model."""
        config = MODELS.get(self._model_key)
        if config:
            return config["dim"]
        return 768

    @property
    def model_name(self) -> str:
        return self._model_key

    def is_loaded(self) -> bool:
        return self._model is not None

    def encode(self, texts: list[str], batch_size: int = 32) -> list[list[float]]:
        """Encode multiple texts into embeddings.

        Args:
            texts: List of text strings to embed.
            batch_size: Batch size for encoding (default 32).

        Returns:
            List of embedding vectors (list of floats).
        """
        self._load_model()
        if not texts:
            return []
        embeddings = self._model.encode(
            texts, batch_size=batch_size, show_progress_bar=False, normalize_embeddings=True
        )
        return embeddings.tolist()

    def encode_single(self, text: str) -> np.ndarray:
        """Encode a single text into an embedding vector.

        Returns:
            numpy array of shape (dim,)
        """
        self._load_model()
        embedding = self._model.encode([text], show_progress_bar=False, normalize_embeddings=True)
        return embedding[0]
