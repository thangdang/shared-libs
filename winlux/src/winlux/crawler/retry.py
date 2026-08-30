"""Exponential backoff retry logic for crawl operations.

Retries transient errors (network timeouts, HTTP 5xx, connection errors)
with delays following base_delay * 2^attempt pattern.
"""

import asyncio
import logging
from typing import TypeVar, Callable, Awaitable, Tuple, Type

import httpx

logger = logging.getLogger(__name__)

T = TypeVar("T")

# Default transient errors that should trigger retry
DEFAULT_TRANSIENT_ERRORS: Tuple[Type[Exception], ...] = (
    TimeoutError,
    ConnectionError,
    httpx.TimeoutException,
    httpx.ConnectError,
    httpx.ReadTimeout,
)


async def with_retry(
    fn: Callable[..., Awaitable[T]],
    *args,
    max_retries: int = 3,
    base_delay: float = 1.0,
    transient_errors: Tuple[Type[Exception], ...] = DEFAULT_TRANSIENT_ERRORS,
    **kwargs,
) -> T:
    """Execute an async function with exponential backoff retry.

    Delays follow base_delay * 2^attempt pattern (1s, 2s, 4s for base=1).

    Args:
        fn: Async function to execute.
        *args: Positional arguments for fn.
        max_retries: Maximum number of retry attempts (default 3).
        base_delay: Base delay in seconds (default 1.0).
        transient_errors: Tuple of exception types to retry on.
        **kwargs: Keyword arguments for fn.

    Returns:
        Result of fn on success.

    Raises:
        The last exception if all retries are exhausted.
    """
    last_error: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            return await fn(*args, **kwargs)
        except transient_errors as e:
            last_error = e
            if attempt < max_retries:
                delay = base_delay * (2 ** attempt)
                logger.warning(
                    f"Retry {attempt + 1}/{max_retries} after error: {e}. "
                    f"Waiting {delay:.1f}s"
                )
                await asyncio.sleep(delay)
            else:
                logger.error(
                    f"All {max_retries} retries exhausted. Last error: {e}"
                )

    raise last_error  # type: ignore[misc]
