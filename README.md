# 📦 Shared Libraries

> Reusable libraries shared across the WinLux AI portfolio.
> **Architecture:  Unified packages** — apps import from `@winlux/core` (TypeScript) or `winlux` (Python).

## 🚀 Packages

| Package | Language | Description |
|---------|----------|-------------|
| `@winlux/core` | TypeScript | Auth, payment, notification, analytics, zalo, clients, resilience |
| `winlux` | Python | LLM, NLP, crawler, RAG, product linker |
| `winlux_core` | Dart/Flutter | Mobile utilities — auth, API, payment, notifications |

### Quick Start

```powershell
cd C:\Users\evtxd01\learn_python\shared-libs

# Build unified packages
.\build-unified.ps1    # PowerShell
.\build-unified.bat    # CMD/Batch
```

---

## Usage

### TypeScript

**package.json:**
```json
{
  "dependencies": {
    "@winlux/core": "file:../../shared-libs/core"
  }
}
```

**Import:**
```typescript
// Main modules
import { TokenService, requireAuth } from '@winlux/core/auth';
import { SepayProvider } from '@winlux/core/payment';
import { NotificationClient } from '@winlux/core/notification';
import { Analytics } from '@winlux/core/analytics';
import { ZaloSSO, ZaloOA } from '@winlux/core/zalo';

// HTTP clients
import { AuthClient, PaymentClient } from '@winlux/core/clients';

// Offline resilience
import { OfflineResilience, EmergencyDetector } from '@winlux/core/resilience';
```

### Python

**requirements.txt:**
```
-e ../../shared-libs/winlux[all]
```

**Import:**
```python
# LLM
from winlux.llm import LLMClient, LiteAgent, ModelStrategy

# Vietnamese NLP
from winlux.nlp import segment, normalize_slang, format_vnd

# Crawler
from winlux.crawler import CrawlEngine, ProxyPool, TranslationPipeline

# RAG
from winlux.rag import VectorStore, EmbeddingService

# Product Linker
from winlux.linker import MentionDetector, detect_products
```

### Flutter

**pubspec.yaml:**
```yaml
dependencies:
  winlux_core:
    path: ../../shared-libs/flutter
```

---

## Package Structure

### `@winlux/core` (TypeScript)

```
core/src/
├── auth/          # Google SSO, Zalo SSO, OTP, JWT, middleware
├── payment/       # SePay, MoMo, ZaloPay, payOS, Stripe
├── notification/  # FCM, Zalo OA, Email, SMS, Telegram
├── analytics/     # Event tracking, revenue, health checks
├── zalo/          # Zalo SSO, OA messaging, share cards
├── clients/       # Cross-product HTTP clients
└── resilience/    # Offline resilience patterns
```

### `winlux` (Python)

```
winlux/src/winlux/
├── llm/           # LLM client — retry, cache, circuit breaker, agents
├── nlp/           # Vietnamese NLP — tokenization, sentiment, formatting
├── crawler/       # Crawl engine — proxy pool, scheduler, dedup, translate
├── rag/           # RAG — embeddings, vector store, retrieval
└── linker/        # Product/topic detection, affiliate linking
```

---

## App Integration

### TypeScript Services

| App | Status |
|-----|--------|
| smartbuy-service | ✅ |
| trendbriefai-service | ✅ |
| caremate-service | ✅ |
| doctor-car-service | ✅ |
| fin-tax-service | ✅ |
| backoffice-service | ✅ |
| childhood-service | ✅ |

### Python AI Engines

| App | llm | nlp | crawler | rag | linker |
|-----|-----|-----|---------|-----|--------|
| smartbuy-ai-engine | ✅ | ✅ | ✅ | ✅ | ✅ |
| trendbriefai-engine | ✅ | ✅ | ✅ | ✅ | — |
| caremate-ai-engine | ✅ | ✅ | — | ✅ | ✅ |
| doctor-car-ai-engine | ✅ | ✅ | ✅ | — | — |
| fin-tax-ai-engine | ✅ | ✅ | — | ✅ | ✅ |
| childhood-video-engine | ✅ | ✅ | — | — | — |

### Flutter Mobile Apps

| App | Status |
|-----|--------|
| smartbuy-mobile | ✅ |
| trendbriefai-mobile | ✅ |
| caremate-mobile | ✅ |
| doctor-car-mobile | ✅ |
| fintax-mobile | ✅ |

---

## Building

### TypeScript

```bash
cd shared-libs/core
npm install
npm run build
```

### Python

```bash
pip install -e ../../shared-libs/winlux[all]
```

---

## Related Resources

Deployment scripts and performance configs have been moved to:
`C:\Users\evtxd01\learn_python\document-idea\go-live\`

- `deploy/` — VPS setup, health checks, Telegram notifications
- `performance/` — MongoDB indexes, Redis config, scaling runbook
