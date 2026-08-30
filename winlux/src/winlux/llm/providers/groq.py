"""Groq provider — Groq free tier API client."""

import logging
import os
from typing import AsyncIterator

import httpx

from winlux.llm.providers.base import BaseProvider, ProviderResponse

logger = logging.getLogger(__name__)

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(BaseProvider):
    """Groq free tier LLM provider."""

    def __init__(self, api_key: str | None = None):
        """Initialize Groq provider.

        Args:
            api_key: Groq API key. Falls back to GROQ_API_KEY env var.
        """
        self._api_key = api_key or os.environ.get("GROQ_API_KEY", "")

    @property
    def name(self) -> str:
        return "groq"

    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_mode: bool = False,
    ) -> ProviderResponse:
        """Generate text using Groq API.

        Uses OpenAI-compatible chat completions endpoint.
        """
        if not self._api_key:
            raise RuntimeError("Groq API key not configured")

        # Map Ollama model names to Groq equivalents
        groq_model = self._map_model(model)

        payload = {
            "model": groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
        }

        if json_mode:
            payload["response_format"] = {"type": "json_object"}

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            response = await client.post(
                GROQ_API_URL, json=payload, headers=headers
            )
            response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"]
        usage = data.get("usage", {})

        return ProviderResponse(
            content=content,
            provider=self.name,
            degraded=False,
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
            },
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
    ) -> AsyncIterator[str]:
        """Stream tokens from Groq API."""
        if not self._api_key:
            raise RuntimeError("Groq API key not configured")

        groq_model = self._map_model(model)
        payload = {
            "model": groq_model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }

        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=timeout) as client:
            async with client.stream(
                "POST", GROQ_API_URL, json=payload, headers=headers
            ) as response:
                response.raise_for_status()
                async for line in response.aiter_lines():
                    if line.startswith("data: "):
                        data_str = line[6:]
                        if data_str == "[DONE]":
                            break
                        import json
                        data = json.loads(data_str)
                        delta = data["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content

    async def is_available(self) -> bool:
        """Check if Groq API key is configured."""
        return bool(self._api_key)

    def _map_model(self, model: str) -> str:
        """Map Ollama model names to Groq model names."""
        model_map = {
            "qwen2.5:7b": "mixtral-8x7b-32768",
            "llama3": "llama3-8b-8192",
            "llama3:8b": "llama3-8b-8192",
            "llama3:70b": "llama3-70b-8192",
            "gemma2": "gemma2-9b-it",
        }
        return model_map.get(model, "mixtral-8x7b-32768")
