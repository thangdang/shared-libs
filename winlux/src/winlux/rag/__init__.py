"""Shared RAG (Retrieval-Augmented Generation) components.

Provides reusable infrastructure for all AI engines:
- EmbeddingService: Vietnamese-optimized text embeddings
- EmbeddingCache: Redis-based embedding cache for performance
- CachedEmbeddingService: Drop-in replacement with automatic caching
- VectorStore: Abstract interface + FAISS/ChromaDB implementations
- MongoVectorSync: MongoDB → Vector index synchronization
- RAGPromptBuilder: Template-based grounded prompt construction
- ResponseValidator: Hallucination detection and response validation
"""

from .embedding_cache import CachedEmbeddingService, EmbeddingCache
from .embedding_service import EmbeddingService
from .mongo_vector_sync import MongoVectorSync
from .prompt_builder import RAGPromptBuilder
from .response_validator import ResponseValidator
from .vector_store import ChromaStore, FAISSStore, SearchResult, VectorStore

__all__ = [
    "EmbeddingService",
    "EmbeddingCache",
    "CachedEmbeddingService",
    "VectorStore",
    "SearchResult",
    "FAISSStore",
    "ChromaStore",
    "MongoVectorSync",
    "RAGPromptBuilder",
    "ResponseValidator",
]