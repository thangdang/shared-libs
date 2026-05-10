"""Property-based tests for shared-llm-client.

Uses hypothesis library with minimum 100 iterations per property.
Tests correctness properties defined in the design document.
"""

# Feature: shared-services, Properties 13-16

import time
import pytest
from hypothesis import given, settings, assume
from hypothesis import strategies as st
from unittest.mock import patch

from shared_llm_client.cache import LLMCache
from shared_llm_client.circuit_breaker import CircuitBreaker, CircuitState


# --- Property 13: LLM cache round-trip ---
# Cached response matches original; different inputs produce different keys.

@settings(max_examples=100)
@given(
    st.text(min_size=1, max_size=50),
    st.text(min_size=1, max_size=200),
    st.dictionaries(
        keys=st.text(alphabet="abcdefghij", min_size=1, max_size=5),
        values=st.floats(min_value=0, max_value=1, allow_nan=False),
        min_size=0,
        max_size=3,
    ),
)
def test_property_13_cache_key_determinism(model, prompt, params):
    """Property 13: Same inputs produce same cache key."""
    cache = LLMCache("redis://localhost:6379")
    key1 = cache.compute_key(model, prompt, params)
    key2 = cache.compute_key(model, prompt, params)
    assert key1 == key2


@settings(max_examples=100)
@given(
    st.text(min_size=1, max_size=50),
    st.text(min_size=1, max_size=200),
    st.text(min_size=1, max_size=200),
)
def test_property_13_different_prompts_different_keys(model, prompt1, prompt2):
    """Property 13: Different prompts produce different cache keys."""
    assume(prompt1 != prompt2)
    cache = LLMCache("redis://localhost:6379")
    key1 = cache.compute_key(model, prompt1, {})
    key2 = cache.compute_key(model, prompt2, {})
    assert key1 != key2


# --- Property 14: Circuit breaker state machine ---
# Correct state transitions for all success/failure sequences.

@settings(max_examples=200)
@given(st.lists(st.booleans(), min_size=1, max_size=20))
def test_property_14_circuit_breaker_state_machine(results):
    """Property 14: Circuit breaker transitions correctly for any sequence."""
    cb = CircuitBreaker(failure_threshold=5, reset_timeout=9999)

    consecutive_failures = 0

    for success in results:
        if success:
            cb.record_success()
            consecutive_failures = 0
            # After success, should be CLOSED
            assert cb.get_state() == CircuitState.CLOSED
            assert cb.failure_count == 0
        else:
            cb.record_failure()
            consecutive_failures += 1

            if consecutive_failures >= 5:
                # Should be OPEN after threshold
                assert cb.get_state() == CircuitState.OPEN
                assert cb.can_execute() is False
            else:
                # Should still be CLOSED
                assert cb.get_state() == CircuitState.CLOSED


@settings(max_examples=100)
@given(st.integers(min_value=5, max_value=20))
def test_property_14_exactly_threshold_opens(n_failures):
    """Property 14: Exactly threshold failures opens the circuit."""
    cb = CircuitBreaker(failure_threshold=5, reset_timeout=9999)

    for i in range(n_failures):
        cb.record_failure()
        if i < 4:
            assert cb.get_state() == CircuitState.CLOSED
        else:
            assert cb.get_state() == CircuitState.OPEN


def test_property_14_half_open_probe():
    """Property 14: HALF_OPEN allows exactly one probe."""
    cb = CircuitBreaker(failure_threshold=5, reset_timeout=0)

    # Open the circuit
    for _ in range(5):
        cb.record_failure()
    assert cb.get_state() == CircuitState.OPEN

    # After timeout (0s), should transition to HALF_OPEN
    time.sleep(0.01)
    assert cb.get_state() == CircuitState.HALF_OPEN
    assert cb.can_execute() is True

    # Probe success → CLOSED
    cb.record_success()
    assert cb.get_state() == CircuitState.CLOSED


# --- Property 15: Fallback chain ordering ---
# Providers attempted in configured order.

@settings(max_examples=100)
@given(st.lists(st.sampled_from(["ollama", "groq", "template"]), min_size=1, max_size=3, unique=True))
def test_property_15_fallback_ordering(chain_order):
    """Property 15: Fallback chain maintains configured order."""
    from shared_llm_client.fallback import FallbackChain
    from shared_llm_client.providers.template import TemplateProvider
    from shared_llm_client.providers.ollama import OllamaProvider
    from shared_llm_client.providers.groq import GroqProvider

    provider_map = {
        "ollama": OllamaProvider(),
        "groq": GroqProvider(),
        "template": TemplateProvider(),
    }

    providers = [provider_map[name] for name in chain_order]
    chain = FallbackChain(providers)

    # Verify order is preserved
    actual_order = [p.name for p in chain.providers]
    assert actual_order == chain_order


# --- Property 16: Streaming output structure ---
# Token events followed by one final event.
# (Structural property - tested with format_sse_event)

@settings(max_examples=100)
@given(st.text(min_size=1, max_size=100))
def test_property_16_sse_event_format(data):
    """Property 16: SSE events have correct format."""
    from shared_llm_client.streaming import format_sse_event

    event = format_sse_event(data, "token")

    # Must contain event type
    assert "event: token" in event
    # Must contain data line
    assert "data: " in event
    # Must end with double newline (SSE spec)
    assert event.endswith("\n\n")
