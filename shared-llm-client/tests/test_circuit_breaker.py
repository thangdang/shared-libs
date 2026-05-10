"""Unit tests for shared_llm_client.circuit_breaker module."""

import time
import pytest
from unittest.mock import patch

from shared_llm_client.circuit_breaker import CircuitBreaker, CircuitState


class TestCircuitBreakerStates:
    """Tests for circuit breaker state transitions."""

    def test_initial_state_is_closed(self):
        """Circuit breaker starts in CLOSED state."""
        cb = CircuitBreaker()
        assert cb.get_state() == CircuitState.CLOSED

    def test_stays_closed_below_threshold(self):
        """Stays CLOSED with fewer failures than threshold."""
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(4):
            cb.record_failure()
        assert cb.get_state() == CircuitState.CLOSED

    def test_opens_at_threshold(self):
        """Transitions to OPEN after exactly threshold failures."""
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(5):
            cb.record_failure()
        assert cb.get_state() == CircuitState.OPEN

    def test_open_rejects_calls(self):
        """OPEN state rejects calls (can_execute returns False)."""
        cb = CircuitBreaker(failure_threshold=5, reset_timeout=30)
        for _ in range(5):
            cb.record_failure()
        assert cb.can_execute() is False

    def test_half_open_after_timeout(self):
        """Transitions to HALF_OPEN after reset_timeout elapses."""
        cb = CircuitBreaker(failure_threshold=5, reset_timeout=1)
        for _ in range(5):
            cb.record_failure()
        assert cb.get_state() == CircuitState.OPEN

        # Simulate time passing
        with patch("time.time", return_value=time.time() + 2):
            assert cb.get_state() == CircuitState.HALF_OPEN
            assert cb.can_execute() is True

    def test_half_open_to_closed_on_success(self):
        """HALF_OPEN → CLOSED on successful probe."""
        cb = CircuitBreaker(failure_threshold=5, reset_timeout=0)
        for _ in range(5):
            cb.record_failure()
        # Force HALF_OPEN by checking state (timeout=0)
        cb.get_state()
        cb.record_success()
        assert cb.get_state() == CircuitState.CLOSED

    def test_half_open_to_open_on_failure(self):
        """HALF_OPEN → OPEN on failed probe."""
        cb = CircuitBreaker(failure_threshold=5, reset_timeout=0)
        for _ in range(5):
            cb.record_failure()
        # Force HALF_OPEN
        cb.get_state()
        assert cb.get_state() == CircuitState.HALF_OPEN
        cb.record_failure()
        assert cb.get_state() == CircuitState.OPEN

    def test_success_resets_failure_count(self):
        """Success resets the failure counter."""
        cb = CircuitBreaker(failure_threshold=5)
        for _ in range(3):
            cb.record_failure()
        cb.record_success()
        assert cb.failure_count == 0
        assert cb.get_state() == CircuitState.CLOSED

    def test_can_execute_closed(self):
        """CLOSED state allows calls."""
        cb = CircuitBreaker()
        assert cb.can_execute() is True

    def test_reset(self):
        """Manual reset returns to CLOSED."""
        cb = CircuitBreaker(failure_threshold=2)
        cb.record_failure()
        cb.record_failure()
        assert cb.get_state() == CircuitState.OPEN
        cb.reset()
        assert cb.get_state() == CircuitState.CLOSED
        assert cb.failure_count == 0
