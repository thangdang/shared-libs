"""Shared unified LLM client for AI engines.

Public API:
    LLMClient — Unified client with retry, cache, circuit breaker, fallback
    LLMResponse — Response dataclass
    CircuitBreaker — Circuit breaker pattern implementation
    CircuitState — Circuit breaker state enum
"""

from shared_llm_client.client import LLMClient, LLMResponse
from shared_llm_client.circuit_breaker import CircuitBreaker, CircuitState

__all__ = [
    "LLMClient",
    "LLMResponse",
    "CircuitBreaker",
    "CircuitState",
]
