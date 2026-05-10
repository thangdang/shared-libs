# Requirements Document: Shared Services

## Introduction

This document defines requirements for the shared infrastructure layer (Release 2) that eliminates code duplication across 5 AI repositories (trend-brief-ai, smartbuy-ai, caremate-ai, fin-tax-ai, ai-video-engine). The shared layer consists of 3 Python libraries installed via `pip install -e`, 1 FastAPI microservice, and 1 offline resilience pattern implemented per VPS Express service.

**Deployment model:** Libraries and the product-linker service run on the local PC (16-32GB RAM). VPS hosts Express.js services, MongoDB, Redis, Nginx, and Angular/Flutter apps. No Docker is used — all services are started manually via bat scripts or systemd.

## Glossary

- **Shared_VN_NLP**: Python library providing Vietnamese natural language processing utilities including word segmentation, NER, POS tagging, slang normalization, province tagging, calendar events, and sentiment analysis.
- **Shared_Crawler**: Python library providing a config-driven crawl engine with multiple extractor types, rate limiting, retry logic, health tracking, deduplication, and anti-bot measures.
- **Shared_LLM_Client**: Python library providing a unified Ollama client with retry logic, response caching, circuit breaker, fallback chain, timeout handling, structured JSON output, and streaming support.
- **Product_Linker**: FastAPI microservice (port 9004) that detects product/brand/health/finance mentions in text and returns affiliate links from a MongoDB catalog.
- **Offline_Resilience**: Pattern implemented in each VPS Express.js service enabling cached AI responses when the local PC (running AI engines) is offline.
- **AI_Engine**: Any of the 5 Python AI services (trend-brief-ai, smartbuy-ai, caremate-ai, fin-tax-ai, ai-video-engine) running on the local PC.
- **VPS_Service**: Express.js service running on the always-online VPS that serves end users.
- **Ollama**: Local LLM inference server running on port 11434, shared by all AI engines.
- **Circuit_Breaker**: A fault-tolerance pattern that stops calling a failing service after a threshold of failures, then resets after a cooldown period.
- **Crawl_Source_Config**: MongoDB document defining a crawl source (source_id, type, URL, selectors, consumers) used by Shared_Crawler instead of per-source code files.
- **Cache_TTL**: Time-to-live duration for cached data before expiration.
- **Request_Queue**: MongoDB collection storing AI requests that could not be served from cache while the local PC is offline, to be processed when the PC comes back online.

## Requirements

### Requirement 1: Vietnamese NLP Word Segmentation

**User Story:** As an AI engine developer, I want a shared Vietnamese word segmentation wrapper, so that all repos use consistent tokenization without duplicating underthesea integration code.

#### Acceptance Criteria

1. WHEN a Vietnamese text string is provided, THE Shared_VN_NLP SHALL segment the text into words using underthesea word_tokenize and return a list of word tokens.
2. WHEN a Vietnamese text string is provided for NER, THE Shared_VN_NLP SHALL extract named entities with their entity types using underthesea NER.
3. WHEN a Vietnamese text string is provided for POS tagging, THE Shared_VN_NLP SHALL return each token annotated with its part-of-speech tag using underthesea POS tagging.
4. IF an empty string is provided, THEN THE Shared_VN_NLP SHALL return an empty list without raising an exception.

---

### Requirement 2: Vietnamese Slang Normalization

**User Story:** As an AI engine developer, I want a shared slang normalizer, so that Vietnamese internet abbreviations are expanded consistently across all repos before NLP processing.

#### Acceptance Criteria

1. THE Shared_VN_NLP SHALL maintain a slang mapping dictionary containing at least 100 Vietnamese abbreviation-to-expansion pairs loaded from a JSON data file.
2. WHEN a text string containing Vietnamese slang abbreviations is provided, THE Shared_VN_NLP SHALL replace all recognized abbreviations with their full-form expansions.
3. THE Shared_VN_NLP SHALL perform case-insensitive slang matching while preserving the original casing of non-slang text.
4. WHEN a text string contains no recognized slang, THE Shared_VN_NLP SHALL return the original text unchanged.
5. FOR ALL valid text inputs, normalizing then normalizing again SHALL produce the same result as normalizing once (idempotence property).

---

### Requirement 3: Province and Region Tagging

**User Story:** As an AI engine developer, I want to detect Vietnamese province and region mentions in text, so that content can be geo-tagged without requiring LLM inference.

#### Acceptance Criteria

