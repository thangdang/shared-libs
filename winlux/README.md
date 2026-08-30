# WinLux — Unified Python Library

Unified shared library for all WinLux AI products.  Consolidates: `shared-vn-nlp`, `shared-llm-client`, `shared-crawler`, `rag`.

## Installation

```bash
# Full installation (all features)
pip install -e ".[all]"

# Minimal installation (core only)
pip install -e .

# Specific features
pip install -e ".[nlp]"      # Vietnamese NLP
pip install -e ".[llm]"      # LLM client
pip install -e ".[crawler]"  # Web crawler
pip install -e ".[rag]"      # RAG components
```

## Usage

### Single Import (All Features)

```python
from winlux import (
    # NLP
    segment, normalize_slang, analyze_sentiment, format_vnd,
    # LLM
    LLMClient, LiteAgent, ModelRouter,
    # Crawler
    CrawlEngine, ProxyPool, CrawlScheduler,
    # RAG
    VectorStore, EmbeddingService, RAGPromptBuilder,
)
```

### Module Imports (Tree-Shaking)

```python
# NLP
from winlux.nlp import segment, ner, normalize_slang, format_vnd

# LLM
from winlux.llm import LLMClient, LiteAgent, ModelRouter

# Crawler
from winlux.crawler import CrawlEngine, ProxyPool, CrawlScheduler

# RAG
from winlux.rag import VectorStore, EmbeddingService
```

## Modules

### NLP (`winlux.nlp`)

Vietnamese NLP utilities:
- `segment`, `ner`, `pos_tag` — Word segmentation, NER, POS tagging
- `normalize_slang` — Slang normalization
- `detect_provinces` — Province/region detection
- `get_events`, `lunar_to_solar` — Vietnamese calendar
- `analyze_sentiment` — Sentiment analysis
- `normalize_phone`, `validate_phone` — Phone number utilities
- `format_vnd`, `parse_vnd` — VND currency formatting
- `parse_address` — Address parsing

### LLM (`winlux.llm`)

Unified LLM client with routing, caching, and agents:
- `LLMClient` — Unified client with retry, cache, circuit breaker
- `LiteAgent` — Single-call structured output agent
- `HybridEngine` — Rule + AI decision engine
- `ModelRouter` — Routes tasks to optimal model by complexity
- `PromptSanitizer`, `PromptGuard` — Security features
- `AgentMemory`, `FewShotManager` — Learning capabilities
- `PromptABTracker` — A/B testing

### Crawler (`winlux.crawler`)

Config-driven crawl engine:
- `CrawlEngine` — Orchestrator with retry, circuit breaker
- `ProxyPool` — Rotating proxy pool manager
- `CrawlScheduler` — Priority-based crawl scheduler
- `TranslationPipeline` — EN→VI translation with caching
- `PlaywrightPool` — Browser instance pool for JS-rendered pages
- `CrossSourceDedup` — Product deduplication

### RAG (`winlux.rag`)

Retrieval-Augmented Generation:
- `EmbeddingService` — Vietnamese-optimized text embeddings
- `VectorStore`, `FAISSStore`, `ChromaStore` — Vector stores
- `MongoVectorSync` — MongoDB → Vector index sync
- `RAGPromptBuilder` — Template-based grounded prompts
- `ResponseValidator` — Hallucination detection

## Migration from Separate Packages

| Old Import | New Import |
|------------|------------|
| `from shared_vn_nlp import segment` | `from winlux.nlp import segment` |
| `from shared_llm_client import LLMClient` | `from winlux.llm import LLMClient` |
| `from shared_crawler import CrawlEngine` | `from winlux.crawler import CrawlEngine` |
| `from rag import VectorStore` | `from winlux.rag import VectorStore` |

## License

MIT
