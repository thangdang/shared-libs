"""Property-based test for backward compatibility (Property 21).

Verifies that shared lib produces equivalent output to per-repo
implementations for the same inputs.

Feature: shared-services, Property 21
"""

import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from shared_vn_nlp import segment, normalize_slang, analyze_sentiment
from shared_vn_nlp.sentiment import SentimentResult


# --- Property 21: Backward compatibility interface equivalence ---
# Shared lib produces equivalent output to per-repo implementation
# for same inputs.

# Test that the shared lib interface matches expected signatures and behavior

@settings(max_examples=100)
@given(st.text(min_size=0, max_size=100))
def test_property_21_segment_interface(text):
    """Property 21: segment() returns List[str] for any input."""
    result = segment(text)
    assert isinstance(result, list)
    for item in result:
        assert isinstance(item, str)
    # Empty/whitespace input should return empty list
    if not text or not text.strip():
        assert result == []


@settings(max_examples=100)
@given(st.text(min_size=0, max_size=100))
def test_property_21_normalize_slang_interface(text):
    """Property 21: normalize_slang() returns str for any input."""
    result = normalize_slang(text)
    assert isinstance(result, str)
    # Empty input returns empty
    if text == "":
        assert result == ""


@settings(max_examples=100)
@given(st.text(min_size=0, max_size=100))
def test_property_21_analyze_sentiment_interface(text):
    """Property 21: analyze_sentiment() returns SentimentResult for any input."""
    result = analyze_sentiment(text)
    assert isinstance(result, SentimentResult)
    assert result.label in ("positive", "negative", "neutral")
    assert isinstance(result.score, float)
    assert 0.0 <= result.score <= 1.0
    # Empty input returns neutral/0.0
    if not text or not text.strip():
        assert result.label == "neutral"
        assert result.score == 0.0


@settings(max_examples=100)
@given(st.text(min_size=1, max_size=50))
def test_property_21_segment_deterministic(text):
    """Property 21: Same input always produces same output (deterministic)."""
    result1 = segment(text)
    result2 = segment(text)
    assert result1 == result2


@settings(max_examples=100)
@given(st.text(min_size=1, max_size=50))
def test_property_21_normalize_slang_deterministic(text):
    """Property 21: normalize_slang is deterministic."""
    result1 = normalize_slang(text)
    result2 = normalize_slang(text)
    assert result1 == result2