1. THE Shared_VN_NLP SHALL maintain a province dataset covering all 63 Vietnamese provinces with their names, alternate names, and region classifications loaded from a JSON data file.
2. WHEN a text string is provided, THE Shared_VN_NLP SHALL detect province mentions using regex-based pattern matching and return a list of matched provinces with their regions.
3. THE Shared_VN_NLP SHALL match both official province names and common alternate names (e.g., "Sài Gòn" for "Hồ Chí Minh", "Hà Nội" with and without diacritics).
4. IF no province mentions are found in the text, THEN THE Shared_VN_NLP SHALL return an empty list.

---

### Requirement 4: Vietnamese Calendar and Events

**User Story:** As an AI engine developer, I want access to Vietnamese calendar events and seasonal data, so that content can be contextualized with cultural events without each repo maintaining its own event list.

#### Acceptance Criteria

1. THE Shared_VN_NLP SHALL maintain a Vietnamese events dataset containing at least 30 events including Tết, lunar calendar dates, and seasonal events loaded from a JSON data file.
2. WHEN a date is provided, THE Shared_VN_NLP SHALL return any Vietnamese cultural events or holidays occurring on or near that date.
3. WHEN a date range is provided, THE Shared_VN_NLP SHALL return all Vietnamese events falling within that range.
4. THE Shared_VN_NLP SHALL support lunar-to-solar date conversion for lunar calendar events.

---

### Requirement 5: Vietnamese Sentiment Analysis

**User Story:** As an AI engine developer, I want shared Vietnamese sentiment analysis, so that all repos can score text sentiment consistently without duplicating model integration.

#### Acceptance Criteria

1. WHEN a Vietnamese text string is provided, THE Shared_VN_NLP SHALL return a sentiment classification (positive, negative, or neutral) with a confidence score between 0.0 and 1.0.
2. THE Shared_VN_NLP SHALL apply slang normalization to the input text before performing sentiment analysis.
3. IF an empty string is provided, THEN THE Shared_VN_NLP SHALL return a neutral sentiment with a confidence score of 0.0.

---

### Requirement 6: Config-Driven Crawl Engine

**User Story:** As an AI engine developer, I want a single config-driven crawl engine, so that adding new crawl sources requires only a MongoDB config document instead of writing new code.

#### Acceptance Criteria

1. WHEN a Crawl_Source_Config document exists in MongoDB, THE Shared_Crawler SHALL crawl that source using the extractor type specified in the config (rss, html, api, or playwright).
2. THE Shared_Crawler SHALL support four extractor types: RSS (using feedparser), HTML (using CSS selectors), API (JSON endpoints), and Playwright (JavaScript-rendered pages).
3. WHEN a new Crawl_Source_Config is added to MongoDB, THE Shared_Crawler SHALL begin crawling that source on the next scheduled crawl cycle without requiring code changes or restarts.
4. THE Shared_Crawler SHALL filter crawled content by the consumers field in Crawl_Source_Config, delivering articles only to the AI engines listed as consumers.

---

### Requirement 7: Crawl Rate Limiting

**User Story:** As an AI engine developer, I want per-domain rate limiting for crawls, so that source websites are not overloaded and the crawler avoids being blocked.

#### Acceptance Criteria

1. THE Shared_Crawler SHALL enforce per-domain rate limits using Redis-backed counters with configurable requests-per-minute per domain.
2. WHILE a domain has reached its rate limit, THE Shared_Crawler SHALL queue pending requests for that domain and process them after the rate limit window resets.
3. WHEN multiple AI engines request crawls from the same domain simultaneously, THE Shared_Crawler SHALL coordinate through Redis to enforce a single shared rate limit across all consumers.

---

### Requirement 8: Crawl Retry with Exponential Backoff

**User Story:** As an AI engine developer, I want automatic retry with exponential backoff for failed crawls, so that transient network errors do not cause permanent data loss.

#### Acceptance Criteria

1. WHEN a crawl request fails due to a transient error (network timeout, HTTP 5xx, connection reset), THE Shared_Crawler SHALL retry the request up to 3 times with exponential backoff delays.
2. THE Shared_Crawler SHALL use exponential backoff with a base delay that doubles on each retry attempt.
3. IF all retry attempts are exhausted, THEN THE Shared_Crawler SHALL log the failure and record it in the crawl health tracking system.

---

### Requirement 9: Crawl Health Tracking

**User Story:** As an AI engine developer, I want crawl health metrics per source, so that degraded or broken sources are detected early.

#### Acceptance Criteria

