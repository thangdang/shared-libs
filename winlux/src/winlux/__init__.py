"""WinLux — Unified shared library for all WinLux AI products.

Consolidates: shared-vn-nlp, shared-llm-client, shared-crawler, rag

Usage (single import):
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

Usage (module imports):
    from winlux.nlp import segment, ner, normalize_slang
    from winlux.llm import LLMClient, LiteAgent
    from winlux.crawler import CrawlEngine, ProxyPool
    from winlux.rag import VectorStore, EmbeddingService
"""

__version__ = "1.0.0"

# ═══════════════════════════════════════════════════════════════════════════════
# NLP MODULE — Vietnamese NLP utilities
# ═══════════════════════════════════════════════════════════════════════════════

from winlux.nlp import (
    # Core NLP
    segment,
    ner,
    pos_tag,
    # Slang
    normalize_slang,
    # Provinces
    detect_provinces,
    # Calendar
    get_events,
    get_events_in_range,
    lunar_to_solar,
    # Sentiment
    analyze_sentiment,
    # Phone
    normalize_phone,
    validate_phone,
    detect_carrier,
    PhoneResult,
    # Currency
    format_vnd,
    format_compact,
    parse_vnd,
    # Address
    parse_address,
    ParsedAddress,
)

# ═══════════════════════════════════════════════════════════════════════════════
# LLM MODULE — Unified LLM client with routing, caching, and agents
# ═══════════════════════════════════════════════════════════════════════════════

from winlux.llm import (
    # Core client
    LLMClient,
    LLMResponse,
    # Security
    PromptSanitizer,
    SanitizationResult,
    PromptGuard,
    AuditLogger,
    # Routing
    ModelRouter,
    Complexity,
    ModelSelection,
    # Agents
    LiteAgent,
    LiteAgentResult,
    HybridEngine,
    HybridResult,
    TrustLevel,
    # Memory & Learning
    AgentMemory,
    FewShotManager,
    self_reflect,
    get_criteria,
    # Safety
    SafetyLayer,
    SafetyResult,
    ConfidenceRouter,
    ConfidenceResult,
    # Guard
    AgentGuard,
    GuardConfig,
    PRODUCT_LIMITS,
    # Circuit breaker
    CircuitBreaker,
    CircuitState,
    # Strategy
    ModelStrategy,
    # A/B testing
    PromptABTracker,
    PromptVariant,
)

# ═══════════════════════════════════════════════════════════════════════════════
# CRAWLER MODULE — Config-driven crawl engine
# ═══════════════════════════════════════════════════════════════════════════════

from winlux.crawler import (
    # Core
    CrawlEngine,
    CrawlResult,
    # Proxy
    ProxyPool,
    ProxyConfig,
    ProxyInfo,
    # Scheduler
    CrawlScheduler,
    CrawlJob,
    Priority,
    # Translation
    TranslationPipeline,
    TranslatedText,
    # Playwright Pool
    PlaywrightPool,
    # Product Dedup
    CrossSourceDedup,
    CrawledProduct,
    DedupResult,
    # Circuit Breaker
    CrawlerCircuitBreaker,
    # Rate Limiter
    RedisRateLimiter,
)

# ═══════════════════════════════════════════════════════════════════════════════
# RAG MODULE — Retrieval-Augmented Generation
# ═══════════════════════════════════════════════════════════════════════════════

from winlux.rag import (
    EmbeddingService,
    VectorStore,
    SearchResult,
    FAISSStore,
    ChromaStore,
    MongoVectorSync,
    RAGPromptBuilder,
    ResponseValidator,
)

# ═══════════════════════════════════════════════════════════════════════════════
# LINKER MODULE — Product/topic detection and affiliate linking
# ═══════════════════════════════════════════════════════════════════════════════

from winlux.linker import (
    MentionDetector,
    ProductLinker,
    detect_products,
    generate_affiliate_link,
)

__all__ = [
    # NLP
    "segment",
    "ner",
    "pos_tag",
    "normalize_slang",
    "detect_provinces",
    "get_events",
    "get_events_in_range",
    "lunar_to_solar",
    "analyze_sentiment",
    "normalize_phone",
    "validate_phone",
    "detect_carrier",
    "PhoneResult",
    "format_vnd",
    "format_compact",
    "parse_vnd",
    "parse_address",
    "ParsedAddress",
    # LLM
    "LLMClient",
    "LLMResponse",
    "PromptSanitizer",
    "SanitizationResult",
    "PromptGuard",
    "AuditLogger",
    "ModelRouter",
    "Complexity",
    "ModelSelection",
    "LiteAgent",
    "LiteAgentResult",
    "HybridEngine",
    "HybridResult",
    "TrustLevel",
    "AgentMemory",
    "FewShotManager",
    "self_reflect",
    "get_criteria",
    "SafetyLayer",
    "SafetyResult",
    "ConfidenceRouter",
    "ConfidenceResult",
    "AgentGuard",
    "GuardConfig",
    "PRODUCT_LIMITS",
    "CircuitBreaker",
    "CircuitState",
    "ModelStrategy",
    "PromptABTracker",
    "PromptVariant",
    # Crawler
    "CrawlEngine",
    "CrawlResult",
    "ProxyPool",
    "ProxyConfig",
    "ProxyInfo",
    "CrawlScheduler",
    "CrawlJob",
    "Priority",
    "TranslationPipeline",
    "TranslatedText",
    "PlaywrightPool",
    "CrossSourceDedup",
    "CrawledProduct",
    "DedupResult",
    "CrawlerCircuitBreaker",
    "RedisRateLimiter",
    # RAG
    "EmbeddingService",
    "VectorStore",
    "SearchResult",
    "FAISSStore",
    "ChromaStore",
    "MongoVectorSync",
    "RAGPromptBuilder",
    "ResponseValidator",
    # Linker
    "MentionDetector",
    "ProductLinker",
    "detect_products",
    "generate_affiliate_link",
]
