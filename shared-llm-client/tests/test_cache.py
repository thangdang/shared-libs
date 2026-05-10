"""Unit tests for shared_llm_client.cache module."""

import pytest
from shared_llm_client.cache import LLMCache


class TestCacheKeyComputation:
    """Tests for cache key computation."""

    def setup_method(self):
        self.cache = LLMCache("redis://localhost:6379")

    def test_same_inputs_same_key(self):
        """Same model/prompt/params produce same key."""
        k1 = self.cache.compute_key("model", "prompt", {"temp": 0.7})
        k2 = self.cache.compute_key("model", "prompt", {"temp": 0.7})
        assert k1 == k2

    def test_different_prompt_different_key(self):
        """Different prompts produce different keys."""
        k1 = self.cache.compute_key("model", "prompt1", {"temp": 0.7})
        k2 = self.cache.compute_key("model", "prompt2", {"temp": 0.7})
        assert k1 != k2

    def test_different_model_different_key(self):
        """Different models produce different keys."""
        k1 = self.cache.compute_key("model1", "prompt", {"temp": 0.7})
        k2 = self.cache.compute_key("model2", "prompt", {"temp": 0.7})
        assert k1 != k2

    def test_different_params_different_key(self):
        """Different params produce different keys."""
        k1 = self.cache.compute_key("model", "prompt", {"temp": 0.7})
        k2 = self.cache.compute_key("model", "prompt", {"temp": 0.9})
        assert k1 != k2

    def test_param_order_independent(self):
        """Parameter order doesn't affect key (sorted internally)."""
        k1 = self.cache.compute_key("m", "p", {"a": 1, "b": 2})
        k2 = self.cache.compute_key("m", "p", {"b": 2, "a": 1})
        assert k1 == k2

    def test_key_format(self):
        """Key has expected prefix format."""
        key = self.cache.compute_key("model", "prompt", {})
        assert key.startswith("llm_cache:")
        # SHA-256 hex = 64 chars
        assert len(key.split(":")[1]) == 64


class TestCacheStats:
    """Tests for cache statistics."""

    def test_initial_stats(self):
        """Initial stats are all zeros."""
        cache = LLMCache("redis://localhost:6379")
        stats = cache.get_stats()
        assert stats["hits"] == 0
        assert stats["misses"] == 0
        assert stats["hit_rate"] == 0.0