1. THE Shared_Crawler SHALL record the success or failure status of each crawl attempt per source in MongoDB.
2. WHEN a source accumulates 3 or more consecutive failures, THE Shared_Crawler SHALL mark that source as degraded in the health tracking collection.
3. THE Shared_Crawler SHALL expose a health summary endpoint or method returning per-source success rate, last successful crawl timestamp, and consecutive failure count.

---

### Requirement 10: URL Deduplication

**User Story:** As an AI engine developer, I want URL-based deduplication, so that the same article is not processed multiple times across crawl cycles.

#### Acceptance Criteria

1. WHEN a URL is crawled, THE Shared_Crawler SHALL compute a hash of the URL and check it against a deduplication store before processing.
2. IF a URL hash already exists in the deduplication store, THEN THE Shared_Crawler SHALL skip processing that URL and move to the next item.
3. WHEN a URL is successfully processed, THE Shared_Crawler SHALL store its hash in the deduplication store.
4. FOR ALL URLs, hashing then checking SHALL correctly identify previously crawled URLs regardless of query parameter ordering or trailing slashes (URL normalization).

---

### Requirement 11: Anti-Bot Measures

**User Story:** As an AI engine developer, I want User-Agent rotation and anti-bot measures, so that crawlers are not blocked by target websites.

#### Acceptance Criteria

1. THE Shared_Crawler SHALL rotate User-Agent headers from a pool of at least 10 realistic browser User-Agent strings on each request.
2. THE Shared_Crawler SHALL randomize request timing within the rate limit window to avoid detectable patterns.
3. WHEN a crawl receives an HTTP 403 or 429 response, THE Shared_Crawler SHALL switch to a different User-Agent and apply an extended backoff delay before retrying.

---

### Requirement 12: Unified Ollama Client with Retry

**User Story:** As an AI engine developer, I want a shared Ollama client with built-in retry logic, so that transient Ollama failures do not crash AI pipelines.

#### Acceptance Criteria

1. WHEN an Ollama API call fails due to a transient error, THE Shared_LLM_Client SHALL retry the call up to 3 times with exponential backoff.
2. THE Shared_LLM_Client SHALL support configurable timeout per call, defaulting to 30 seconds for standard calls and 120 seconds for long-generation calls.
3. WHEN a call exceeds the configured timeout, THE Shared_LLM_Client SHALL cancel the request and either retry or invoke the fallback chain.

---

### Requirement 13: LLM Response Caching

**User Story:** As an AI engine developer, I want Redis-based response caching for LLM calls, so that identical prompts do not waste Ollama inference time.

#### Acceptance Criteria

1. WHEN an LLM call is made with a prompt that has been cached in Redis, THE Shared_LLM_Client SHALL return the cached response without calling Ollama.
2. WHEN an LLM call succeeds with a new prompt, THE Shared_LLM_Client SHALL store the response in Redis with a configurable TTL.
3. THE Shared_LLM_Client SHALL compute cache keys using a hash of the model name, prompt text, and generation parameters to avoid collisions.
4. FOR ALL cached responses, retrieving from cache SHALL produce the same response content as the original Ollama call (round-trip property).

---

### Requirement 14: Circuit Breaker for Ollama

**User Story:** As an AI engine developer, I want a circuit breaker for Ollama calls, so that when Ollama is down the system fails fast instead of accumulating timeouts.

#### Acceptance Criteria

1. WHEN the Shared_LLM_Client records 5 consecutive Ollama failures, THE Circuit_Breaker SHALL open and immediately reject subsequent calls without contacting Ollama.
2. WHILE the Circuit_Breaker is open, THE Shared_LLM_Client SHALL return responses from the fallback chain instead of attempting Ollama calls.
3. WHEN 30 seconds have elapsed since the Circuit_Breaker opened, THE Shared_LLM_Client SHALL allow one probe request to Ollama to test recovery.
4. WHEN a probe request succeeds, THE Circuit_Breaker SHALL close and resume normal Ollama calls.
5. WHEN a probe request fails, THE Circuit_Breaker SHALL remain open and reset the 30-second cooldown timer.

---

### Requirement 15: LLM Fallback Chain

**User Story:** As an AI engine developer, I want a configurable fallback chain, so that when Ollama is unavailable the system degrades gracefully through alternative providers.

#### Acceptance Criteria

