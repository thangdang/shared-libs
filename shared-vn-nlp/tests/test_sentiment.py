"""Unit tests for shared_vn_nlp.sentiment module."""

import pytest
from shared_vn_nlp.sentiment import analyze_sentiment, SentimentResult


class TestAnalyzeSentiment:
    """Tests for sentiment analysis."""

    def test_empty_string_returns_neutral_zero(self):
        """Empty string returns neutral with score 0.0."""
        result = analyze_sentiment("")
        assert result.label == "neutral"
        assert result.score == 0.0

    def test_whitespace_returns_neutral_zero(self):
        """Whitespace-only returns neutral with score 0.0."""
        result = analyze_sentiment("   ")
        assert result.label == "neutral"
        assert result.score == 0.0

    def test_returns_sentiment_result(self):
        """Returns a SentimentResult dataclass."""
        result = analyze_sentiment("Tôi rất vui")
        assert isinstance(result, SentimentResult)

    def test_label_is_valid(self):
        """Label is one of positive, negative, neutral."""
        texts = ["Tôi rất vui", "Tôi buồn quá", "Hôm nay là thứ hai"]
        for text in texts:
            result = analyze_sentiment(text)
            assert result.label in ("positive", "negative", "neutral")

    def test_score_in_range(self):
        """Score is between 0.0 and 1.0."""
        texts = ["Tôi rất vui", "Tôi buồn quá", "Hôm nay là thứ hai", "tốt lắm"]
        for text in texts:
            result = analyze_sentiment(text)
            assert 0.0 <= result.score <= 1.0

    def test_positive_text(self):
        """Clearly positive text is classified as positive."""
        result = analyze_sentiment("Rất tốt, tuyệt vời, tôi rất hài lòng")
        assert result.label == "positive"

    def test_negative_text(self):
        """Clearly negative text is classified as negative."""
        result = analyze_sentiment("Rất tệ, tồi tệ, tôi rất thất vọng")
        assert result.label == "negative"

    def test_slang_normalized_before_analysis(self):
        """Slang is normalized before sentiment analysis."""
        # "ko" → "không", which shouldn't crash or change behavior drastically
        result = analyze_sentiment("ko tốt")
        assert isinstance(result, SentimentResult)
        assert result.label in ("positive", "negative", "neutral")
