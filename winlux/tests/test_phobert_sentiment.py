"""
Unit tests for PhoBERT Sentiment Analysis Service.
"""

import pytest

from winlux.nlp.phobert_sentiment import (
    Emotion,
    PhoBERTSentimentAnalyzer,
    SentimentLabel,
    analyze_sentiment,
    analyze_sentiment_batch,
    detect_emotion,
    extract_aspects,
    full_analysis,
    get_sentiment_simple,
)


class TestSentimentLabel:
    """Tests for SentimentLabel enum."""

    def test_sentiment_labels_exist(self):
        """Verify all sentiment labels are defined."""
        assert SentimentLabel.VERY_NEGATIVE.value == "very_negative"
        assert SentimentLabel.NEGATIVE.value == "negative"
        assert SentimentLabel.NEUTRAL.value == "neutral"
        assert SentimentLabel.POSITIVE.value == "positive"
        assert SentimentLabel.VERY_POSITIVE.value == "very_positive"


class TestEmotion:
    """Tests for Emotion enum."""

    def test_emotion_labels_exist(self):
        """Verify all emotion labels are defined."""
        assert Emotion.JOY.value == "joy"
        assert Emotion.SADNESS.value == "sadness"
        assert Emotion.ANGER.value == "anger"
        assert Emotion.FEAR.value == "fear"
        assert Emotion.SURPRISE.value == "surprise"
        assert Emotion.DISGUST.value == "disgust"
        assert Emotion.TRUST.value == "trust"
        assert Emotion.ANTICIPATION.value == "anticipation"


class TestPhoBERTSentimentAnalyzer:
    """Tests for PhoBERTSentimentAnalyzer class."""

    @pytest.fixture
    def analyzer(self):
        """Create analyzer instance."""
        return PhoBERTSentimentAnalyzer()

    def test_preprocess_text_normalizes_whitespace(self, analyzer):
        """Preprocessing normalizes whitespace."""
        result = analyzer._preprocess_text("  hello   world  ")
        assert "  " not in result
        assert result == "hello world"

    def test_preprocess_text_expands_abbreviations(self, analyzer):
        """Preprocessing expands Vietnamese abbreviations."""
        result = analyzer._preprocess_text("sản phẩm k tốt")
        assert "không" in result

        result = analyzer._preprocess_text("hàng dc lắm")
        assert "được" in result

    def test_analyze_empty_text_returns_neutral(self, analyzer):
        """Empty text returns neutral sentiment."""
        result = analyzer.analyze("")
        assert result.label == SentimentLabel.NEUTRAL
        assert result.confidence == 0.0

        result = analyzer.analyze("   ")
        assert result.label == SentimentLabel.NEUTRAL

    def test_analyze_positive_text(self, analyzer):
        """Positive text detected correctly."""
        result = analyzer.analyze("Sản phẩm rất tốt, tôi rất hài lòng!")
        assert result.label in (SentimentLabel.POSITIVE, SentimentLabel.VERY_POSITIVE)
        assert result.confidence > 0.5
        assert result.label_simple == "positive"

    def test_analyze_negative_text(self, analyzer):
        """Negative text detected correctly."""
        result = analyzer.analyze("Sản phẩm tệ quá, thất vọng!")
        assert result.label in (SentimentLabel.NEGATIVE, SentimentLabel.VERY_NEGATIVE)
        assert result.confidence > 0.5
        assert result.label_simple == "negative"

    def test_analyze_very_positive_text(self, analyzer):
        """Very positive text detected correctly."""
        result = analyzer.analyze("Tuyệt vời! Xuất sắc! Hoàn hảo!")
        assert result.label == SentimentLabel.VERY_POSITIVE
        assert result.label_vi == "Rất tích cực"

    def test_analyze_very_negative_text(self, analyzer):
        """Very negative text detected correctly."""
        result = analyzer.analyze("Quá tệ! Thảm họa! Lừa đảo!")
        assert result.label == SentimentLabel.VERY_NEGATIVE
        assert result.label_vi == "Rất tiêu cực"

    def test_analyze_neutral_text(self, analyzer):
        """Neutral text detected correctly."""
        result = analyzer.analyze("Bình thường, tạm được")
        assert result.label == SentimentLabel.NEUTRAL
        assert result.label_simple == "neutral"

    def test_analyze_uses_cache(self, analyzer):
        """Caching works correctly."""
        text = "Sản phẩm tốt"

        # First call
        result1 = analyzer.analyze(text, use_cache=True)

        # Second call should use cache
        result2 = analyzer.analyze(text, use_cache=True)

        assert result1.label == result2.label
        assert result1.confidence == result2.confidence

    def test_analyze_cache_bypass(self, analyzer):
        """Cache can be bypassed."""
        text = "Sản phẩm tốt"

        result1 = analyzer.analyze(text, use_cache=False)
        result2 = analyzer.analyze(text, use_cache=False)

        # Results should still be consistent
        assert result1.label == result2.label

    def test_detect_emotion_joy(self, analyzer):
        """Joy emotion detected correctly."""
        result = analyzer.detect_emotion("Vui quá! Hạnh phúc ghê!")
        assert result.primary_emotion == Emotion.JOY
        assert result.confidence > 0.3

    def test_detect_emotion_sadness(self, analyzer):
        """Sadness emotion detected correctly."""
        result = analyzer.detect_emotion("Buồn quá, đau lòng")
        assert result.primary_emotion == Emotion.SADNESS

    def test_detect_emotion_anger(self, analyzer):
        """Anger emotion detected correctly."""
        result = analyzer.detect_emotion("Tức giận quá! Điên rồi!")
        assert result.primary_emotion == Emotion.ANGER

    def test_detect_emotion_empty_returns_trust(self, analyzer):
        """Empty text returns default trust emotion."""
        result = analyzer.detect_emotion("")
        assert result.primary_emotion == Emotion.TRUST
        assert result.confidence == 0.0

    def test_extract_aspect_sentiments_product(self, analyzer):
        """Product aspect sentiment extracted."""
        result = analyzer.extract_aspect_sentiments("Sản phẩm rất tốt, chất lượng cao")
        assert len(result) > 0
        aspects = [a.aspect for a in result]
        assert "product" in aspects or "quality" in aspects

    def test_extract_aspect_sentiments_price(self, analyzer):
        """Price aspect sentiment extracted."""
        result = analyzer.extract_aspect_sentiments("Giá hơi đắt nhưng chấp nhận được")
        assert len(result) > 0
        aspects = [a.aspect for a in result]
        assert "price" in aspects

    def test_extract_aspect_sentiments_delivery(self, analyzer):
        """Delivery aspect sentiment extracted."""
        result = analyzer.extract_aspect_sentiments("Giao hàng nhanh, đóng gói cẩn thận")
        assert len(result) > 0
        aspects = [a.aspect for a in result]
        assert "delivery" in aspects or "packaging" in aspects

    def test_extract_aspect_sentiments_empty(self, analyzer):
        """Empty text returns no aspects."""
        result = analyzer.extract_aspect_sentiments("")
        assert result == []

    def test_full_analysis_returns_all_fields(self, analyzer):
        """Full analysis returns complete result."""
        result = analyzer.full_analysis("Sản phẩm tốt, giao hàng nhanh, vui lắm!")

        assert result.text == "Sản phẩm tốt, giao hàng nhanh, vui lắm!"
        assert result.sentiment is not None
        assert result.emotions is not None
        assert isinstance(result.aspects, list)
        assert result.processing_time_ms > 0
        assert result.model_used in ("phobert", "fallback")

    def test_analyze_batch_processes_multiple(self, analyzer):
        """Batch analysis processes multiple texts."""
        texts = [
            "Sản phẩm tốt",
            "Hàng tệ quá",
            "Bình thường thôi",
        ]

        results = analyzer.analyze_batch(texts)

        assert len(results) == 3
        assert results[0].label_simple == "positive"
        assert results[1].label_simple == "negative"
        assert results[2].label_simple == "neutral"


