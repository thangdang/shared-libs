"""Property-based tests for shared-vn-nlp.

Uses hypothesis library with minimum 100 iterations per property.
Tests correctness properties defined in the design document.
"""

# Feature: shared-services, Properties 1-6

import pytest
from datetime import date, timedelta
from hypothesis import given, settings, assume
from hypothesis import strategies as st

from shared_vn_nlp.slang import normalize_slang, load_slang_dict
from shared_vn_nlp.provinces import detect_provinces, get_all_provinces
from shared_vn_nlp.calendar import get_events_in_range
from shared_vn_nlp.sentiment import analyze_sentiment


# --- Property 1: Slang normalization idempotence ---
# For any valid Vietnamese text string, applying slang normalization twice
# SHALL produce the same result as applying it once.

@settings(max_examples=200)
@given(st.text(min_size=0, max_size=200))
def test_property_1_slang_idempotence(text):
    """Property 1: normalize(normalize(text)) == normalize(text)"""
    once = normalize_slang(text)
    twice = normalize_slang(once)
    assert once == twice, (
        f"Idempotence violated: normalize('{text}') = '{once}', "
        f"normalize(normalize('{text}')) = '{twice}'"
    )


# --- Property 2: Slang normalization correctness with case-insensitivity ---
# For any text containing slang in any case, the normalizer SHALL replace
# all recognized slang regardless of case.

@settings(max_examples=100)
@given(st.sampled_from(["ko", "Ko", "KO", "kO"]))
def test_property_2_slang_case_insensitive(slang_variant):
    """Property 2: Case-insensitive slang matching."""
    text = f"Tôi {slang_variant} biết"
    result = normalize_slang(text)
    # The slang should be expanded regardless of case
    assert "không" in result, (
        f"Case-insensitive matching failed for '{slang_variant}': got '{result}'"
    )
    # Non-slang text "Tôi" should preserve its casing
    assert result.startswith("Tôi")


# --- Property 3: No-slang text identity ---
# For any text that contains no recognized slang keys,
# the normalizer SHALL return the exact original text unchanged.

@settings(max_examples=100)
@given(st.text(alphabet=st.characters(whitelist_categories=("Lu", "Ll", "Nd", "Zs")),
               min_size=1, max_size=100))
def test_property_3_no_slang_identity(text):
    """Property 3: Text without slang returns unchanged."""
    slang_dict = load_slang_dict()
    # Assume text doesn't contain any slang keys as whole words
    text_lower = text.lower()
    has_slang = any(
        key in text_lower for key in slang_dict.keys()
    )
    assume(not has_slang)

    result = normalize_slang(text)
    assert result == text, (
        f"No-slang identity violated: input='{text}', output='{result}'"
    )


# --- Property 4: Province detection with alternate names ---
# For any province and any of its alternate names, inserting that name
# into text SHALL result in the province being detected.

@settings(max_examples=200)
@given(st.data())
def test_property_4_province_alternate_detection(data):
    """Property 4: All province alternates are detected correctly."""
    provinces = get_all_provinces()
    province = data.draw(st.sampled_from(provinces))
    all_names = [province["name"]] + province.get("alternates", [])
    # Filter out very short names (1-2 chars) that might match within words
    valid_names = [n for n in all_names if len(n) > 2]
    assume(len(valid_names) > 0)

    name = data.draw(st.sampled_from(valid_names))
    text = f"Tôi đang ở {name} rất đẹp"

    results = detect_provinces(text)
    detected_names = [r.name for r in results]
    assert province["name"] in detected_names, (
        f"Province '{province['name']}' not detected via alternate '{name}' "
        f"in text '{text}'. Got: {detected_names}"
    )


# --- Property 5: Event date range containment ---
# For any date range [start, end], all events returned SHALL have
# their solar date falling within that range.

@settings(max_examples=100)
@given(
    st.dates(min_value=date(2024, 1, 1), max_value=date(2026, 12, 31)),
    st.integers(min_value=1, max_value=90),
)
def test_property_5_event_range_containment(start_date, range_days):
    """Property 5: All returned events fall within queried range."""
    end_date = start_date + timedelta(days=range_days)

    events = get_events_in_range(start_date, end_date)

    for event in events:
        assert start_date <= event.date_solar <= end_date, (
            f"Event '{event.name}' date {event.date_solar} is outside "
            f"range [{start_date}, {end_date}]"
        )


# --- Property 6: Sentiment output structure invariant ---
# For any non-empty text, the sentiment analyzer SHALL return
# label ∈ {positive, negative, neutral} and score ∈ [0.0, 1.0].

@settings(max_examples=100)
@given(st.text(min_size=1, max_size=200))
def test_property_6_sentiment_structure(text):
    """Property 6: Sentiment output has valid label and score range."""
    assume(text.strip())  # Skip whitespace-only

    result = analyze_sentiment(text)

    assert result.label in ("positive", "negative", "neutral"), (
        f"Invalid label '{result.label}' for text '{text[:50]}'"
    )
    assert 0.0 <= result.score <= 1.0, (
        f"Score {result.score} out of range [0.0, 1.0] for text '{text[:50]}'"
    )
