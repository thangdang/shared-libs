"""Shared Crawler Circuit Breaker.

Prevents hammering a source that's failing. Opens after N consecutive failures,
half-opens after cooldown, closes on successful probe.

Used by: SmartBuy crawler, CareMate crawler, TrendBrief crawler.
"""

import time
import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict

logger = logging.getLogger(__name__)


class CircuitState(Enum):
    CLOSED = "closed"       # Normal — requests flow through
    OPEN = "open"           # Blocked — all requests rejected
    HALF_OPEN = "half_open" # Probe — one request allowed to test


@dataclass
class SourceCircuit:
    """Circuit breaker state for a single source/domain."""
    source: str
    state: CircuitState = CircuitState.CLOSED
    failure_count: int = 0
    last_failure: float = 0
    last_success: float = 0
    opened_at: float = 0

    def to_dict(self) -> dict:
        return {
            "source": self.source,
            "state": self.state.value,
            "failure_count": self.failure_count,
            "last_failure": self.last_failure,
            "last_success": self.last_success,
        }


class CrawlerCircuitBreaker:
    """Per-source circuit breaker for crawlers.

    Config:
        failure_threshold: Consecutive failures before opening (default: 5)
        cooldown_seconds: Time before half-open probe (default: 300 = 5min)
        success_threshold: Successes in half-open to close (default: 2)
    """

    def __init__(
        self,
        failure_threshold: int = 5,
        cooldown_seconds: int = 300,
        success_threshold: int = 2,
    ):
        self.failure_threshold = failure_threshold
        self.cooldown_seconds = cooldown_seconds
        self.success_threshold = success_threshold
        self._circuits: Dict[str, SourceCircuit] = {}

    def can_crawl(self, source: str) -> bool:
        """Check if crawling this source is allowed."""
        circuit = self._get_circuit(source)

        if circuit.state == CircuitState.CLOSED:
            return True

        if circuit.state == CircuitState.OPEN:
            # Check cooldown
            elapsed = time.time() - circuit.opened_at
            if elapsed >= self.cooldown_seconds:
                circuit.state = CircuitState.HALF_OPEN
                logger.info(f"[CircuitBreaker] {source}: OPEN → HALF_OPEN (cooldown elapsed)")
                return True  # Allow probe
            return False

        if circuit.state == CircuitState.HALF_OPEN:
            return True  # Allow probes

        return True

    def record_success(self, source: str) -> None:
        """Record successful crawl."""
        circuit = self._get_circuit(source)
        circuit.last_success = time.time()

        if circuit.state == CircuitState.HALF_OPEN:
            circuit.failure_count = max(0, circuit.failure_count - 1)
            if circuit.failure_count <= 0:
                circuit.state = CircuitState.CLOSED
                circuit.failure_count = 0
                logger.info(f"[CircuitBreaker] {source}: HALF_OPEN → CLOSED (recovered)")
        elif circuit.state == CircuitState.CLOSED:
            circuit.failure_count = 0  # Reset on success

    def record_failure(self, source: str) -> None:
        """Record failed crawl."""
        circuit = self._get_circuit(source)
        circuit.failure_count += 1
        circuit.last_failure = time.time()

        if circuit.state == CircuitState.HALF_OPEN:
            # Probe failed — back to OPEN
            circuit.state = CircuitState.OPEN
            circuit.opened_at = time.time()
            logger.warning(f"[CircuitBreaker] {source}: HALF_OPEN → OPEN (probe failed)")

        elif circuit.state == CircuitState.CLOSED:
            if circuit.failure_count >= self.failure_threshold:
                circuit.state = CircuitState.OPEN
                circuit.opened_at = time.time()
                logger.warning(
                    f"[CircuitBreaker] {source}: CLOSED → OPEN "
                    f"({circuit.failure_count} consecutive failures)"
                )

    def get_status(self) -> Dict[str, dict]:
        """Get all circuit statuses."""
        return {source: circuit.to_dict() for source, circuit in self._circuits.items()}

    def get_open_sources(self) -> list:
        """Get list of currently blocked sources."""
        return [
            source for source, circuit in self._circuits.items()
            if circuit.state == CircuitState.OPEN
        ]

    def reset(self, source: str) -> None:
        """Manually reset a circuit (admin action)."""
        if source in self._circuits:
            self._circuits[source] = SourceCircuit(source=source)
            logger.info(f"[CircuitBreaker] {source}: manually RESET")

    def _get_circuit(self, source: str) -> SourceCircuit:
        if source not in self._circuits:
            self._circuits[source] = SourceCircuit(source=source)
        return self._circuits[source]
