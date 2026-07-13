# 📦 Shared Libraries

> Reusable libraries and microservices shared across the WinLux AI portfolio.

## Libraries

| Library | Stack | Description |
|---------|-------|-------------|
| `auth-service/` | Node.js + Express + TypeScript | SSO (Google, Zalo), OTP, JWT authentication microservice |
| `payment-service/` | Node.js + Express + TypeScript | MoMo, ZaloPay, payOS, Stripe, SePay payment gateway + refund flow |
| `notification-service/` | Node.js + Express + TypeScript | Multi-channel notifications (FCM, Zalo OA, email, SMS) with scheduling + fallback |
| `offline-resilience/` | Node.js + TypeScript | Offline resilience pattern for VPS services |
| `rag/` | Python | Shared RAG infrastructure (embeddings, vector store, sync) |
| `shared-crawler/` | Python | Config-driven crawl engine with proxy pool and dedup |
| `shared-llm-client/` | Python | Unified LLM client with retry, caching, circuit breaker |
| `shared-vn-nlp/` | Python | Vietnamese NLP (tokenization, sentiment, lunar calendar, phone normalization, currency formatting, address parsing) |
| `product-linker/` | Python + FastAPI | Product/topic detection and affiliate linking |
| `service-clients/` | TypeScript | Cross-product HTTP client helpers, error handler middleware, analytics client |
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

All shared libraries are designed to be installed as local packages by the product repos.  Python libs use `pyproject.toml` with setuptools, Node.js services run as standalone microservices.

## New in July 2026

VN market improvements across the shared library portfolio:

- **shared-vn-nlp** — Added phone number normalization (E.164, carrier detection), Vietnamese currency formatting (VND, compact K/triệu/tỷ), and address parsing (street/ward/district/province with confidence scoring)
- **auth-service** — Zalo SSO integration (OAuth web/app + Mini App login) with automatic account merge by phone number
- **notification-service** — Email (Resend) and SMS (eSMS.vn) channels, configurable fallback chains, BullMQ-based scheduling with quiet hours enforcement
- **payment-service** — Full and partial refund flow across all providers (SePay, MoMo, Stripe, ZaloPay, payOS), reconciliation job for stuck payments, admin stats endpoint
- **service-clients** — Notification client, analytics client, shared error handler middleware (`ApiResponse<T>` format with Vietnamese messages), DoctorCar cross-product links
