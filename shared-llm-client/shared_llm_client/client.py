"""Unified LLM client with retry, cache, circuit breaker, and fallback.

Integrates all shared-llm-client components into a single client interface.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator, List, Optional

from shared_llm_client.cache import LLMCache
from shared_llm_client.circuit_breaker import CircuitBreaker, CircuitState
from shared_llm_client.fallback import FallbackChain
from shared_llm_client.providers.groq import GroqProvider
from shared_llm_client.providers.ollama import OllamaProvider
from shared_llm_client.providers.template import TemplateProvider
from shared_llm_client.streaming import stream_ollama

logger = logging.getLogger(__name__)


@dataclass
class LLMResponse:
    """Response from the unified LLM client."""

    content: str
    provider: str           # which provider served this
    cached: bool            # served from cache?
    degraded: bool          # template fallback?
    usage: Optional[dict]   # token counts if available


class LLMClient:
    """Unified LLM client with retry, cache, circuit breaker, fallback.

    Provides a single interface for all AI engines to interact with LLMs.
    """

    def __init__(
        self,
        ollama_url: str = "http://localhost:11434",
        redis_url: str = "redis://localhost:6379",
        fallback_chain: List[str] | None = None,
        cache_ttl: int = 86400,
        circuit_failure_threshold: int = 5,
        circuit_reset_timeout: int = 30,
        groq_api_key: str | None = None,
    ):
        """Initialize unified LLM client.

        Args:
            ollama_url: Ollama API URL (default localhost:11434).
            redis_url: Redis URL for caching.
            fallback_chain: Provider order (default ["ollama", "groq", "template"]).
            cache_ttl: Cache TTL in seconds (default 24h).
            circuit_failure_threshold: Failures before circuit opens.
            circuit_reset_timeout: Seconds before probe attempt.
            groq_api_key: Optional Groq API key.
        """
        self._ollama_url = ollama_url
        self._cache = LLMCache(redis_url, default_ttl=cache_ttl)
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=circuit_failure_threshold,
            reset_timeout=circuit_reset_timeout,
        )

        # Build provider instances
        self._ollama = OllamaProvider(ollama_url)
        self._groq = GroqProvider(api_key=groq_api_key)
        self._template = TemplateProvider()

        # Build fallback chain
        chain_order = fallback_chain or ["ollama", "groq", "template"]
        providers = []
        provider_map = {
            "ollama": self._ollama,
            "groq": self._groq,
            "template": self._template,
        }
        for name in chain_order:
            if name in provider_map:
                providers.append(provider_map[name])
        self._fallback = FallbackChain(providers)

    async def generate(
        self,
        prompt: str,
        model: str = "qwen2.5:7b",
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_schema: dict | None = None,
        stream: bool = False,
        skip_cache: bool = False,
    ) -> "LLMResponse | AsyncIterator[str]":
        """Generate text. Returns LLMResponse or async iterator if stream=True.

        Args:
            prompt: Input prompt.
            model: Model name (default "qwen2.5:7b").
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            timeout: Request timeout (default 30s, use 120s for long gen).
            json_schema: If provided, request JSON output mode.
            stream: If True, return async iterator of SSE events.
            skip_cache: If True, bypass cache lookup.

        Returns:
            LLMResponse for non-streaming, AsyncIterator[str] for streaming.
        """
        if stream:
            return self._stream(prompt, model, temperature, max_tokens, timeout)

        # Check cache first
        params = {"temperature": temperature, "max_tokens": max_tokens}
        if not skip_cache:
            cached = await self._cache.get(model, prompt, params)
            if cached is not None:
                return LLMResponse(
                    content=cached,
                    provider="cache",
                    cached=True,
                    degraded=False,
                    usage=None,
                )

        # Determine which providers to skip based on circuit breaker
        skip_providers = []
        if not self._circuit_breaker.can_execute():
            skip_providers.append("ollama")

        # Generate with fallback chain + retry
        json_mode = json_schema is not None
        response = await self._generate_with_retry(
            prompt, model, temperature, max_tokens, timeout, json_mode, skip_providers
        )

        # Cache successful non-degraded responses
        if not response.degraded and not skip_cache:
            await self._cache.set(model, prompt, params, response.content)

        return response

    async def _generate_with_retry(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: float,
        json_mode: bool,
        skip_providers: List[str],
    ) -> LLMResponse:
        """Generate with retry logic (up to 3 attempts)."""
        last_error: Exception | None = None

        for attempt in range(3):
            try:
                provider_response = await self._fallback.generate(
                    prompt=prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                    timeout=timeout,
                    json_mode=json_mode,
                    skip_providers=skip_providers,
                )

                # Record circuit breaker result
                if provider_response.provider == "ollama":
                    self._circuit_breaker.record_success()
                elif provider_response.provider in ("groq", "template"):
                    # Ollama was skipped or failed
                    if "ollama" not in skip_providers:
                        self._circuit_breaker.record_failure()

                return LLMResponse(
                    content=provider_response.content,
                    provider=provider_response.provider,
                    cached=False,
                    degraded=provider_response.degraded,
                    usage=provider_response.usage,
                )

            except Exception as e:
                last_error = e
                if attempt < 2:
                    delay = 1.0 * (2 ** attempt)
                    logger.warning(
                        f"Generate attempt {attempt + 1} failed: {e}. "
                        f"Retrying in {delay}s"
                    )
                    await asyncio.sleep(delay)

        # All retries failed — use template
        self._circuit_breaker.record_failure()
        return LLMResponse(
            content="AI service temporarily unavailable.",
            provider="template",
            cached=False,
            degraded=True,
            usage=None,
        )

    async def _stream(
        self,
        prompt: str,
        model: str,
        temperature: float,
        max_tokens: int,
        timeout: float,
    ) -> AsyncIterator[str]:
        """Stream tokens as SSE events."""
        if self._circuit_breaker.can_execute():
            try:
                async for event in stream_ollama(
                    url=self._ollama_url,
                    model=model,
                    prompt=prompt,
                    options={"temperature": temperature, "num_predict": max_tokens},
                ):
                    yield event
                self._circuit_breaker.record_success()
                return
            except Exception as e:
                self._circuit_breaker.record_failure()
                logger.warning(f"Ollama stream failed: {e}, trying fallback")

        # Fallback streaming
        async for token in self._fallback.stream(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens,
            timeout=timeout,
            skip_providers=["ollama"],
        ):
            yield token

    async def generate_json(
        self,
        prompt: str,
        schema: dict,
        model: str = "qwen2.5:7b",
        max_retries: int = 2,
    ) -> dict:
        """Generate structured JSON output with retry on parse failure.

        Args:
            prompt: Input prompt.
            schema: Expected JSON schema (for validation context).
            model: Model name.
            max_retries: Additional retries on JSON parse failure.

        Returns:
            Parsed JSON dict.

        Raises:
            ValueError: If all attempts produce invalid JSON.
        """
        json_prompt = (
            f"{prompt}\n\nRespond with valid JSON matching this schema: "
            f"{json.dumps(schema, indent=2)}"
        )

        for attempt in range(max_retries + 1):
            response = await self.generate(
                prompt=json_prompt,
                model=model,
                json_schema=schema,
                skip_cache=True,
            )

            try:
                parsed = json.loads(response.content)
                return parsed
            except json.JSONDecodeError as e:
                if attempt < max_retries:
                    logger.warning(
                        f"JSON parse failed (attempt {attempt + 1}): {e}. Retrying."
                    )
                else:
                    raise ValueError(
                        f"Failed to get valid JSON after {max_retries + 1} attempts. "
                        f"Raw response: {response.content[:200]}"
                    )

        # Should not reach here
        raise ValueError("generate_json failed unexpectedly")

    def get_status(self) -> dict:
        """Return client status: circuit state, cache stats, provider availability.

        Returns:
            Dict with circuit_breaker, cache, and providers status.
        """
        return {
            "circuit_breaker": {
                "state": self._circuit_breaker.get_state().value,
                "failure_count": self._circuit_breaker.failure_count,
            },
            "cache": self._cache.get_stats(),
            "providers": [p.name for p in self._fallback.providers],
        }
