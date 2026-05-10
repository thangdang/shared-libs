"""Fallback chain logic for LLM providers.

Implements ordered fallback: Ollama → Groq → Template.
Attempts next provider when current fails and circuit breaker is open.
"""

import logging
from typing import AsyncIterator, List

from shared_llm_client.providers.base import BaseProvider, ProviderResponse

logger = logging.getLogger(__name__)


class FallbackChain:
    """Ordered fallback chain of LLM providers."""

    def __init__(self, providers: List[BaseProvider]):
        """Initialize fallback chain.

        Args:
            providers: Ordered list of providers to try.
                       Last provider should always succeed (e.g., template).
        """
        self._providers = providers

    @property
    def providers(self) -> List[BaseProvider]:
        """Get the ordered list of providers."""
        return self._providers

    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_mode: bool = False,
        skip_providers: List[str] | None = None,
    ) -> ProviderResponse:
        """Attempt generation through the fallback chain.

        Tries each provider in order. On failure, moves to next.
        Logs which provider served the response.

        Args:
            prompt: Input prompt.
            model: Model name.
            temperature: Sampling temperature.
            max_tokens: Max tokens.
            timeout: Request timeout.
            json_mode: Whether to request JSON output.
            skip_providers: Provider names to skip (e.g., when circuit is open).

        Returns:
            ProviderResponse from the first successful provider.
        """
        skip = set(skip_providers or [])
        last_error: Exception | None = None

        for provider in self._providers:
            if provider.name in skip:
                logger.debug(f"Skipping provider '{provider.name}' (in skip list)")
                continue

            try:
                response = await provider.generate(
                    prompt=prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    json_mode=json_mode,
                )
                logger.info(f"Response served by provider: {provider.name}")
                return response
            except Exception as e:
                last_error = e
                logger.warning(
                    f"Provider '{provider.name}' failed: {e}. "
                    f"Trying next in chain."
                )
                continue

        # Should not reach here if template provider is in chain
        # but handle gracefully
        logger.error("All providers in fallback chain failed")
        return ProviderResponse(
            content="All AI providers are currently unavailable.",
            provider="none",
            degraded=True,
            usage=None,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        skip_providers: List[str] | None = None,
    ) -> AsyncIterator[str]:
        """Attempt streaming through the fallback chain.

        Tries each provider in order for streaming.

        Yields:
            Tokens from the first successful provider.
        """
        skip = set(skip_providers or [])

        for provider in self._providers:
            if provider.name in skip:
                continue

            try:
                async for token in provider.stream(
                    prompt=prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                ):
                    yield token
                return  # Successfully streamed
            except Exception as e:
                logger.warning(
                    f"Stream from '{provider.name}' failed: {e}. "
                    f"Trying next."
                )
                continue

        # Fallback: yield error message
        yield "AI service temporarily unavailable."
