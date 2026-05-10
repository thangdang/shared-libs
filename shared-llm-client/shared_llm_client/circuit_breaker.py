"""Circuit breaker pattern for Ollama calls.

Prevents cascading failures by failing fast when Ollama is down,
then periodically probing for recovery.

State machine:
  CLOSED → OPEN: after failure_threshold consecutive failures
  OPEN → HALF_OPEN: after reset_timeout seconds
  HALF_OPEN → CLOSED: on probe success
  HALF_OPEN → OPEN: on probe failure (resets timer)
"""

import time
from enum import Enum


class CircuitState(Enum):
    """Circuit breaker states."""

    CLOSED = "closed"       # normal operation
    OPEN = "open"           # rejecting calls
    HALF_OPEN = "half_open" # testing recovery


class CircuitBreaker:
    """Circuit breaker for Ollama calls.

    Opens after consecutive failures to prevent timeout accumulation.
    Allows periodic probe requests to test recovery.
    """

    def __init__(self, failure_threshold: int = 5, reset_timeout: int = 30):
        """Initialize circuit breaker.

        Args:
            failure_threshold: Number of consecutive failures to open circuit.
            reset_timeout: Seconds to wait before allowing a probe (OPEN → HALF_OPEN).
        """
        self._state: CircuitState = CircuitState.CLOSED
        self._failure_count: int = 0
        self._last_failure_time: float = 0.0
        self._failure_threshold = failure_threshold
        self._reset_timeout = reset_timeout

    @property
    def state(self) -> CircuitState:
        """Current state (alias for get_state)."""
        return self.get_state()

    @property
    def failure_count(self) -> int:
        """Current consecutive failure count."""
        return self._failure_count

    def can_execute(self) -> bool:
        """Check if a call should be attempted.

        Returns:
            True if the call is allowed (CLOSED or HALF_OPEN probe).
        """
        current_state = self.get_state()
        if current_state == CircuitState.CLOSED:
            return True
        if current_state == CircuitState.HALF_OPEN:
            return True  # Allow one probe
        return False  # OPEN — reject

    def record_success(self) -> None:
        """Record a successful call.

        Resets failure count. Transitions HALF_OPEN → CLOSED.
        """
        self._failure_count = 0
        self._state = CircuitState.CLOSED

    def record_failure(self) -> None:
        """Record a failed call.

        Increments failure count. Transitions:
        - CLOSED → OPEN after threshold failures
        - HALF_OPEN → OPEN (resets timer)
        """
        self._failure_count += 1
        self._last_failure_time = time.time()

        if self._state == CircuitState.HALF_OPEN:
            # Probe failed — go back to OPEN
            self._state = CircuitState.OPEN
        elif self._failure_count >= self._failure_threshold:
            # Threshold reached — open circuit
            self._state = CircuitState.OPEN

    def get_state(self) -> CircuitState:
        """Get current state, checking time for OPEN → HALF_OPEN transition.

        Returns:
            Current CircuitState.
        """
        if self._state == CircuitState.OPEN:
            elapsed = time.time() - self._last_failure_time
            if elapsed >= self._reset_timeout:
                self._state = CircuitState.HALF_OPEN
        return self._state

    def reset(self) -> None:
        """Manually reset the circuit breaker to CLOSED state."""
        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._last_failure_time = 0.0
