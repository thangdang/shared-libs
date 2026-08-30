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
    ModelStrategy — YAML-driven model routing with trust levels
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

    Prompts:
    prompts.ClassificationTemplate — Vietnamese classification prompts
    prompts.GenerationTemplate — Vietnamese content generation prompts
    prompts.SummarizationTemplate — Vietnamese summarization prompts
    prompts.ExtractionTemplate — Vietnamese data extraction prompts
    prompts.ReasoningTemplate — Vietnamese reasoning/analysis prompts

    Guard:
    AgentGuard — Rate limiting + circuit breaker per product
    GuardConfig — Agent guard configuration

    A/B Testing:
    PromptABTracker — Prompt variant A/B testing and outcome tracking
    PromptVariant — Prompt variant definition dataclass

    Circuit:
    CircuitBreaker — Circuit breaker pattern implementation
    CircuitState — Circuit breaker state enum
"""

from winlux.llm.client import LLMClient, LLMResponse
from winlux.llm.circuit_breaker import CircuitBreaker, CircuitState
from winlux.llm.sanitizer import PromptSanitizer, SanitizationResult
from winlux.llm.prompt_guard import PromptGuard
from winlux.llm.model_router import ModelRouter, Complexity, ModelSelection
from winlux.llm.audit import AuditLogger
from winlux.llm.agent_guard import AgentGuard, GuardConfig, PRODUCT_LIMITS
from winlux.llm.lite_agent import LiteAgent, LiteAgentResult
from winlux.llm.hybrid_engine import HybridEngine, HybridResult, TrustLevel
from winlux.llm.agent_memory import AgentMemory
from winlux.llm.few_shot import FewShotManager
from winlux.llm.self_reflect import self_reflect, get_criteria
from winlux.llm.safety_layer import SafetyLayer, SafetyResult
from winlux.llm.confidence_router import ConfidenceRouter, ConfidenceResult
from winlux.llm.model_strategy import ModelStrategy
from winlux.llm.prompt_ab import PromptABTracker, PromptVariant

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
    # Strategy
    "ModelStrategy",
    # A/B testing
    "PromptABTracker",
    "PromptVariant",
]
