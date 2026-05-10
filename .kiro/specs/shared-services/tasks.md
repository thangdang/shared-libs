# Implementation Plan: Shared Services

## Overview

Build the shared infrastructure layer (Release 2) that eliminates code duplication across 5 AI repositories. Implementation follows a bottom-up approach: libraries first, then the HTTP service, then the offline resilience pattern, and finally migration of existing engines to use shared libs.

**Languages:** Python (libraries + product-linker), TypeScript (offline resilience pattern)
**Deployment:** No Docker — `pip install -e` for libs, bat scripts for services, manual deployment

## Tasks

- [ ] 1. shared-vn-nlp library
  - [x] 1.1 Create package structure and pyproject.toml
    - Create `shared-vn-nlp/` directory with `pyproject.toml` for editable install
    - Create `shared_vn_nlp/__init__.py` exporting public API: `segment`, `ner`, `pos_tag`, `normalize_slang`, `detect_provinces`, `get_events`, `get_events_in_range`, `lunar_to_solar`, `analyze_sentiment`
    - Add dependencies: `underthesea`, `lunardate` (or equivalent)
    - Verify `pip install -e ./shared-libs/shared-vn-nlp` works
    - _Requirements: 24.1, 24.4_

  - [x] 1.2 Implement nlp.py (word segmentation, NER, POS tagging)
    - Implement `segment(text: str) -> List[str]` using underthesea `word_tokenize`
    - Implement `ner(text: str) -> List[Tuple[str, str, str, str]]` using underthesea NER
    - Implement `pos_tag(text: str) -> List[Tuple[str, str]]` using underthesea POS
    - Return empty list for empty/whitespace input without raising exceptions
    - _Requirements: 1.1, 1.2, 1.3, 1.4_

  - [x] 1.3 Create slang data file and implement slang.py
    - Create `shared_vn_nlp/data/vn_slang.json` with 100+ Vietnamese abbreviation-to-expansion pairs
    - Implement `load_slang_dict() -> Dict[str, str]` loading from JSON
    - Implement `normalize_slang(text: str) -> str` with case-insensitive matching, preserving non-slang casing
    - Ensure idempotence: `normalize_slang(normalize_slang(x)) == normalize_slang(x)`
    - Return original text unchanged when no slang is found
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 1.4 Create provinces data file and implement provinces.py
    - Create `shared_vn_nlp/data/vn_provinces.json` with all 63 provinces, alternate names, and regions
    - Implement `ProvinceMatch` dataclass with `name`, `region`, `matched_text`, `start`, `end`
    - Implement `detect_provinces(text: str) -> List[ProvinceMatch]` using regex matching
    - Support official names and alternates (e.g., "Sài Gòn" → "Hồ Chí Minh")
    - Implement `get_all_provinces() -> List[dict]`
    - Return empty list when no provinces found
    - _Requirements: 3.1, 3.2, 3.3, 3.4_

  - [x] 1.5 Create events data file and implement calendar.py
    - Create `shared_vn_nlp/data/vn_events.json` with 30+ events (Tết, lunar dates, seasonal)
    - Implement `VNEvent` dataclass with `name`, `date_solar`, `date_lunar`, `event_type`, `description`
    - Implement `get_events(target_date, days_range=3) -> List[VNEvent]`
    - Implement `get_events_in_range(start, end) -> List[VNEvent]`
    - Implement `lunar_to_solar(lunar_month, lunar_day, year) -> date`
    - _Requirements: 4.1, 4.2, 4.3, 4.4_

  - [x] 1.6 Implement sentiment.py
    - Implement `SentimentResult` dataclass with `label` (positive/negative/neutral) and `score` (0.0-1.0)
    - Implement `analyze_sentiment(text: str) -> SentimentResult`
    - Apply slang normalization before analysis
    - Return neutral/0.0 for empty input
    - _Requirements: 5.1, 5.2, 5.3_

  - [x] 1.7 Write unit tests for shared-vn-nlp
    - Create `tests/test_nlp.py` — test segment, ner, pos_tag with known inputs and empty strings
    - Create `tests/test_slang.py` — test specific expansions, case handling, empty input
    - Create `tests/test_provinces.py` — test known provinces, alternates, no-match case
    - Create `tests/test_calendar.py` — test events lookup, date range, lunar conversion
    - _Requirements: 1.1-1.4, 2.1-2.5, 3.1-3.4, 4.1-4.4, 5.1-5.3_

