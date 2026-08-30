"""Ollama provider — HTTP calls to local Ollama instance."""

import json
import logging
from typing import AsyncIterator

import httpx

from winlux.llm.providers.base import BaseProvider, ProviderResponse

logger = logging.getLogger(__name__)


class OllamaProvider(BaseProvider):
    """Ollama LLM provider via HTTP API on localhost:11434."""

    def __init__(self, base_url: str = "http://localhost:11434"):
        """Initialize Ollama provider.

        Args:
            base_url: Ollama API base URL (default localhost:11434).
        """
        self._base_url = base_url.rstrip("/")

    @property
    def name(self) -> str:
        return "ollama"

    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_mode: bool = False,
    ) -> ProviderResponse:
        """Generate text using Ollama API.

        Args:
            prompt: Input prompt.
            model: Ollama model name (e.g., "qwen2.5:7b").
            temperature: Sampling temperature.
            max_tokens: Maximum tokens to generate.
            timeout: Request timeout in seconds.
            json_mode: Whether to request JSON output format.

        Returns:
            ProviderResponse with generated content.
        """
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        if json_mode:
            payload["format"] = "json"

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                f"{self._base_url}/api/generate", json=payload
            )
            response.raise_for_status()

        data = response.json()
        content = data.get("response", "")
        usage = {
            "prompt_tokens": data.get("prompt_eval_count", 0),
            "completion_tokens": data.get("eval_count", 0),
            "total_duration_ms": data.get("total_duration", 0) / 1_000_000,
        }

        return ProviderResponse(
            content=content,
            provider=self.name,
            degraded=False,
            usage=usage,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
    ) -> AsyncIterator[str]:
        """Stream tokens from Ollama.

        Yields individual tokens as they are generated.
        """
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": True,
            "options": {
                "temperature": temperature,
                "num_predict": max_tokens,
            },
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", f"{self._base_url}/api/generate", json=payload
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line:
                        data = json.loads(line)
                        token = data.get("response", "")
                        if token:
                            yield token
                        if data.get("done", False):
                            break

    async def is_available(self) -> bool:
        """Check if Ollama is running."""
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                response = await client.get(f"{self._base_url}/api/tags")
                return response.status_code == 200
        except Exception:
            return False
