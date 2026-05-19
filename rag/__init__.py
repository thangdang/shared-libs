"""Shared RAG (Retrieval-Augmented Generation) components.

Provides reusable infrastructure for all AI engines:
- EmbeddingService: Vietnamese-optimized text embeddings
- VectorStore: Abstract interface + FAISS/ChromaDB implementations
- MongoVectorSync: MongoDB → Vector index synchronization
- RAGPromptBuilder: Template-based grounded prompt construction
- ResponseValidator: Hallucination detection and response validation
"""

from .embedding_service import EmbeddingService
from .vector_store import VectorStore, SearchResult, FAISSStore, ChromaStore
from .mongo_vector_sync import MongoVectorSync
from .prompt_builder import RAGPromptBuilder
from .response_validator import ResponseValidator