- [x] 2. Checkpoint — shared-vn-nlp complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `pip install -e ./shared-libs/shared-vn-nlp` and `from shared_vn_nlp import segment, normalize_slang` works
  - Confirm RAM overhead is negligible (in-process library)
  - _Requirements: 24.1, 24.4, 26.2_

- [ ] 3. shared-crawler library
  - [x] 3.1 Create package structure and pyproject.toml
    - Create `shared-crawler/` directory with `pyproject.toml` for editable install
    - Create `shared_crawler/__init__.py` exporting `CrawlEngine`, `CrawlResult`
    - Add dependencies: `httpx`, `feedparser`, `beautifulsoup4`, `redis`, `motor` (async MongoDB), `playwright`
    - Verify `pip install -e ./shared-libs/shared-crawler` works
    - _Requirements: 24.2, 24.4_

  - [x] 3.2 Implement extractors (base, rss, html, api, playwright)
    - Create `extractors/base.py` with `BaseExtractor` ABC defining `async extract(url, config) -> List[dict]`
    - Create `extractors/rss.py` using feedparser
    - Create `extractors/html.py` using httpx + BeautifulSoup with CSS selectors
    - Create `extractors/api.py` for JSON API endpoints
    - Create `extractors/playwright_ext.py` for JS-rendered pages
    - _Requirements: 6.2_

  - [x] 3.3 Implement rate_limiter.py (Redis-backed per-domain)
    - Implement `RedisRateLimiter` class with Redis-backed counters
    - Implement `acquire(domain, rpm_limit) -> bool` for non-blocking check
    - Implement `wait_and_acquire(domain, rpm_limit)` for blocking wait
    - Enforce shared rate limit across all consumers via Redis
    - Fall back to in-memory rate limiting if Redis unavailable
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 3.4 Implement retry.py (exponential backoff)
    - Implement `with_retry(fn, max_retries=3, base_delay=1.0, transient_errors=(...))` async function
    - Delays follow `base_delay * 2^attempt` pattern (1s, 2s, 4s)
    - Handle transient errors: TimeoutError, ConnectionError, HTTP 5xx
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 3.5 Implement health.py (crawl health tracking)
    - Track success/failure per source in MongoDB
    - Mark source as "degraded" after 3+ consecutive failures
    - Expose `get_health_summary()` returning per-source success rate, last success timestamp, consecutive failure count
    - _Requirements: 9.1, 9.2, 9.3_

  - [x] 3.6 Implement dedup.py (URL deduplication)
    - Implement `URLDeduplicator` class with Redis backend
    - Implement `normalize_url(url)` — sort query params, remove trailing slash, lowercase scheme+host
    - Implement `hash_url(url)` — SHA-256 of normalized URL
    - Implement `is_duplicate(url) -> bool` and `mark_processed(url)`
    - _Requirements: 10.1, 10.2, 10.3, 10.4_

  - [x] 3.7 Implement anti_bot.py (User-Agent rotation + timing)
    - Maintain pool of 10+ realistic browser User-Agent strings
    - Rotate User-Agent on each request
    - Randomize request timing within rate limit window
    - On HTTP 403/429: switch User-Agent + extended backoff (30s)
    - _Requirements: 11.1, 11.2, 11.3_

  - [x] 3.8 Implement engine.py (config-driven crawl orchestrator)
    - Implement `CrawlEngine` class with `__init__(mongo_uri, redis_url)`
    - Implement `crawl_source(source_id) -> List[CrawlResult]` — load config from MongoDB, dispatch to correct extractor
    - Implement `crawl_all(consumer) -> AsyncIterator[CrawlResult]` — crawl all sources for a consumer
    - Integrate rate limiter, retry, dedup, health tracking, and anti-bot
    - Filter results by `consumers` field in config
    - _Requirements: 6.1, 6.3, 6.4_

  - [x] 3.9 Write unit tests for shared-crawler
    - Create `tests/test_engine.py` — test config loading, extractor dispatch
    - Create `tests/test_dedup.py` — test URL normalization, hash, duplicate detection
    - Create `tests/test_rate_limiter.py` — test acquire/wait logic
    - _Requirements: 6.1-6.4, 7.1-7.3, 8.1-8.3, 10.1-10.4_

