"""Shared unified LLM client for AI engines.

Public API:
    LLMClient — Unified client with retry, cache, circuit breaker, fallback
    LLMResponse — Response dataclass

    Security:
    PromptSanitizer — Redacts PII before external LLM calls
    PromptGuard — Detects and blocks prompt injection attempts
    AuditLogger — Immutable audit trail for AI decisions

    Routing:
    ModelRouter — Routes tasks to optimal model by complexity
    Complexity — Task complexity enum
    ModelSelection — Model selection result

    Agents:
    LiteAgent — Single-call structured output agent (replaces CrewAI for simple tasks)
    LiteAgentResult — Agent execution result
    HybridEngine — Rule + AI decision engine with configurable trust levels
    HybridResult — Hybrid decision result

    Memory & Learning:
    AgentMemory — Persistent lessons learned across sessions
    FewShotManager — Vietnamese few-shot example management
    self_reflect — AI self-validation before returning output

    Guard:
    AgentGuard — Rate limiting + circuit breaker per product
    GuardConfig — Agent guard configuration

    Circuit:
    CircuitBreaker — Circuit breaker pattern implementation
    CircuitState — Circuit breaker state enum
"""

from shared_llm_client.client import LLMClient, LLMResponse
from shared_llm_client.circuit_breaker import CircuitBreaker, CircuitState
from shared_llm_client.sanitizer import PromptSanitizer, SanitizationResult
from shared_llm_client.prompt_guard import PromptGuard
from shared_llm_client.model_router import ModelRouter, Complexity, ModelSelection
from shared_llm_client.audit import AuditLogger
from shared_llm_client.agent_guard import AgentGuard, GuardConfig, PRODUCT_LIMITS
from shared_llm_client.lite_agent import LiteAgent, LiteAgentResult
from shared_llm_client.hybrid_engine import HybridEngine, HybridResult, TrustLevel
from shared_llm_client.agent_memory import AgentMemory
from shared_llm_client.few_shot import FewShotManager
from shared_llm_client.self_reflect import self_reflect, get_criteria
from shared_llm_client.safety_layer import SafetyLayer, SafetyResult
from shared_llm_client.confidence_router import ConfidenceRouter, ConfidenceResult

__all__ = [
    # Core client
    "LLMClient",
    "LLMResponse",
    # Security
    "PromptSanitizer",
    "SanitizationResult",
    "PromptGuard",
    "AuditLogger",
    # Routing
    "ModelRouter",
    "Complexity",
    "ModelSelection",
    # Agents
    "LiteAgent",
    "LiteAgentResult",
    "HybridEngine",
    "HybridResult",
    "TrustLevel",
    # Memory & Learning
    "AgentMemory",
    "FewShotManager",
    "self_reflect",
    "get_criteria",
    # Safety
    "SafetyLayer",
    "SafetyResult",
    "ConfidenceRouter",
    "ConfidenceResult",
    # Guard
    "AgentGuard",
    "GuardConfig",
    "PRODUCT_LIMITS",
    # Circuit breaker
    "CircuitBreaker",
    "CircuitState",
]
