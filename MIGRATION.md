# Migration Guide: Shared Libraries

## Overview

This guide documents how to migrate each AI engine from per-repo implementations to shared libraries. Migration is incremental and reversible at any point.

## Installation

Install shared libraries in each AI engine's virtual environment:

```bash
# From the AI engine's directory
pip install -e ../../shared-libs/shared-vn-nlp
pip install -e ../../shared-libs/shared-crawler
pip install -e ../../shared-libs/shared-llm-client
```

## Import Replacement Patterns

### shared-vn-nlp

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.vn_nlp import segment` | `from shared_vn_nlp import segment` |
| `from services.vn_nlp import ner, pos_tag` | `from shared_vn_nlp import ner, pos_tag` |
| `from services.slang import normalize_slang` | `from shared_vn_nlp import normalize_slang` |
| `from services.provinces import detect_provinces` | `from shared_vn_nlp import detect_provinces` |
| `from services.vn_calendar import get_events` | `from shared_vn_nlp import get_events, get_events_in_range, lunar_to_solar` |
| `from services.sentiment import analyze_sentiment` | `from shared_vn_nlp import analyze_sentiment` |

### shared-crawler

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.crawler import CrawlEngine` | `from shared_crawler import CrawlEngine` |
| `from services.crawler import crawl_source` | `from shared_crawler import CrawlEngine; engine.crawl_source(...)` |

### shared-llm-client

| Per-repo import | Shared lib import |
|----------------|-------------------|
| `from services.llm_service import generate` | `from shared_llm_client import LLMClient` |
| `from services.ollama_client import OllamaClient` | `from shared_llm_client import LLMClient` |

**Note:** `shared-llm-client` connects to Ollama on `localhost:11434` by default — no config changes needed.

## Migration Order

1. **fin-tax-ai** — Simplest usage (NLP + LLM only)
2. **caremate-ai** — NLP + LLM
3. **smartbuy-ai** — NLP + LLM
4. **trend-brief-ai** — NLP + Crawler + LLM
5. **ai-video-engine** — NLP + Crawler + LLM (most complex)

## Per-Engine Migration Steps

### 1. fin-tax-ai

```bash
cd fin-tax-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

Replace imports in `fin-tax-ai/fintaxai-engine/services/`:
- `nlp_service.py` → use `from shared_vn_nlp import segment, normalize_slang`
- `llm_service.py` → use `from shared_llm_client import LLMClient`

### 2. caremate-ai

```bash
cd caremate-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

### 3. smartbuy-ai

```bash
cd smartbuy-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-llm-client
```

### 4. trend-brief-ai

```bash
cd trend-brief-ai
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-crawler
pip install -e ../shared-libs/shared-llm-client
```

### 5. ai-video-engine

```bash
cd ai-video-engine
pip install -e ../shared-libs/shared-vn-nlp
pip install -e ../shared-libs/shared-crawler
pip install -e ../shared-libs/shared-llm-client
```

## Backward Compatibility

- Existing per-repo code continues working alongside shared libs
- Both old and new imports can coexist during migration
- No Ollama configuration changes required (same port 11434)
- No MongoDB schema changes required

## LLM Model per Product

| Product | Default Model | Purpose |
|---------|--------------|---------|
| ai-video-engine | qwen2.5:7b | Vietnamese script generation, good multilingual |
| caremate-ai | phogpt:4b-chat | Vietnamese medical explanations |
| fin-tax-ai | mistral:7b | Financial/tax reasoning |
| smartbuy-ai | vistral | Vietnamese product descriptions |
| trend-brief-ai | (via shared-llm-client) | Article summarization |

When using `shared-llm-client`, configure `OLLAMA_MODEL` per product in `.env`.

## Rollback

To rollback any engine, simply revert the import statements:

```python
# Revert from:
from shared_vn_nlp import segment
# Back to:
from services.vn_nlp import segment
```

No data migration or infrastructure changes needed.
