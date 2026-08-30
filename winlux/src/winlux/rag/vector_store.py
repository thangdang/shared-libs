"""Vector Store — Task 2 & 3.

Abstract VectorStore interface + FAISSStore and ChromaStore implementations.
Methods: index(), upsert(), search(), delete(), count().
"""

import logging
import os
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Single search result from vector store."""
    id: str
    score: float
    document: str
    metadata: dict = field(default_factory=dict)


class VectorStore(ABC):
    """Abstract vector store interface."""

    @abstractmethod
    def index(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Index documents. Returns count indexed."""
        ...

    @abstractmethod
    def upsert(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Insert or update documents. Returns count upserted."""
        ...

    @abstractmethod
    def search(self, query: str, top_k: int = 5, filters: dict | None = None) -> list[SearchResult]:
        """Semantic search with optional metadata filters."""
        ...

    @abstractmethod
    def delete(self, ids: list[str]) -> int:
        """Delete documents by ID. Returns count deleted."""
        ...

    @abstractmethod
    def count(self) -> int:
        """Total documents in index."""
        ...


class FAISSStore(VectorStore):
    """FAISS-based vector store — in-memory, fast, periodic rebuild.

    Uses IndexFlatIP for < 50K docs, IndexIVFFlat for > 50K.
    """

    IVF_THRESHOLD = 50_000

    def __init__(self, embedding_service, persist_dir: str | None = None):
        self._embedder = embedding_service
        self._persist_dir = persist_dir
        self._index = None
        self._ids: list[str] = []
        self._documents: list[str] = []
        self._metadatas: list[dict] = []

    def index(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Full rebuild of the FAISS index."""
        import faiss

        if not texts:
            return 0

        metadatas = metadatas or [{} for _ in texts]
        embeddings = self._embedder.encode(texts)
        vectors = np.array(embeddings, dtype="float32")

        n = len(texts)
        dim = vectors.shape[1]

        if n < self.IVF_THRESHOLD:
            self._index = faiss.IndexFlatIP(dim)
            self._index.add(vectors)
        else:
            nlist = min(int(n ** 0.5), 256)
            quantizer = faiss.IndexFlatIP(dim)
            self._index = faiss.IndexIVFFlat(quantizer, dim, nlist, faiss.METRIC_INNER_PRODUCT)
            self._index.train(vectors)
            self._index.add(vectors)
            self._index.nprobe = min(nlist // 4, 32)

        self._ids = list(ids)
        self._documents = list(texts)
        self._metadatas = list(metadatas)

        if self._persist_dir:
            self._save()

        logger.info("FAISS indexed %d documents (dim=%d)", n, dim)
        return n

    def upsert(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Add or update documents. For FAISS, appends to existing index."""
        if self._index is None:
            return self.index(ids, texts, metadatas)

        metadatas = metadatas or [{} for _ in texts]
        embeddings = self._embedder.encode(texts)
        vectors = np.array(embeddings, dtype="float32")

        # Remove existing IDs first
        for doc_id in ids:
            if doc_id in self._ids:
                idx = self._ids.index(doc_id)
                self._ids.pop(idx)
                self._documents.pop(idx)
                self._metadatas.pop(idx)

        # Add new vectors
        self._index.add(vectors)
        self._ids.extend(ids)
        self._documents.extend(texts)
        self._metadatas.extend(metadatas)

        return len(ids)

    def search(self, query: str, top_k: int = 5, filters: dict | None = None) -> list[SearchResult]:
        """Search FAISS index with optional metadata post-filtering."""
        if self._index is None or self._index.ntotal == 0:
            return []

        query_vec = self._embedder.encode_single(query).reshape(1, -1).astype("float32")
        # Search more if we need to filter
        search_k = min(top_k * 3 if filters else top_k, self._index.ntotal)
        scores, indices = self._index.search(query_vec, search_k)

        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < 0 or idx >= len(self._ids):
                continue

            # Apply metadata filters
            if filters:
                meta = self._metadatas[idx] if idx < len(self._metadatas) else {}
                if not self._matches_filters(meta, filters):
                    continue

            results.append(SearchResult(
                id=self._ids[idx],
                score=float(score),
                document=self._documents[idx] if idx < len(self._documents) else "",
                metadata=self._metadatas[idx] if idx < len(self._metadatas) else {},
            ))

            if len(results) >= top_k:
                break

        return results

    def delete(self, ids: list[str]) -> int:
        """Delete by ID (marks for exclusion — full rebuild needed for actual removal)."""
        deleted = 0
        for doc_id in ids:
            if doc_id in self._ids:
                idx = self._ids.index(doc_id)
                self._ids[idx] = "__deleted__"
                deleted += 1
        return deleted

    def count(self) -> int:
        return len([i for i in self._ids if i != "__deleted__"])

    def _matches_filters(self, metadata: dict, filters: dict) -> bool:
        """Check if metadata matches all filter criteria."""
        for key, value in filters.items():
            if key not in metadata:
                return False
            if str(metadata[key]) != str(value):
                return False
        return True

    def _save(self):
        """Persist index to disk."""
        if not self._persist_dir:
            return
        import faiss
        os.makedirs(self._persist_dir, exist_ok=True)
        faiss.write_index(self._index, os.path.join(self._persist_dir, "index.faiss"))
        np.save(os.path.join(self._persist_dir, "ids.npy"), np.array(self._ids, dtype=object))


class ChromaStore(VectorStore):
    """ChromaDB-based vector store — persistent, supports metadata filtering.

    Collections auto-created on first use.
    """

    def __init__(self, embedding_service, collection_name: str, persist_dir: str = "./data/chroma"):
        self._embedder = embedding_service
        self._collection_name = collection_name
        self._persist_dir = persist_dir
        self._client = None
        self._collection = None

    def _get_collection(self):
        """Lazy-initialize ChromaDB client and collection."""
        if self._collection is not None:
            return self._collection

        import chromadb

        self._client = chromadb.PersistentClient(path=self._persist_dir)
        self._collection = self._client.get_or_create_collection(
            name=self._collection_name,
            metadata={"hnsw:space": "cosine"},
        )
        return self._collection

    def index(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Index documents into ChromaDB collection."""
        if not texts:
            return 0

        collection = self._get_collection()
        metadatas = metadatas or [{} for _ in texts]

        # ChromaDB requires string values in metadata
        clean_metadatas = [self._clean_metadata(m) for m in metadatas]

        embeddings = self._embedder.encode(texts)

        # ChromaDB has batch limits, process in chunks
        batch_size = 500
        total = 0
        for i in range(0, len(ids), batch_size):
            batch_ids = ids[i:i + batch_size]
            batch_texts = texts[i:i + batch_size]
            batch_embeds = embeddings[i:i + batch_size]
            batch_metas = clean_metadatas[i:i + batch_size]

            collection.upsert(
                ids=batch_ids,
                documents=batch_texts,
                embeddings=batch_embeds,
                metadatas=batch_metas,
            )
            total += len(batch_ids)

        logger.info("ChromaDB indexed %d documents in '%s'", total, self._collection_name)
        return total

    def upsert(self, ids: list[str], texts: list[str], metadatas: list[dict] | None = None) -> int:
        """Upsert documents (same as index for ChromaDB)."""
        return self.index(ids, texts, metadatas)

    def search(self, query: str, top_k: int = 5, filters: dict | None = None) -> list[SearchResult]:
        """Search ChromaDB with optional metadata filtering."""
        collection = self._get_collection()

        query_embedding = self._embedder.encode_single(query).tolist()

        kwargs = {
            "query_embeddings": [query_embedding],
            "n_results": top_k,
        }

        if filters:
            where_clause = {k: str(v) for k, v in filters.items()}
            kwargs["where"] = where_clause

        try:
            results = collection.query(**kwargs)
        except Exception as e:
            logger.warning("ChromaDB search error: %s", e)
            return []

        search_results = []
        if results and results["ids"] and results["ids"][0]:
            for i, doc_id in enumerate(results["ids"][0]):
                score = 1.0 - (results["distances"][0][i] if results.get("distances") else 0)
                document = results["documents"][0][i] if results.get("documents") else ""
                metadata = results["metadatas"][0][i] if results.get("metadatas") else {}
                search_results.append(SearchResult(
                    id=doc_id,
                    score=score,
                    document=document,
                    metadata=metadata,
                ))

        return search_results

    def delete(self, ids: list[str]) -> int:
        """Delete documents by ID from ChromaDB."""
        collection = self._get_collection()
        try:
            collection.delete(ids=ids)
            return len(ids)
        except Exception as e:
            logger.warning("ChromaDB delete error: %s", e)
            return 0

    def count(self) -> int:
        """Total documents in collection."""
        collection = self._get_collection()
        return collection.count()

    def _clean_metadata(self, metadata: dict) -> dict:
        """Ensure all metadata values are strings (ChromaDB requirement)."""
        return {k: str(v) for k, v in metadata.items() if v is not None}