1. THE Shared_LLM_Client SHALL support a configurable fallback chain with ordered providers (Ollama → Groq → template-based response).
2. WHEN the primary provider (Ollama) fails and the Circuit_Breaker is open, THE Shared_LLM_Client SHALL attempt the next provider in the fallback chain.
3. WHEN all providers in the fallback chain fail, THE Shared_LLM_Client SHALL return a template-based response with a flag indicating degraded mode.
4. THE Shared_LLM_Client SHALL log which provider served each response for monitoring purposes.

---

### Requirement 16: Structured JSON Output Mode

**User Story:** As an AI engine developer, I want the LLM client to enforce structured JSON output, so that downstream code can reliably parse LLM responses without manual extraction.

#### Acceptance Criteria

1. WHEN a JSON schema is provided with an LLM call, THE Shared_LLM_Client SHALL request Ollama to produce output conforming to that schema using Ollama's JSON mode.
2. IF the LLM response is not valid JSON, THEN THE Shared_LLM_Client SHALL retry the call up to 2 additional times requesting JSON format.
3. IF all JSON-mode retries produce invalid JSON, THEN THE Shared_LLM_Client SHALL return an error result with the raw response text for debugging.
4. FOR ALL valid JSON schema inputs, requesting structured output then parsing the response SHALL produce a valid object matching the provided schema (round-trip property).

---

### Requirement 17: LLM Streaming Support

**User Story:** As an AI engine developer, I want SSE token-by-token streaming from the LLM client, so that user-facing services can display responses progressively.

#### Acceptance Criteria

1. WHEN a streaming LLM call is made, THE Shared_LLM_Client SHALL yield tokens as Server-Sent Events as they are generated by Ollama.
2. WHEN streaming is complete, THE Shared_LLM_Client SHALL emit a final event containing the complete response and usage metadata.
3. IF a streaming call fails mid-stream, THEN THE Shared_LLM_Client SHALL emit an error event and close the stream gracefully.
4. THE Shared_LLM_Client SHALL support both streaming and non-streaming modes through the same client interface with a stream parameter.

---

### Requirement 18: Product and Topic Linking

**User Story:** As an AI engine developer, I want a service that detects product/brand/health/finance mentions in text and returns affiliate links, so that content is monetized across repos without duplicating detection logic.

#### Acceptance Criteria

1. WHEN a text string is provided, THE Product_Linker SHALL detect product and brand mentions and return matching affiliate links from the MongoDB catalog.
2. WHEN a text string contains health-related topics, THE Product_Linker SHALL return links to relevant CareMate content.
3. WHEN a text string contains finance-related topics, THE Product_Linker SHALL return links to relevant FinTax content.
4. THE Product_Linker SHALL expose a FastAPI endpoint on port 9004 accepting text input and returning a list of detected mentions with their corresponding links.
5. IF the Product_Linker is offline, THEN consuming AI engines SHALL serve content without affiliate links and without errors (non-critical dependency).

---

### Requirement 19: Affiliate Catalog Management

**User Story:** As a system administrator, I want to manage the affiliate catalog in MongoDB, so that new products and links can be added without code changes.

#### Acceptance Criteria

1. THE Product_Linker SHALL read its affiliate catalog from a MongoDB collection containing documents with fields: product_name, brand, affiliate_url, platform, and category.
2. WHEN the affiliate catalog is updated in MongoDB, THE Product_Linker SHALL reflect the changes on subsequent requests without requiring a service restart.
3. THE Product_Linker SHALL support matching by product name, brand name, and topic keywords defined in the catalog.

---

### Requirement 20: Offline AI Cache Storage

**User Story:** As a VPS service developer, I want every successful AI response cached in MongoDB, so that users can be served cached data when the local PC is offline.

#### Acceptance Criteria

1. WHEN an AI_Engine returns a successful response, THE VPS_Service SHALL store the response in its per-service `_ai_cache` MongoDB collection with a timestamp and the original query.
2. THE VPS_Service SHALL apply service-specific Cache_TTL values: 7 days for news content (trend-brief), 30 days for product data (smartbuy), and 90 days for health and tax content (caremate, fin-tax).
3. THE VPS_Service SHALL create a MongoDB text index on the query field of the cache collection to enable text-based similarity search.

---

### Requirement 21: Offline Cache Retrieval

**User Story:** As a VPS service developer, I want to serve cached AI responses when the local PC is offline, so that users still receive useful data.

#### Acceptance Criteria

