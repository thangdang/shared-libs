"""Unit tests for shared_llm_client.client module."""

import pytest
from shared_llm_client.client import LLMClient, LLMResponse


class TestLLMClientInit:
    """Tests for LLMClient initialization."""

    def test_default_initialization(self):
        """Client initializes with default parameters."""
        client = LLMClient()
        status = client.get_status()
        assert status["circuit_breaker"]["state"] == "closed"
        assert status["circuit_breaker"]["failure_count"] == 0
        assert "ollama" in status["providers"]
        assert "template" in status["providers"]

    def test_custom_fallback_chain(self):
        """Client respects custom fallback chain order."""
        client = LLMClient(fallback_chain=["ollama", "template"])
        status = client.get_status()
        assert status["providers"] == ["ollama", "template"]

    def test_get_status_structure(self):
        """get_status returns expected structure."""
        client = LLMClient()
        status = client.get_status()
        assert "circuit_breaker" in status
        assert "cache" in status
        assert "providers" in status
        assert "state" in status["circuit_breaker"]
        assert "hits" in status["cache"]


class TestLLMResponse:
    """Tests for LLMResponse dataclass."""

    def test_create_response(self):
        """LLMResponse can be created with all fields."""
        resp = LLMResponse(
            content="Hello",
            provider="ollama",
            cached=False,
            degraded=False,
            usage={"prompt_tokens": 10, "completion_tokens": 5},
        )
        assert resp.content == "Hello"
        assert resp.provider == "ollama"
        assert resp.cached is False
        assert resp.degraded is False
        assert resp.usage["prompt_tokens"] == 10

    def test_cached_response(self):
        """LLMResponse can represent a cached response."""
        resp = LLMResponse(
            content="Cached content",
            provider="cache",
            cached=True,
            degraded=False,
            usage=None,
        )
        assert resp.cached is True
        assert resp.usage is None

    def test_degraded_response(self):
        """LLMResponse can represent a degraded template response."""
        resp = LLMResponse(
            content="Service unavailable",
            provider="template",
            cached=False,
            degraded=True,
            usage=None,
        )
        assert resp.degraded is True
        assert resp.provider == "template"