- [x] 4. Checkpoint — shared-crawler complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `pip install -e ./shared-libs/shared-crawler` and `from shared_crawler import CrawlEngine` works
  - _Requirements: 24.2, 24.4, 26.2_

- [ ] 5. shared-llm-client library
  - [x] 5.1 Create package structure and pyproject.toml
    - Create `shared-llm-client/` directory with `pyproject.toml` for editable install
    - Create `shared_llm_client/__init__.py` exporting `LLMClient`, `LLMResponse`, `CircuitBreaker`, `CircuitState`
    - Add dependencies: `httpx`, `redis`, `groq` (optional)
    - Verify `pip install -e ./shared-libs/shared-llm-client` works
    - _Requirements: 24.3, 24.4_

  - [x] 5.2 Implement circuit_breaker.py
    - Implement `CircuitState` enum: CLOSED, OPEN, HALF_OPEN
    - Implement `CircuitBreaker` class with `failure_threshold=5`, `reset_timeout=30`
    - Implement `can_execute() -> bool`, `record_success()`, `record_failure()`, `get_state()`
    - State transitions: CLOSED→OPEN after 5 failures, OPEN→HALF_OPEN after 30s, HALF_OPEN→CLOSED on success, HALF_OPEN→OPEN on failure
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

  - [x] 5.3 Implement cache.py (Redis-backed LLM response cache)
    - Implement `LLMCache` class with `__init__(redis_url, default_ttl=86400)`
    - Implement `compute_key(model, prompt, params) -> str` using SHA-256 hash
    - Implement `get(model, prompt, params) -> Optional[str]` and `set(model, prompt, params, response, ttl)`
    - Skip caching gracefully if Redis unavailable
    - _Requirements: 13.1, 13.2, 13.3, 13.4_

  - [x] 5.4 Implement providers (ollama, groq, template)
    - Create `providers/base.py` with `BaseProvider` ABC
    - Create `providers/ollama.py` — HTTP calls to localhost:11434 with configurable timeout
    - Create `providers/groq.py` — Groq free tier API client
    - Create `providers/template.py` — template-based fallback returning `degraded=True`
    - _Requirements: 12.2, 15.1, 15.3_

  - [x] 5.5 Implement fallback.py (fallback chain logic)
    - Implement ordered fallback chain: Ollama → Groq → template
    - Attempt next provider when current fails and circuit breaker is open
    - Log which provider served each response
    - Return template response with `degraded=True` when all fail
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

  - [x] 5.6 Implement streaming.py (SSE token streaming)
    - Implement `stream_ollama(url, model, prompt, options) -> AsyncIterator[str]`
    - Yield tokens as SSE events as generated
    - Emit final event with complete response + usage metadata
    - Emit error event and close gracefully on mid-stream failure
    - Implement `format_sse_event(data, event_type)` helper
    - _Requirements: 17.1, 17.2, 17.3, 17.4_

  - [x] 5.7 Implement client.py (unified LLM client)
    - Implement `LLMClient` class integrating cache, circuit breaker, fallback, and streaming
    - Implement `generate(prompt, model, temperature, max_tokens, timeout, json_schema, stream, skip_cache) -> LLMResponse | AsyncIterator`
    - Implement `generate_json(prompt, schema, model, max_retries=2) -> dict` with retry on parse failure
    - Implement `get_status() -> dict` returning circuit state, cache stats, provider availability
    - Retry up to 3 times with exponential backoff on transient errors
    - Default timeout: 30s standard, 120s long-generation
    - _Requirements: 12.1, 12.2, 12.3, 16.1, 16.2, 16.3, 16.4_

  - [x] 5.8 Write unit tests for shared-llm-client
    - Create `tests/test_circuit_breaker.py` — test state transitions, threshold, reset
    - Create `tests/test_cache.py` — test key computation, get/set, TTL
    - Create `tests/test_client.py` — test generate, generate_json, fallback behavior (mocked providers)
    - _Requirements: 12.1-12.3, 13.1-13.4, 14.1-14.5, 15.1-15.4, 16.1-16.4_