1. WHEN the AI_Engine is unreachable and a user request is received, THE VPS_Service SHALL search the `_ai_cache` collection using MongoDB $text search with the user's query.
2. THE VPS_Service SHALL return a cached response only when the MongoDB text search score exceeds a threshold of 0.7.
3. WHEN a cached response is served, THE VPS_Service SHALL include the label "Dựa trên dữ liệu đã lưu" (Based on saved data) in the response to inform the user.
4. IF no cached response meets the score threshold, THEN THE VPS_Service SHALL queue the request for later processing and inform the user that the service is temporarily limited.

---

### Requirement 22: Offline Request Queue

**User Story:** As a VPS service developer, I want requests that cannot be served from cache to be queued, so that they are processed when the local PC comes back online.

#### Acceptance Criteria

1. WHEN a user request cannot be served from cache and the AI_Engine is offline, THE VPS_Service SHALL store the request in a MongoDB queue collection with status "pending" and a timestamp.
2. WHEN the AI_Engine comes back online, THE VPS_Service SHALL process all pending queued requests in FIFO order and store the results in the cache.
3. WHEN a queued request is processed, THE VPS_Service SHALL notify the user (if a notification channel exists) that their request has been answered.

---

### Requirement 23: CareMate Emergency Safety (Offline)

**User Story:** As a VPS service developer, I want CareMate emergency red-flag detection to work without AI, so that critical health emergencies are handled even when the local PC is offline.

#### Acceptance Criteria

1. THE VPS_Service for CareMate SHALL implement rule-based emergency red-flag detection using keyword matching that runs entirely on the VPS without requiring the AI_Engine.
2. WHEN emergency keywords are detected in a user message (e.g., "đau ngực", "khó thở", "chảy máu nhiều", "bất tỉnh"), THE VPS_Service SHALL immediately return an emergency response directing the user to call 115 (Vietnam emergency number).
3. THE VPS_Service SHALL evaluate emergency rules BEFORE attempting AI_Engine contact or cache lookup, ensuring zero-latency emergency responses.

---

### Requirement 24: Library Installation and Integration

**User Story:** As an AI engine developer, I want shared libraries installable via `pip install -e`, so that I can import them directly in my engine code without managing separate deployments.

#### Acceptance Criteria

1. THE Shared_VN_NLP SHALL be packaged with a pyproject.toml enabling installation via `pip install -e ./shared-libs/shared-vn-nlp`.
2. THE Shared_Crawler SHALL be packaged with a pyproject.toml enabling installation via `pip install -e ./shared-libs/shared-crawler`.
3. THE Shared_LLM_Client SHALL be packaged with a pyproject.toml enabling installation via `pip install -e ./shared-libs/shared-llm-client`.
4. WHEN installed in editable mode, THE shared libraries SHALL allow importing via standard Python import statements (e.g., `from shared_vn_nlp import nlp`).

---

### Requirement 25: Manual Deployment Support

**User Story:** As a system administrator, I want all shared services startable via bat scripts without Docker, so that the deployment matches the existing no-Docker constraint.

#### Acceptance Criteria

1. THE shared-libs repository SHALL include a `start-all.bat` script that starts the Product_Linker service and any other required background processes.
2. THE Product_Linker SHALL be startable as a standalone uvicorn process without requiring Docker or containerization.
3. WHEN the `start-all.bat` script is executed, THE script SHALL verify that MongoDB and Redis are reachable before starting services.
4. IF MongoDB or Redis is unreachable at startup, THEN THE script SHALL display a clear error message indicating which dependency is unavailable.

---

### Requirement 26: RAM Budget Compliance

**User Story:** As a system administrator, I want shared services to stay within RAM budget, so that the local PC can run all AI engines alongside shared infrastructure.

#### Acceptance Criteria

1. THE Product_Linker SHALL consume no more than 200MB of RAM during normal operation.
2. THE shared libraries (Shared_VN_NLP, Shared_Crawler, Shared_LLM_Client) SHALL add negligible RAM overhead as they run in-process within each AI_Engine.
3. THE shared infrastructure SHALL not break existing Release 1 functionality of any AI_Engine.

---

### Requirement 27: Backward Compatibility

**User Story:** As an AI engine developer, I want shared libraries to be adopted incrementally, so that existing per-repo implementations continue working during migration.

#### Acceptance Criteria

1. WHILE an AI_Engine has not migrated to a shared library, THE AI_Engine SHALL continue functioning with its existing per-repo implementation without errors.
2. WHEN an AI_Engine migrates to a shared library, THE shared library SHALL provide the same interface and behavior as the per-repo implementation it replaces.
3. THE Shared_LLM_Client SHALL connect to the existing shared Ollama instance on port 11434 without requiring Ollama configuration changes.
