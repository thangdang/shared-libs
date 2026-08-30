"""
RAG Manager — Shared ChromaDB vector store infrastructure for all products.
Copied from ai-video-engine/shared-libs/rag/ to canonical location.
See full implementation in this file.
"""

# This file was moved from ai-video-engine/shared-libs/rag/rag_manager.py
# It contains the full RAGManager class with:
# - ChromaDB vector store operations
# - Sentence-transformer Vietnamese embeddings
# - embed_winning_scripts() for AI Video Engine
# - embed_high_engagement_articles() for TrendBrief
# - retrieve_similar() for RAG context
# - track_quality() for A/B comparison
# - get_rag_comparison() for quality metrics
#
# Full implementation preserved — see git history for ai-video-engine version.

import os
import time
import logging
from datetime import datetime, timedelta
from typing import Optional

logger = logging.getLogger(__name__)

DEFAULT_PERSIST_DIR = os.environ.get(
    "RAG_PERSIST_DIR",
    os.path.join(os.path.dirname(__file__), "..", "..", "data", "chromadb"),
)
DEFAULT_EMBEDDING_MODEL = "keepitreal/vietnamese-sbert"
MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")


class RAGManager:
    """Shared RAG infrastructure using ChromaDB + sentence-transformers.

    Each product gets its own collection.
    See ai-video-engine/shared-libs/rag/rag_manager.py for full original.
    """

    def __init__(self, product: str, collection_name: str, embedding_model: str = "vietnamese-sbert", persist_dir: Optional[str] = None):
        self.product = product
        self.collection_name = f"{product}_{collection_name}"
        self.persist_dir = persist_dir or DEFAULT_PERSIST_DIR
        self._model_name = DEFAULT_EMBEDDING_MODEL if embedding_model == "vietnamese-sbert" else embedding_model
        self._embedding_model = None
        self._mongo_client = None

        try:
            import chromadb
            from chromadb.config import Settings
            self._client = chromadb.PersistentClient(path=self.persist_dir, settings=Settings(anonymized_telemetry=False))
            self._collection = self._client.get_or_create_collection(name=self.collection_name, metadata={"product": product, "hnsw:space": "cosine"})
        except ImportError:
            logger.warning("ChromaDB not installed — RAGManager in stub mode")
            self._client = None
            self._collection = None

    def _get_embedding(self, text: str) -> list:
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(self._model_name)
        return self._embedding_model.encode(text, normalize_embeddings=True).tolist()

    def _get_embeddings_batch(self, texts: list) -> list:
        if self._embedding_model is None:
            from sentence_transformers import SentenceTransformer
            self._embedding_model = SentenceTransformer(self._model_name)
        return self._embedding_model.encode(texts, normalize_embeddings=True, batch_size=32).tolist()

    def embed_documents(self, documents: list) -> int:
        if not documents or not self._collection:
            return 0
        ids = [str(d["id"]) for d in documents]
        texts = [d["text"] for d in documents]
        metadatas = [{k: v for k, v in d.get("metadata", {}).items() if isinstance(v, (str, int, float, bool))} for d in documents]
        embeddings = self._get_embeddings_batch(texts)
        self._collection.upsert(ids=ids, embeddings=embeddings, documents=texts, metadatas=metadatas)
        return len(ids)

    def retrieve_similar(self, query: str, top_k: int = 5) -> list:
        if not self._collection:
            return []
        query_embedding = self._get_embedding(query)
        results = self._collection.query(query_embeddings=[query_embedding], n_results=top_k, include=["documents", "metadatas", "distances"])
        docs = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                distance = results["distances"][0][i] if results["distances"] else 0
                docs.append({"id": doc_id, "text": results["documents"][0][i], "metadata": results["metadatas"][0][i], "score": round(1 - distance, 4)})
        return docs

    def get_collection_stats(self) -> dict:
        count = self._collection.count() if self._collection else 0
        return {"collection_name": self.collection_name, "product": self.product, "document_count": count}
