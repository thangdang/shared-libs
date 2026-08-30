"""Vietnamese sentiment analysis.

Provides sentiment classification for Vietnamese text using underthesea.
Applies slang normalization before analysis for better accuracy.
"""

from dataclasses import dataclass

from winlux.nlp.slang import normalize_slang

try:
    from underthesea import sentiment as _underthesea_sentiment
    _HAS_SENTIMENT = True
except ImportError:
    _HAS_SENTIMENT = False


@dataclass
class SentimentResult:
    """Result of sentiment analysis."""

    label: str      # "positive", "negative", "neutral"
    score: float    # 0.0 to 1.0 confidence


# Keywords for fallback sentiment analysis when underthesea sentiment is unavailable
_POSITIVE_KEYWORDS = [
    "tốt", "hay", "đẹp", "thích", "yêu", "vui", "tuyệt", "xuất sắc",
    "giỏi", "ngon", "thú vị", "hạnh phúc", "tuyệt vời", "ổn", "ok",
    "được", "dễ thương", "đáng yêu", "hài lòng", "cảm ơn", "tốt lắm",
    "rất tốt", "rất hay", "rất đẹp", "siêu", "perfect", "great", "good",
]

_NEGATIVE_KEYWORDS = [
    "xấu", "tệ", "ghét", "buồn", "chán", "dở", "kém", "tồi",
    "khó chịu", "thất vọng", "tức", "giận", "đau", "sợ", "lo",
    "khổ", "mệt", "bực", "phiền", "tệ hại", "kinh khủng", "tồi tệ",
    "rất tệ", "rất xấu", "bad", "terrible", "awful", "hate",
]


def _fallback_sentiment(text: str) -> SentimentResult:
    """Keyword-based fallback sentiment when underthesea sentiment is unavailable."""
    text_lower = text.lower()

    pos_count = sum(1 for kw in _POSITIVE_KEYWORDS if kw in text_lower)
    neg_count = sum(1 for kw in _NEGATIVE_KEYWORDS if kw in text_lower)

    total = pos_count + neg_count
    if total == 0:
        return SentimentResult(label="neutral", score=0.5)

    if pos_count > neg_count:
        score = min(pos_count / total, 1.0)
        return SentimentResult(label="positive", score=score)
    elif neg_count > pos_count:
        score = min(neg_count / total, 1.0)
        return SentimentResult(label="negative", score=score)
    else:
        return SentimentResult(label="neutral", score=0.5)


def analyze_sentiment(text: str) -> SentimentResult:
    """Analyze Vietnamese text sentiment.

    Applies slang normalization before analysis to improve accuracy.
    Returns neutral with score 0.0 for empty input.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        SentimentResult with label ("positive", "negative", "neutral")
        and confidence score (0.0 to 1.0).
    """
    if not text or not text.strip():
        return SentimentResult(label="neutral", score=0.0)

    # Normalize slang before analysis
    normalized = normalize_slang(text)

    if _HAS_SENTIMENT:
        try:
            result = _underthesea_sentiment(normalized)
            # underthesea returns a string label
            if isinstance(result, str):
                label = result.lower()
                if label in ("positive", "negative", "neutral"):
                    # underthesea doesn't provide a score, use 0.8 as default confidence
                    return SentimentResult(label=label, score=0.8)
            # If result format is unexpected, fall through to fallback
        except Exception:
            pass

    # Fallback to keyword-based analysis
    return _fallback_sentiment(normalized)