- [x] 6. Checkpoint — shared-llm-client complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify `pip install -e ./shared-libs/shared-llm-client` and `from shared_llm_client import LLMClient` works
  - Verify connects to existing Ollama on port 11434 without config changes
  - _Requirements: 24.3, 24.4, 26.2, 27.3_

- [ ] 7. product-linker service
  - [x] 7.1 Create package structure and pyproject.toml
    - Create `product-linker/` directory with `pyproject.toml`
    - Create `product_linker/__init__.py`
    - Add dependencies: `fastapi`, `uvicorn`, `motor`, `pydantic`
    - _Requirements: 25.2_

  - [x] 7.2 Implement models.py (Pydantic models)
    - Define `LinkRequest` model with `text: str` and `source_engine: str | None`
    - Define `DetectedMention` model with `text`, `type`, `affiliate_url`, `platform`, `confidence`
    - Define `LinkResponse` model with `mentions: List[DetectedMention]` and `processing_time_ms`
    - Define `CatalogEntry` model matching MongoDB schema
    - _Requirements: 18.4, 19.1_

  - [x] 7.3 Implement detector.py (mention detection logic)
    - Implement `MentionDetector` class with MongoDB catalog loading
    - Auto-refresh catalog every 5 minutes (no restart needed)
    - Implement `detect(text) -> List[DetectedMention]` matching product_name, brand, topic_keywords
    - Support categories: product, brand, health, finance
    - Normalize input text for matching (lowercase, diacritics handling)
    - _Requirements: 18.1, 18.2, 18.3, 19.2, 19.3_

  - [x] 7.4 Implement api.py (FastAPI endpoints)
    - Create FastAPI app on port 9004
    - Implement `POST /api/link` — detect mentions and return affiliate links
    - Implement `GET /api/health` — health check
    - Implement `GET /api/catalog/stats` — catalog size and last update
    - Handle MongoDB unreachable gracefully (return empty mentions)
    - _Requirements: 18.4, 18.5, 19.2_

  - [x] 7.5 Implement config.py (settings)
    - Define settings: MongoDB URI, port (9004), catalog refresh interval
    - Load from environment variables with sensible defaults
    - _Requirements: 25.2_

  - [x] 7.6 Write unit tests for product-linker
    - Create `tests/test_detector.py` — test detection with known catalog entries
    - Create `tests/test_api.py` — test endpoints with TestClient
    - _Requirements: 18.1-18.5, 19.1-19.3_

- [x] 8. Checkpoint — product-linker complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify service starts on port 9004 via uvicorn
  - Verify RAM usage stays under 200MB
  - _Requirements: 25.2, 26.1_

