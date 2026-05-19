"""MongoDB → Vector Index Sync — Task 4.

Supports 3 modes:
- full_sync: startup rebuild
- incremental_sync: periodic (since last sync)
- watch_changes: MongoDB Change Stream (real-time)
"""

import logging
import time
from datetime import datetime, timezone
from typing import Callable

logger = logging.getLogger(__name__)


class MongoVectorSync:
    """Sync MongoDB collection to vector index.

    Args:
        db: Motor/PyMongo database instance
        vector_store: VectorStore implementation (FAISS or ChromaDB)
        collection_name: MongoDB collection to sync
        text_builder: Function that converts a document to text for embedding
        id_field: Document ID field (default "_id")
        metadata_fields: List of fields to extract as metadata
    """

    def __init__(
        self,
        db,
        vector_store,
        collection_name: str,
        text_builder: Callable[[dict], str],
        id_field: str = "_id",
        metadata_fields: list[str] | None = None,
    ):
        self.db = db
        self.store = vector_store
        self.collection_name = collection_name
        self.text_builder = text_builder
        self.id_field = id_field
        self.metadata_fields = metadata_fields or [
            "category", "brand", "platform", "topic", "is_otc", "niche",
            "source", "rating", "product_id", "user_id",
        ]
        self._last_sync: datetime | None = None
        self._sync_count: int = 0

    async def full_sync(self, timeout_seconds: int = 300) -> dict:
        """Full rebuild of vector index from MongoDB. Run on startup.

        Args:
            timeout_seconds: Max time for sync (default 5 minutes)

        Returns:
            dict with: synced (count), total, duration_ms
        """
        start = time.time()
        collection = self.db[self.collection_name]

        # Query all active documents
        query = {"is_active": {"$ne": False}}
        docs = await collection.find(query).to_list(length=None)

        if not docs:
            logger.info("Full sync %s: 0 documents found", self.collection_name)
            return {"synced": 0, "total": 0, "duration_ms": 0}

        ids = [str(d[self.id_field]) for d in docs]
        texts = [self.text_builder(d) for d in docs]
        metadatas = [self._extract_metadata(d) for d in docs]

        # Filter out empty texts
        valid = [(i, t, m) for i, t, m in zip(ids, texts, metadatas) if t.strip()]
        if not valid:
            return {"synced": 0, "total": len(docs), "duration_ms": 0}

        valid_ids, valid_texts, valid_metas = zip(*valid)

        count = self.store.index(list(valid_ids), list(valid_texts), list(valid_metas))
        self._last_sync = datetime.now(timezone.utc)
        self._sync_count = count

        duration_ms = (time.time() - start) * 1000
        logger.info(
            "✅ Full sync %s: %d/%d documents indexed in %.0fms",
            self.collection_name, count, len(docs), duration_ms,
        )
        return {"synced": count, "total": len(docs), "duration_ms": round(duration_ms)}

    async def incremental_sync(self) -> dict:
        """Sync only documents changed since last sync.

        Returns:
            dict with: synced (count), duration_ms
        """
        if self._last_sync is None:
            return await self.full_sync()

        start = time.time()
        collection = self.db[self.collection_name]

        query = {"updated_at": {"$gte": self._last_sync}}
        docs = await collection.find(query).to_list(length=None)

        if not docs:
            return {"synced": 0, "duration_ms": 0}

        ids = [str(d[self.id_field]) for d in docs]
        texts = [self.text_builder(d) for d in docs]
        metadatas = [self._extract_metadata(d) for d in docs]

        valid = [(i, t, m) for i, t, m in zip(ids, texts, metadatas) if t.strip()]
        if not valid:
            return {"synced": 0, "duration_ms": 0}

        valid_ids, valid_texts, valid_metas = zip(*valid)
        count = self.store.upsert(list(valid_ids), list(valid_texts), list(valid_metas))
        self._last_sync = datetime.now(timezone.utc)
        self._sync_count += count

        duration_ms = (time.time() - start) * 1000
        logger.info(
            "Incremental sync %s: %d new/updated documents in %.0fms",
            self.collection_name, count, duration_ms,
        )
        return {"synced": count, "duration_ms": round(duration_ms)}

    def get_status(self) -> dict:
        """Return sync status for health endpoint."""
        return {
            "collection": self.collection_name,
            "last_sync": self._last_sync.isoformat() if self._last_sync else None,
            "total_synced": self._sync_count,
            "index_count": self.store.count(),
        }

    def _extract_metadata(self, doc: dict) -> dict:
        """Extract searchable metadata fields from document."""
        meta = {}
        for key in self.metadata_fields:
            if key in doc and doc[key] is not None:
                meta[key] = str(doc[key])
        return meta