class TestModuleFunctions:
    """Tests for module-level convenience functions."""

    def test_analyze_sentiment_function(self):
        """analyze_sentiment function works."""
        result = analyze_sentiment("Tốt lắm!")
        assert result.label_simple == "positive"

    def test_analyze_sentiment_batch_function(self):
        """analyze_sentiment_batch function works."""
        results = analyze_sentiment_batch(["Tốt", "Tệ"])
        assert len(results) == 2

    def test_detect_emotion_function(self):
        """detect_emotion function works."""
        result = detect_emotion("Vui quá!")
        assert result.primary_emotion == Emotion.JOY

    def test_extract_aspects_function(self):
        """extract_aspects function works."""
        result = extract_aspects("Giá rẻ, chất lượng tốt")
        assert isinstance(result, list)

    def test_full_analysis_function(self):
        """full_analysis function works."""
        result = full_analysis("Hàng đẹp!")
        assert result.sentiment is not None

    def test_get_sentiment_simple_function(self):
        """get_sentiment_simple returns tuple."""
        label, confidence = get_sentiment_simple("Rất tốt!")
        assert label in ("positive", "negative", "neutral")
        assert 0.0 <= confidence <= 1.0


class TestVietnameseSlang:
    """Tests for Vietnamese slang handling."""

    def test_slang_k_becomes_khong(self):
        """'k' abbreviation handled."""
        result = analyze_sentiment("Hàng k tốt")
        assert result.label_simple == "negative"

    def test_slang_dc_becomes_duoc(self):
        """'dc' abbreviation handled."""
        result = analyze_sentiment("Hàng dc lắm")
        assert result.label_simple == "positive"

    def test_mixed_language_handled(self):
        """Mixed Vietnamese/English handled."""
        result = analyze_sentiment("Sản phẩm good, perfect!")
        assert result.label_simple == "positive"