- [ ] 9. Offline resilience pattern (TypeScript)
  - [x] 9.1 Create offline resilience service template
    - Create `offline-resilience/src/services/offlineResilience.ts` as a reusable template
    - Implement `OfflineResilienceService` class with `cacheResponse`, `findCachedResponse`, `queueRequest`, `processQueue`, `isAIOnline`
    - Configure per-service Cache_TTL: 7 days (news), 30 days (products), 90 days (health/tax)
    - MongoDB `$text` search with score threshold 0.7
    - Include "Dựa trên dữ liệu đã lưu" label on cached responses
    - _Requirements: 20.1, 20.2, 20.3, 21.1, 21.2, 21.3, 21.4_

  - [x] 9.2 Implement queue processing logic
    - Store pending requests with status "pending" and timestamp
    - Process queued requests in FIFO order when AI comes back online
    - Store results in cache after processing
    - Notify user if notification channel exists
    - Retry failed queue items up to 3 times
    - _Requirements: 22.1, 22.2, 22.3_

  - [x] 9.3 Implement CareMate emergency detection
    - Create `offline-resilience/src/services/emergencyDetector.ts`
    - Define emergency keywords list: "đau ngực", "khó thở", "chảy máu nhiều", "bất tỉnh", etc.
    - Implement `detectEmergency(message: string) -> boolean` with keyword matching
    - Implement `getEmergencyResponse() -> string` returning 115 emergency message
    - Emergency check runs BEFORE AI engine contact or cache lookup
    - _Requirements: 23.1, 23.2, 23.3_

  - [x] 9.4 Create MongoDB indexes and collection setup
    - Define text index on `query` field for `_ai_cache` collections
    - Define TTL index on `expires_at` for automatic cache cleanup
    - Create index on `status` + `created_at` for queue FIFO processing
    - Provide setup script or instructions for each VPS service
    - _Requirements: 20.3, 22.2_

  - [x] 9.5 Write unit tests for offline resilience
    - Test cache storage and retrieval with score threshold
    - Test queue FIFO ordering
    - Test emergency keyword detection
    - Test AI online/offline health check logic
    - _Requirements: 20.1-20.3, 21.1-21.4, 22.1-22.3, 23.1-23.3_

- [x] 10. Checkpoint — offline resilience complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify TypeScript compiles without errors
  - _Requirements: 20.1-23.3_

- [ ] 11. Startup scripts and deployment support
  - [x] 11.1 Create start-all.bat
    - Check MongoDB reachability (mongosh ping)
    - Check Redis reachability (redis-cli ping)
    - Check Ollama availability (warn if not running)
    - Start product-linker via uvicorn on port 9004
    - Display clear error messages for missing dependencies
    - _Requirements: 25.1, 25.3, 25.4_

  - [x] 11.2 Create stop-all.bat
    - Stop product-linker process
    - _Requirements: 25.1_

- [ ] 12. Integration and migration
  - [x] 12.1 Create migration guide and verify backward compatibility
    - Document import replacement patterns for each AI engine
    - Verify shared libs provide same interface as per-repo implementations
    - Verify `shared-llm-client` connects to Ollama on :11434 without config changes
    - Ensure existing per-repo code continues working alongside shared libs
    - _Requirements: 27.1, 27.2, 27.3_

  - [x] 12.2 Migrate fin-tax-ai to shared libs (lowest risk first)
    - Install shared-vn-nlp and shared-llm-client via `pip install -e`
    - Replace per-repo NLP imports with `from shared_vn_nlp import ...`
    - Replace per-repo LLM client with `from shared_llm_client import LLMClient`
    - Run existing fin-tax-ai tests to verify equivalence
    - _Requirements: 27.2_

  - [x] 12.3 Migrate caremate-ai to shared libs
    - Install shared-vn-nlp and shared-llm-client
    - Replace per-repo imports
    - Run existing caremate-ai tests
    - _Requirements: 27.2_

  - [x] 12.4 Migrate smartbuy-ai to shared libs
    - Install shared-vn-nlp and shared-llm-client
    - Replace per-repo imports
    - Run existing smartbuy-ai tests
    - _Requirements: 27.2_

  - [x] 12.5 Migrate trend-brief-ai to shared libs
    - Install shared-vn-nlp, shared-crawler, and shared-llm-client
    - Replace per-repo imports (NLP, crawler, LLM)
    - Run existing trend-brief-ai tests
    - _Requirements: 27.2_

  - [x] 12.6 Migrate ai-video-engine to shared libs
    - Install shared-vn-nlp, shared-crawler, and shared-llm-client
    - Replace per-repo imports
    - Run existing ai-video-engine tests
    - _Requirements: 27.2_

