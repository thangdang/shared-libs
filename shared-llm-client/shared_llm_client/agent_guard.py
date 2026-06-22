"""Agent guard — rate limiting, circuit breaking, and fallback for AI agents.

Prevents runaway agents from consuming too many resources.
Configurable per product with daily limits, concurrency, and timeouts.

Usage:
    guard = AgentGuard(product="childhood", config=PRODUCT_LIMITS["childhood"])
    if guard.can_execute("content_planning"):
        result = await guard.execute_with_fallback(
            operation="content_planning",
            agent_fn=run_planning_crew,
            fallback_fn=run_template_planning,
        )
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Coroutine, Dict, Optional

logger = logging.getLogger(__name__)


@dataclass
class GuardConfig:
    """Configuration for agent guard per product."""
    max_daily_executions: int = 100
    max_concurrent: int = 2
    timeout_seconds: float = 120.0
    circuit_failure_threshold: int = 3
    circuit_reset_minutes: int = 30
    # Operation-specific overrides
    operation_limits: Dict[str, int] = field(default_factory=dict)
    # Blocked operations (never allow)
    blocked_operations: list = field(default_factory=list)


# Per-product default configurations
PRODUCT_LIMITS: Dict[str, GuardConfig] = {
    "childhood": GuardConfig(
        max_daily_executions=200,
        max_concurrent=2,
        timeout_seconds=180.0,
        operation_limits={
            "content_planning": 50,
            "script_writing": 100,
            "quality_gate": 200,
        },
    ),
    "caremate": GuardConfig(
        max_daily_executions=500,
        max_concurrent=5,
        timeout_seconds=30.0,
        operation_limits={
            "symptom_analysis": 500,
            "drug_check": 1000,
        },
    ),
    "fintax": GuardConfig(
        max_daily_executions=300,
        max_concurrent=3,
        timeout_seconds=30.0,
        operation_limits={
            "tax_calculation": 300,
            "income_classification": 500,
        },
    ),
    "smartbuy": GuardConfig(
        max_daily_executions=500,
        max_concurrent=5,
        timeout_seconds=15.0,
    ),
    "trendbriefai": GuardConfig(
        max_daily_executions=500,
        max_concurrent=5,
        timeout_seconds=15.0,
    ),
    "doctorcar": GuardConfig(
        max_daily_executions=500,
        max_concurrent=3,
        timeout_seconds=60.0,
        operation_limits={
            "diagnostic_crew": 200,
            "content_generation": 100,
        },
    ),
}


class AgentGuard:
    """Rate limiter + circuit breaker + fallback for AI agent operations.

    Thread-safe for async usage.
    """

    def __init__(self, product: str, config: Optional[GuardConfig] = None):
        """Initialize guard for a product.

        Args:
            product: Product name.
            config: Optional override config.
        """
        self.product = product.lower()
        self._config = config or PRODUCT_LIMITS.get(self.product, GuardConfig())

        # State
        self._daily_count = 0
        self._daily_reset_time = time.time()
        self._operation_counts: Dict[str, int] = {}
        self._active_count = 0
        self._failure_count = 0
        self._circuit_open = False
        self._circuit_open_time = 0.0
        self._semaphore = asyncio.Semaphore(self._config.max_concurrent)

    def can_execute(self, operation: str = "default") -> bool:
        """Check if an operation can execute right now.

        Args:
            operation: Operation name.

        Returns:
            True if allowed, False if blocked.
        """
        # Check blocked list
        if operation in self._config.blocked_operations:
            logger.warning(f"[{self.product}] Operation '{operation}' is blocked")
            return False

        # Reset daily counter if new day
        self._check_daily_reset()

        # Check daily limit
        if self._daily_count >= self._config.max_daily_executions:
            logger.warning(
                f"[{self.product}] Daily limit reached: "
                f"{self._daily_count}/{self._config.max_daily_executions}"
            )
            return False

        # Check operation-specific limit
        op_limit = self._config.operation_limits.get(operation)
        if op_limit is not None:
            op_count = self._operation_counts.get(operation, 0)
            if op_count >= op_limit:
                logger.warning(
                    f"[{self.product}] Operation limit reached for '{operation}': "
                    f"{op_count}/{op_limit}"
                )
                return False

        # Check circuit breaker
        if self._circuit_open:
            elapsed = time.time() - self._circuit_open_time
            if elapsed < self._config.circuit_reset_minutes * 60:
                logger.warning(f"[{self.product}] Circuit breaker OPEN — blocking")
                return False
            else:
                # Half-open — allow one probe
                self._circuit_open = False
                self._failure_count = 0
                logger.info(f"[{self.product}] Circuit breaker half-open — probing")

        return True

    async def execute_with_fallback(
        self,
        operation: str,
        agent_fn: Callable[..., Coroutine],
        fallback_fn: Callable[..., Coroutine],
        *args,
        **kwargs,
    ) -> Any:
        """Execute an agent function with fallback on failure/limit.

        Args:
            operation: Operation name (for tracking).
            agent_fn: Primary async function to execute.
            fallback_fn: Fallback async function if primary fails/blocked.
            *args, **kwargs: Arguments passed to both functions.

        Returns:
            Result from agent_fn or fallback_fn.
        """
        if not self.can_execute(operation):
            logger.info(f"[{self.product}] Executing fallback for '{operation}' (guard blocked)")
            return await fallback_fn(*args, **kwargs)

        async with self._semaphore:
            self._active_count += 1
            try:
                result = await asyncio.wait_for(
                    agent_fn(*args, **kwargs),
                    timeout=self._config.timeout_seconds,
                )
                self._record_success(operation)
                return result

            except asyncio.TimeoutError:
                logger.warning(
                    f"[{self.product}] Operation '{operation}' timed out "
                    f"after {self._config.timeout_seconds}s — using fallback"
                )
                self._record_failure(operation)
                return await fallback_fn(*args, **kwargs)

            except Exception as e:
                logger.error(
                    f"[{self.product}] Operation '{operation}' failed: {e} — using fallback"
                )
                self._record_failure(operation)
                return await fallback_fn(*args, **kwargs)

            finally:
                self._active_count -= 1

    def _record_success(self, operation: str) -> None:
        """Record successful execution."""
        self._daily_count += 1
        self._operation_counts[operation] = self._operation_counts.get(operation, 0) + 1
        # Reset failure count on success
        if self._failure_count > 0:
            self._failure_count = max(0, self._failure_count - 1)

    def _record_failure(self, operation: str) -> None:
        """Record failed execution."""
        self._daily_count += 1
        self._failure_count += 1

        if self._failure_count >= self._config.circuit_failure_threshold:
            self._circuit_open = True
            self._circuit_open_time = time.time()
            logger.error(
                f"[{self.product}] Circuit breaker OPENED after "
                f"{self._failure_count} failures"
            )

    def _check_daily_reset(self) -> None:
        """Reset daily counter if 24h have passed."""
        elapsed = time.time() - self._daily_reset_time
        if elapsed >= 86400:
            self._daily_count = 0
            self._operation_counts.clear()
            self._daily_reset_time = time.time()

    def get_status(self) -> Dict:
        """Return current guard status."""
        return {
            "product": self.product,
            "daily_count": self._daily_count,
            "daily_limit": self._config.max_daily_executions,
            "active_count": self._active_count,
            "max_concurrent": self._config.max_concurrent,
            "circuit_open": self._circuit_open,
            "failure_count": self._failure_count,
            "operation_counts": dict(self._operation_counts),
        }
