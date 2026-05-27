# 📦 Shared Libraries

> Reusable libraries and microservices shared across the WinLux AI portfolio.

## Libraries

| Library | Stack | Description |
|---------|-------|-------------|
| `auth-service/` | Node.js + Express + TypeScript | SSO, OTP, JWT authentication microservice |
| `payment-service/` | Node.js + Express + TypeScript | MoMo, ZaloPay, payOS, Stripe payment gateway |
| `offline-resilience/` | Node.js + TypeScript | Offline resilience pattern for VPS services |
| `rag/` | Python | Shared RAG infrastructure (embeddings, vector store, sync) |
| `shared-crawler/` | Python | Config-driven crawl engine with proxy pool and dedup |
| `shared-llm-client/` | Python | Unified LLM client with retry, caching, circuit breaker |
| `shared-vn-nlp/` | Python | Vietnamese NLP (tokenization, sentiment, lunar calendar) |
| `product-linker/` | Python + FastAPI | Product/topic detection and affiliate linking |
| `service-clients/` | TypeScript | Cross-product HTTP client helpers |
| `performance/` | Mixed | MongoDB indexes, Redis config, Nginx caching, monitoring |
| `deploy/` | Shell scripts | VPS deployment automation (setup, SSL, firewall, backup) |

## Installation

### Python libraries (editable install)
```bash
pip install -e shared-vn-nlp/
pip install -e shared-llm-client/
pip install -e shared-crawler/
pip install -e product-linker/
```

### Node.js services
```bash
cd auth-service && npm install
cd payment-service && npm install
```

## Architecture

All shared libraries are designed to be installed as local packages by the product repos. Python libs use `pyproject.toml` with setuptools, Node.js services run as standalone microservices.