- [x] 13. Checkpoint — migration complete
  - Ensure all tests pass across all 5 AI engines, ask the user if questions arise.
  - Verify no existing Release 1 functionality is broken
  - _Requirements: 26.3, 27.1, 27.2_

- [ ] 14. Property-based tests
  - [x] 14.1 Write property tests for shared-vn-nlp (Properties 1-6)
    - **Property 1: Slang normalization idempotence** — `normalize(normalize(text)) == normalize(text)`
    - **Property 2: Slang normalization correctness with case-insensitivity** — case-insensitive matching, non-slang casing preserved
    - **Property 3: No-slang text identity** — text without slang returns unchanged
    - **Property 4: Province detection with alternate names** — all alternates detected correctly
    - **Property 5: Event date range containment** — all returned events fall within queried range
    - **Property 6: Sentiment output structure invariant** — label ∈ {positive, negative, neutral}, score ∈ [0.0, 1.0]
    - **Validates: Requirements 2.2-2.5, 3.2-3.3, 4.3, 5.1**

  - [x] 14.2 Write property tests for shared-crawler (Properties 7-12)
    - **Property 7: Crawl content consumer filtering** — results only delivered to listed consumers
    - **Property 8: Rate limiting enforcement** — no more than N requests per 60s window
    - **Property 9: Retry with exponential backoff** — delays follow `base_delay * 2^attempt`
    - **Property 10: Health degradation after consecutive failures** — degraded after 3+ consecutive failures
    - **Property 11: URL deduplication round-trip with normalization** — normalized URL variants detected as duplicates
    - **Property 12: User-Agent rotation** — multiple distinct UAs used across N requests
    - **Validates: Requirements 6.4, 7.1-7.2, 8.1-8.2, 9.2, 10.1-10.4, 11.1**

  - [x] 14.3 Write property tests for shared-llm-client (Properties 13-16)
    - **Property 13: LLM cache round-trip** — cached response matches original, different inputs produce different keys
    - **Property 14: Circuit breaker state machine** — correct state transitions for all success/failure sequences
    - **Property 15: Fallback chain ordering** — providers attempted in configured order
    - **Property 16: Streaming output structure** — token events followed by one final event
    - **Validates: Requirements 13.1-13.4, 14.1-14.5, 15.2, 17.1-17.2**

  - [x] 14.4 Write property tests for product-linker (Property 17)
    - **Property 17: Product and topic detection** — catalog entries detected with correct category type
    - **Validates: Requirements 18.1-18.3**

  - [x] 14.5 Write property tests for offline resilience (Properties 18-20)
    - **Property 18: Offline cache threshold and labeling** — score > 0.7 enforced, label included
    - **Property 19: Queue FIFO processing order** — earliest created_at processed first
    - **Property 20: Emergency keyword detection** — emergency keywords trigger immediate response without AI/cache
    - **Validates: Requirements 21.2-21.3, 22.2, 23.1-23.2**

  - [x] 14.6 Write property test for backward compatibility (Property 21)
    - **Property 21: Backward compatibility interface equivalence** — shared lib produces equivalent output to per-repo implementation for same inputs
    - **Validates: Requirements 27.2**

- [x] 15. Final checkpoint — all shared services complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all 3 libraries installable via `pip install -e`
  - Verify product-linker runs on port 9004 within 200MB RAM
  - Verify start-all.bat and stop-all.bat work correctly
  - Verify no Release 1 functionality broken across all 5 engines
  - _Requirements: 24.1-24.4, 25.1-25.4, 26.1-26.3, 27.1-27.3_

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation between phases
- Property tests use `hypothesis` library (already used in trend-brief-ai), minimum 100 iterations per property
- Migration order (fin-tax → caremate → smartbuy → trend-brief → video) goes from simplest to most complex usage
- Rollback at any point: revert import statements to restore per-repo implementations
