"""Base provider abstract class for LLM providers."""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import AsyncIterator, Optional


@dataclass
class ProviderResponse:
    """Response from an LLM provider."""

    content: str
    provider: str
    degraded: bool = False
    usage: Optional[dict] = None


class BaseProvider(ABC):
    """Abstract base class for LLM providers."""

    @property
    @abstractmethod
    def name(self) -> str:
        """Provider name identifier."""
        ...

    @abstractmethod
    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_mode: bool = False,
    ) -> ProviderResponse:
        """Generate text from the provider.

        Args:
            prompt: Input prompt.
            model: Model name/identifier.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            timeout: Request timeout in seconds.
            json_mode: Whether to request JSON output.

        Returns:
            ProviderResponse with generated content.

        Raises:
            Exception on failure (triggers fallback).
        """
        ...

    @abstractmethod
    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
    ) -> AsyncIterator[str]:
        """Stream tokens from the provider.

        Args:
            prompt: Input prompt.
            model: Model name/identifier.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            timeout: Request timeout in seconds.

        Yields:
            Individual tokens as strings.
        """
        ...

    @abstractmethod
    async def is_available(self) -> bool:
        """Check if the provider is currently available.

        Returns:
            True if provider can accept requests.
        """
        ...
