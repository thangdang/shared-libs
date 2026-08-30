"""Unified LLM client with retry, cache, circuit breaker, and fallback.

Integrates all shared-llm-client components into a single client interface.
"""

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import AsyncIterator, List, Optional

from winlux.llm.cache import LLMCache
from winlux.llm.circuit_breaker import CircuitBreaker, CircuitState
from winlux.llm.fallback import FallbackChain
from winlux.llm.model_router import ModelRouter, ModelSelection
from winlux.llm.prompt_guard import PromptGuard
from winlux.llm.sanitizer import PromptSanitizer
from winlux.llm.providers.groq import GroqProvider
from winlux.llm.providers.ollama import OllamaProvider
from winlux.llm.providers.template import TemplateProvider
from winlux.llm.streaming import stream_ollama

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
        product: str = "default",
        sanitization_enabled: bool = True,
        guard_enabled: bool = True,
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
            product: Product name (for routing, sanitization, audit).
            sanitization_enabled: Enable PII sanitization for external calls.
            guard_enabled: Enable prompt injection guard.
        """
        self._ollama_url = ollama_url
        self._product = product
        self._cache = LLMCache(redis_url, default_ttl=cache_ttl)
        self._circuit_breaker = CircuitBreaker(
            failure_threshold=circuit_failure_threshold,
            reset_timeout=circuit_reset_timeout,
        )

        # Security components
        self._sanitizer = PromptSanitizer(product=product) if sanitization_enabled else None
        self._guard = PromptGuard() if guard_enabled else None
        self._router = ModelRouter(product=product)

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
        task_type: str | None = None,
        user_input: str | None = None,
    ) -> "LLMResponse | AsyncIterator[str]":
        """Generate text. Returns LLMResponse or async iterator if stream=True.

        Args:
            prompt: Input prompt.
            model: Model name (default "qwen2.5:7b"). If task_type provided, auto-routed.
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            timeout: Request timeout (default 30s, use 120s for long gen).
            json_schema: If provided, request JSON output mode.
            stream: If True, return async iterator of SSE events.
            skip_cache: If True, bypass cache lookup.
            task_type: Optional task type for auto model routing.
            user_input: Original user input (checked for injection separately from prompt).

        Returns:
            LLMResponse for non-streaming, AsyncIterator[str] for streaming.
        """
        # === SECURITY: Check user input for injection ===
        if user_input and self._guard:
            guard_result = self._guard.check(user_input)
            if not guard_result["safe"]:
                logger.warning(
                    f"[{self._product}] Injection blocked: {guard_result['reason']}"
                )
                return LLMResponse(
                    content="Xin lỗi, tôi không thể xử lý yêu cầu này.",
                    provider="guard",
                    cached=False,
                    degraded=True,
                    usage=None,
                )

        # === ROUTING: Auto-select model based on task_type ===
        if task_type:
            selection = self._router.get_model(task_type, max_tokens)
            model = selection.model
            timeout = selection.timeout_seconds
            logger.debug(f"[{self._product}] Routed: {selection.reason}")

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

        # === SECURITY: Sanitize prompt before external providers ===
        sanitized_prompt = prompt
        if self._sanitizer:
            # Determine which provider will likely be used
            target_provider = "ollama" if self._circuit_breaker.can_execute() else "groq"
            result = self._sanitizer.sanitize(prompt, provider=target_provider)
            sanitized_prompt = result.clean_text
            if result.fields_redacted > 0:
                logger.info(
                    f"[{self._product}] Sanitized {result.fields_redacted} fields "
                    f"for {target_provider}"
                )

        # Determine which providers to skip based on circuit breaker
        skip_providers = []
        if not self._circuit_breaker.can_execute():
            skip_providers.append("ollama")

        # Generate with fallback chain + retry
        json_mode = json_schema is not None
        response = await self._generate_with_retry(
            sanitized_prompt, model, temperature, max_tokens, timeout, json_mode, skip_providers
        )

        # Cache successful non-degraded responses
        if not response.degraded and not skip_cache:
            await self._cache.set(model, prompt, params, response.content)

        # === T71: Log prompt variant for A/B testing ===
        if prompt_version:
            self._log_prompt_variant(
                prompt_version=prompt_version,
                task_type=task_type or "unknown",
                model=model,
                provider=response.provider,
                degraded=response.degraded,
                cached=response.cached,
                token_count=response.usage.get("total_tokens", 0) if response.usage else 0,
            )

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
            Dict with circuit_breaker, cache, providers, routing, and security status.
        """
        return {
            "product": self._product,
            "circuit_breaker": {
                "state": self._circuit_breaker.get_state().value,
                "failure_count": self._circuit_breaker.failure_count,
            },
            "cache": self._cache.get_stats(),
            "providers": [p.name for p in self._fallback.providers],
            "routing": {
                "enabled": True,
                "model_stats": self._router.get_model_stats(),
            },
            "security": {
                "sanitization_enabled": self._sanitizer is not None,
                "guard_enabled": self._guard is not None,
            },
        }

    def _log_prompt_variant(
        self,
        prompt_version: str,
        task_type: str,
        model: str,
        provider: str,
        degraded: bool,
        cached: bool,
        token_count: int,
    ) -> None:
        """Log prompt variant execution for A/B testing (T71 — REQ-5).

        Stores variant performance data so admin can compare which prompt
        versions produce better outcomes. Data stored in memory buffer and
        flushed to MongoDB via audit module.

        Args:
            prompt_version: Variant identifier (e.g., "v1", "v2_few_shot", "v3_concise")
            task_type: Task that was executed
            model: Model used for generation
            provider: Which provider served the response
            degraded: Whether response was degraded (fallback/template)
            cached: Whether response came from cache
            token_count: Total tokens used
        """
        import time

        entry = {
            "product": self._product,
            "prompt_version": prompt_version,
            "task_type": task_type,
            "model": model,
            "provider": provider,
            "degraded": degraded,
            "cached": cached,
            "token_count": token_count,
            "timestamp": time.time(),
        }

        # Append to internal buffer (flushed by audit module periodically)
        if not hasattr(self, '_prompt_variant_log'):
            self._prompt_variant_log: list = []
        self._prompt_variant_log.append(entry)

        # Keep buffer bounded (last 1000 entries)
        if len(self._prompt_variant_log) > 1000:
            self._prompt_variant_log = self._prompt_variant_log[-500:]

        logger.debug(
            f"[{self._product}] Prompt variant logged: "
            f"version={prompt_version}, task={task_type}, model={model}"
        )

    def get_prompt_variant_stats(self, prompt_version: str | None = None) -> dict:
        """Get aggregated stats for prompt variants (for backoffice display).

        Args:
            prompt_version: Filter by specific version, or None for all.

        Returns:
            Dict with per-version stats: count, avg_tokens, degraded_rate, providers used.
        """
        log = getattr(self, '_prompt_variant_log', [])
        if prompt_version:
            log = [e for e in log if e["prompt_version"] == prompt_version]

        if not log:
            return {"variants": [], "total_logged": 0}

        # Group by version
        from collections import defaultdict
        by_version: dict = defaultdict(list)
        for entry in log:
            by_version[entry["prompt_version"]].append(entry)

        variants = []
        for version, entries in by_version.items():
            total = len(entries)
            degraded = sum(1 for e in entries if e["degraded"])
            cached = sum(1 for e in entries if e["cached"])
            tokens = [e["token_count"] for e in entries if e["token_count"] > 0]

            variants.append({
                "version": version,
                "count": total,
                "degraded_rate": round(degraded / total, 3) if total > 0 else 0,
                "cache_hit_rate": round(cached / total, 3) if total > 0 else 0,
                "avg_tokens": round(sum(tokens) / len(tokens)) if tokens else 0,
                "providers": list(set(e["provider"] for e in entries)),
            })

        variants.sort(key=lambda v: v["count"], reverse=True)

        return {"variants": variants, "total_logged": len(log)}
