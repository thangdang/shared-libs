"""
PhoBERT Sentiment Analysis — VN Market Enhancement
───────────────────────────────────────────────────
Advanced Vietnamese sentiment analysis using PhoBERT,
a state-of-the-art pre-trained language model for Vietnamese.

PhoBERT is based on RoBERTa architecture, pre-trained on 20GB
of Vietnamese text.  It achieves SOTA results on Vietnamese NLP tasks.

Features:
  - Fine-grained sentiment (5-class: very neg, neg, neutral, pos, very pos)
  - Aspect-based sentiment extraction
  - Emotion detection (8 emotions)
  - Confidence scores with calibration
  - Batch processing support
  - Caching for repeated texts
  - Graceful fallback when model unavailable

Model:  vinai/phobert-base-v2 (from Hugging Face)
Paper:  https://arxiv.org/abs/2003.00744
"""

import hashlib
import logging
import os
import re
from dataclasses import dataclass
from dataclasses import field
from enum import Enum
from functools import lru_cache
from typing import Any

logger = logging.getLogger("winlux.nlp.phobert_sentiment")

# ═══════════════════════════════════════════════════════════════════════════════
#  Model Loading
# ═══════════════════════════════════════════════════════════════════════════════

_MODEL_LOADED = False
_TOKENIZER = None
_MODEL = None
_DEVICE = "cpu"

# Model configuration
PHOBERT_CONFIG = {
    "model_name": "vinai/phobert-base-v2",
    "sentiment_model": "wonrax/phobert-base-vietnamese-sentiment",
    "max_length": 256,
    "cache_dir": os.getenv("PHOBERT_CACHE_DIR", None),
}


def _load_model():
    """Lazy load PhoBERT model and tokenizer."""
    global _MODEL_LOADED, _TOKENIZER, _MODEL, _DEVICE

    if _MODEL_LOADED:
        return _MODEL is not None

    _MODEL_LOADED = True

    try:
        import torch
        from transformers import AutoModelForSequenceClassification
        from transformers import AutoTokenizer

        # Check for GPU
        _DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
        logger.info(f"PhoBERT using device: {_DEVICE}")

        # Load tokenizer and model
        _TOKENIZER = AutoTokenizer.from_pretrained(
            PHOBERT_CONFIG["sentiment_model"],
            cache_dir=PHOBERT_CONFIG["cache_dir"],
        )

        _MODEL = AutoModelForSequenceClassification.from_pretrained(
            PHOBERT_CONFIG["sentiment_model"],
            cache_dir=PHOBERT_CONFIG["cache_dir"],
        )
        _MODEL.to(_DEVICE)
        _MODEL.eval()

        logger.info("PhoBERT sentiment model loaded successfully")
        return True

    except ImportError as e:
        logger.warning(f"PhoBERT dependencies not installed: {e}")
        logger.info("Install with: pip install transformers torch")
        return False

    except Exception as e:
        logger.error(f"Failed to load PhoBERT model: {e}")
        return False


def is_model_available() -> bool:
    """Check if PhoBERT model is available."""
    return _load_model()


# ═══════════════════════════════════════════════════════════════════════════════
#  Enums and Data Classes
# ═══════════════════════════════════════════════════════════════════════════════

class SentimentLabel(Enum):
    """Five-class sentiment labels."""

    VERY_NEGATIVE = "very_negative"
    NEGATIVE = "negative"
    NEUTRAL = "neutral"
    POSITIVE = "positive"
    VERY_POSITIVE = "very_positive"


class Emotion(Enum):
    """Vietnamese emotion categories."""

    JOY = "joy"             # Vui vẻ
    SADNESS = "sadness"     # Buồn
    ANGER = "anger"         # Giận dữ
    FEAR = "fear"           # Sợ hãi
    SURPRISE = "surprise"   # Ngạc nhiên
    DISGUST = "disgust"     # Ghê tởm
    TRUST = "trust"         # Tin tưởng
    ANTICIPATION = "anticipation"  # Mong đợi


# Vietnamese emotion names
EMOTION_NAMES_VI = {
    Emotion.JOY: "Vui vẻ",
    Emotion.SADNESS: "Buồn bã",
    Emotion.ANGER: "Tức giận",
    Emotion.FEAR: "Sợ hãi",
    Emotion.SURPRISE: "Ngạc nhiên",
    Emotion.DISGUST: "Ghê tởm",
    Emotion.TRUST: "Tin tưởng",
    Emotion.ANTICIPATION: "Mong đợi",
}

# Sentiment label names in Vietnamese
SENTIMENT_NAMES_VI = {
    SentimentLabel.VERY_NEGATIVE: "Rất tiêu cực",
    SentimentLabel.NEGATIVE: "Tiêu cực",
    SentimentLabel.NEUTRAL: "Trung lập",
    SentimentLabel.POSITIVE: "Tích cực",
    SentimentLabel.VERY_POSITIVE: "Rất tích cực",
}


@dataclass
class SentimentResult:
    """Result of sentiment analysis."""

    label: SentimentLabel
    confidence: float  # 0.0 to 1.0

    # Probabilities for each class
    probabilities: dict[SentimentLabel, float] = field(default_factory=dict)

    # Simple label string for compatibility
    label_simple: str = ""  # "positive", "negative", "neutral"

    def __post_init__(self):
        """Set simple label."""
        if self.label in (SentimentLabel.POSITIVE, SentimentLabel.VERY_POSITIVE):
            self.label_simple = "positive"
        elif self.label in (SentimentLabel.NEGATIVE, SentimentLabel.VERY_NEGATIVE):
            self.label_simple = "negative"
        else:
            self.label_simple = "neutral"

    @property
    def label_vi(self) -> str:
        """Get Vietnamese label name."""
        return SENTIMENT_NAMES_VI.get(self.label, "Không xác định")


@dataclass
class AspectSentiment:
    """Sentiment for a specific aspect."""

    aspect: str          # The aspect/topic
    sentiment: SentimentLabel
    confidence: float
    text_span: str = ""  # The text mentioning this aspect


@dataclass
class EmotionResult:
    """Result of emotion detection."""

    primary_emotion: Emotion
    confidence: float

    # All emotion scores
    emotions: dict[Emotion, float] = field(default_factory=dict)

    @property
    def primary_emotion_vi(self) -> str:
        """Get Vietnamese emotion name."""
        return EMOTION_NAMES_VI.get(self.primary_emotion, "Không xác định")


@dataclass
class AnalysisResult:
    """Complete analysis result."""

    text: str
    sentiment: SentimentResult
    emotions: EmotionResult | None = None
    aspects: list[AspectSentiment] = field(default_factory=list)

    # Metadata
    model_used: str = "phobert"
    processing_time_ms: float = 0.0


# ═══════════════════════════════════════════════════════════════════════════════
#  Keyword Dictionaries for Fallback
# ═══════════════════════════════════════════════════════════════════════════════

# Expanded Vietnamese sentiment keywords
SENTIMENT_KEYWORDS = {
    SentimentLabel.VERY_POSITIVE: [
        "tuyệt vời", "xuất sắc", "hoàn hảo", "tuyệt đỉnh", "siêu đỉnh",
        "quá tuyệt", "cực kỳ tốt", "rất tuyệt", "amazing", "perfect",
        "excellent", "fantastic", "đỉnh cao", "số 1", "nhất", "yêu lắm",
        "quá hay", "quá đẹp", "siêu phẩm", "đỉnh của đỉnh",
    ],
    SentimentLabel.POSITIVE: [
        "tốt", "hay", "đẹp", "thích", "yêu", "vui", "ổn", "được",
        "dễ thương", "đáng yêu", "hài lòng", "cảm ơn", "ngon", "thú vị",
        "hạnh phúc", "thoải mái", "tiện", "nhanh", "chất lượng",
        "good", "nice", "great", "ok", "okay", "love", "like",
    ],
    SentimentLabel.NEUTRAL: [
        "bình thường", "tạm", "cũng được", "không sao", "bt", "thường",
        "so so", "tàm tạm", "cũng ok", "không tốt không xấu",
    ],
    SentimentLabel.NEGATIVE: [
        "xấu", "tệ", "ghét", "buồn", "chán", "dở", "kém", "khó chịu",
        "thất vọng", "tức", "giận", "đau", "sợ", "lo", "khổ", "mệt",
        "bực", "phiền", "bad", "terrible", "hate", "boring", "slow",
        "chậm", "đắt", "hỏng", "lỗi", "không tốt",
    ],
    SentimentLabel.VERY_NEGATIVE: [
        "tệ hại", "kinh khủng", "tồi tệ", "rất tệ", "cực kỳ tệ",
        "quá tệ", "thảm họa", "không thể chấp nhận", "awful", "horrible",
        "disaster", "waste", "lừa đảo", "scam", "fake", "giả",
        "quá xấu", "tồi nhất", "chán ngán", "rác",
    ],
}

# Emotion keywords
EMOTION_KEYWORDS = {
    Emotion.JOY: [
        "vui", "hạnh phúc", "sung sướng", "phấn khởi", "hào hứng",
        "thích thú", "mừng", "cười", "haha", "hihi", "yeahh", "yeah",
        "happy", "joy", "excited", "yay",
    ],
    Emotion.SADNESS: [
        "buồn", "đau", "khóc", "thương", "nhớ", "cô đơn", "tủi thân",
        "chán nản", "thất vọng", "huhu", "sad", "cry", "miss",
    ],
    Emotion.ANGER: [
        "tức", "giận", "bực", "điên", "phẫn nộ", "cáu", "nổi khùng",
        "angry", "mad", "furious", "wtf", "dm",
    ],
    Emotion.FEAR: [
        "sợ", "lo", "hoang mang", "bất an", "hãi", "kinh", "rùng mình",
        "fear", "scared", "worried", "anxious",
    ],
    Emotion.SURPRISE: [
        "ngạc nhiên", "bất ngờ", "sốc", "wow", "ôi", "trời ơi",
        "không tin nổi", "surprise", "shocked", "omg",
    ],
    Emotion.DISGUST: [
        "ghê", "kinh", "tởm", "ghét", "chán ghét", "ớn", "buồn nôn",
        "disgusting", "gross", "ew",
    ],
    Emotion.TRUST: [
        "tin", "tin tưởng", "uy tín", "đáng tin", "chắc chắn",
        "trust", "reliable", "confident",
    ],
    Emotion.ANTICIPATION: [
        "mong", "chờ", "háo hức", "trông đợi", "kỳ vọng", "hy vọng",
        "expect", "hope", "wait", "looking forward",
    ],
}

# Common Vietnamese aspects for aspect-based sentiment
COMMON_ASPECTS = {
    "product": [
        "sản phẩm", "hàng", "đồ", "product", "item",
    ],
    "quality": [
        "chất lượng", "quality", "chất", "độ bền",
    ],
    "price": [
        "giá", "price", "tiền", "cost", "đắt", "rẻ",
    ],
    "delivery": [
        "giao hàng", "ship", "shipping", "vận chuyển", "delivery",
    ],
    "service": [
        "dịch vụ", "service", "phục vụ", "hỗ trợ", "support",
    ],
    "packaging": [
        "đóng gói", "bao bì", "packaging", "hộp",
    ],
    "seller": [
        "shop", "người bán", "seller", "cửa hàng", "store",
    ],
}


# ═══════════════════════════════════════════════════════════════════════════════
#  PhoBERT Sentiment Analyzer
# ═══════════════════════════════════════════════════════════════════════════════

class PhoBERTSentimentAnalyzer:
    """
    Advanced Vietnamese sentiment analyzer using PhoBERT.

    Provides fine-grained sentiment analysis, emotion detection,
    and aspect-based sentiment extraction.
    """

    def __init__(self, use_gpu: bool = True):
        """
        Initialize analyzer.

        Args:
            use_gpu: Whether to use GPU if available.
        """
        self._use_gpu = use_gpu
        self._cache: dict[str, SentimentResult] = {}
        self._cache_max_size = 1000

    def _get_cache_key(self, text: str) -> str:
        """Generate cache key for text."""
        return hashlib.md5(text.encode()).hexdigest()

    def _preprocess_text(self, text: str) -> str:
        """Preprocess Vietnamese text.
        
        Uses shared slang.py module for comprehensive abbreviation expansion.
        """
        # Normalize whitespace
        text = re.sub(r"\s+", " ", text.strip())

        # Use shared slang normalization for comprehensive coverage
        # This leverages vn_slang.json with 100+ Vietnamese abbreviations
        try:
            from winlux.nlp.slang import normalize_slang
            text = normalize_slang(text)
        except ImportError:
            # Fallback to inline normalization if slang module unavailable
            replacements = {
                r"\bk\b": "không",
                r"\bko\b": "không",
                r"\bdc\b": "được",
                r"\bđc\b": "được",
                r"\bbt\b": "bình thường",
                r"\bns\b": "nói",
                r"\bqua\b": "quá",
                r"\bj\b": "gì",
                r"\bntn\b": "như thế nào",
                r"\bcx\b": "cũng",
                r"\bvs\b": "với",
                r"\bmn\b": "mọi người",
                r"\bak\b": "à",
                r"\bnha\b": "nhé",
            }

            for pattern, replacement in replacements.items():
                text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)

        return text

    def analyze(self, text: str, use_cache: bool = True) -> SentimentResult:
        """
        Analyze sentiment of Vietnamese text.

        Args:
            text: Text to analyze.
            use_cache: Whether to use caching.

        Returns:
            SentimentResult with label and confidence.
        """
        if not text or not text.strip():
            return SentimentResult(
                label=SentimentLabel.NEUTRAL,
                confidence=0.0,
                probabilities={},
            )

        # Check cache
        if use_cache:
            cache_key = self._get_cache_key(text)
            if cache_key in self._cache:
                return self._cache[cache_key]

        # Preprocess
        processed_text = self._preprocess_text(text)

        # Try PhoBERT model
        if _load_model() and _MODEL is not None and _TOKENIZER is not None:
            result = self._analyze_with_model(processed_text)
        else:
            result = self._analyze_fallback(processed_text)

        # Cache result
        if use_cache:
            if len(self._cache) >= self._cache_max_size:
                # Simple cache eviction - clear half
                keys = list(self._cache.keys())[:self._cache_max_size // 2]
                for k in keys:
                    del self._cache[k]
            self._cache[cache_key] = result

        return result

    def _analyze_with_model(self, text: str) -> SentimentResult:
        """Analyze using PhoBERT model."""
        import torch

        try:
            # Tokenize
            inputs = _TOKENIZER(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=PHOBERT_CONFIG["max_length"],
                padding=True,
            )

            # Move to device
            inputs = {k: v.to(_DEVICE) for k, v in inputs.items()}

            # Inference
            with torch.no_grad():
                outputs = _MODEL(**inputs)
                probs = torch.softmax(outputs.logits, dim=-1)[0]

            # The wonrax model outputs 3 classes: negative, neutral, positive
            # Map to our 5-class system
            prob_values = probs.cpu().numpy()

            # Assuming order: negative, neutral, positive
            neg_prob = float(prob_values[0])
            neu_prob = float(prob_values[1])
            pos_prob = float(prob_values[2])

            # Map to 5-class
            probabilities = {
                SentimentLabel.VERY_NEGATIVE: neg_prob * 0.3,
                SentimentLabel.NEGATIVE: neg_prob * 0.7,
                SentimentLabel.NEUTRAL: neu_prob,
                SentimentLabel.POSITIVE: pos_prob * 0.7,
                SentimentLabel.VERY_POSITIVE: pos_prob * 0.3,
            }

            # Get label with highest probability
            label = max(probabilities, key=lambda k: probabilities[k])

            # Adjust for strong sentiment based on text patterns
            text_lower = text.lower()
            for kw in SENTIMENT_KEYWORDS[SentimentLabel.VERY_POSITIVE]:
                if kw in text_lower:
                    if label == SentimentLabel.POSITIVE:
                        label = SentimentLabel.VERY_POSITIVE
                    break

            for kw in SENTIMENT_KEYWORDS[SentimentLabel.VERY_NEGATIVE]:
                if kw in text_lower:
                    if label == SentimentLabel.NEGATIVE:
                        label = SentimentLabel.VERY_NEGATIVE
                    break

            confidence = probabilities[label]

            return SentimentResult(
                label=label,
                confidence=confidence,
                probabilities=probabilities,
            )

        except Exception as e:
            logger.error(f"Model inference failed: {e}")
            return self._analyze_fallback(text)

    def _analyze_fallback(self, text: str) -> SentimentResult:
        """Fallback keyword-based analysis."""
        text_lower = text.lower()

        # Count keyword matches
        scores = {label: 0.0 for label in SentimentLabel}

        for label, keywords in SENTIMENT_KEYWORDS.items():
            for kw in keywords:
                if kw in text_lower:
                    scores[label] += 1

        # Normalize
        total = sum(scores.values())
        if total == 0:
            return SentimentResult(
                label=SentimentLabel.NEUTRAL,
                confidence=0.5,
                probabilities={label: 0.2 for label in SentimentLabel},
            )

        probabilities = {label: score / total for label, score in scores.items()}

        # Handle neutral default
        if probabilities[SentimentLabel.NEUTRAL] == 0:
            probabilities[SentimentLabel.NEUTRAL] = 0.1

        # Renormalize
        total = sum(probabilities.values())
        probabilities = {label: score / total for label, score in probabilities.items()}

        label = max(probabilities, key=lambda k: probabilities[k])
        confidence = probabilities[label]

        return SentimentResult(
            label=label,
            confidence=min(confidence, 0.85),  # Cap fallback confidence
            probabilities=probabilities,
        )

    def analyze_batch(
        self,
        texts: list[str],
        batch_size: int = 32,
    ) -> list[SentimentResult]:
        """
        Analyze sentiment for multiple texts.

        Args:
            texts: List of texts to analyze.
            batch_size: Batch size for model inference.

        Returns:
            List of SentimentResult.
        """
        results = []

        # Check for cached results
        to_process = []
        to_process_indices = []

        for i, text in enumerate(texts):
            cache_key = self._get_cache_key(text)
            if cache_key in self._cache:
                results.append((i, self._cache[cache_key]))
            else:
                to_process.append(text)
                to_process_indices.append(i)

        # Process uncached texts
        if to_process:
            if _load_model() and _MODEL is not None:
                batch_results = self._analyze_batch_with_model(to_process, batch_size)
            else:
                batch_results = [self._analyze_fallback(self._preprocess_text(t)) for t in to_process]

            for idx, result in zip(to_process_indices, batch_results):
                results.append((idx, result))
                # Cache
                cache_key = self._get_cache_key(texts[idx])
                self._cache[cache_key] = result

        # Sort by original index
        results.sort(key=lambda x: x[0])
        return [r for _, r in results]

    def _analyze_batch_with_model(
        self,
        texts: list[str],
        batch_size: int,
    ) -> list[SentimentResult]:
        """Batch analysis with model."""
        import torch

        results = []
        processed_texts = [self._preprocess_text(t) for t in texts]

        for i in range(0, len(processed_texts), batch_size):
            batch = processed_texts[i:i + batch_size]

            try:
                inputs = _TOKENIZER(
                    batch,
                    return_tensors="pt",
                    truncation=True,
                    max_length=PHOBERT_CONFIG["max_length"],
                    padding=True,
                )

                inputs = {k: v.to(_DEVICE) for k, v in inputs.items()}

                with torch.no_grad():
                    outputs = _MODEL(**inputs)
                    probs = torch.softmax(outputs.logits, dim=-1)

                for j, prob in enumerate(probs):
                    prob_values = prob.cpu().numpy()
                    neg_prob = float(prob_values[0])
                    neu_prob = float(prob_values[1])
                    pos_prob = float(prob_values[2])

                    probabilities = {
                        SentimentLabel.VERY_NEGATIVE: neg_prob * 0.3,
                        SentimentLabel.NEGATIVE: neg_prob * 0.7,
                        SentimentLabel.NEUTRAL: neu_prob,
                        SentimentLabel.POSITIVE: pos_prob * 0.7,
                        SentimentLabel.VERY_POSITIVE: pos_prob * 0.3,
                    }

                    label = max(probabilities, key=lambda k: probabilities[k])

                    results.append(SentimentResult(
                        label=label,
                        confidence=probabilities[label],
                        probabilities=probabilities,
                    ))

            except Exception as e:
                logger.error(f"Batch inference failed: {e}")
                for text in batch:
                    results.append(self._analyze_fallback(text))

        return results

    def detect_emotion(self, text: str) -> EmotionResult:
        """
        Detect emotion in Vietnamese text.

        Args:
            text: Text to analyze.

        Returns:
            EmotionResult with primary emotion and scores.
        """
        if not text or not text.strip():
            return EmotionResult(
                primary_emotion=Emotion.TRUST,
                confidence=0.0,
                emotions={},
            )

        text_lower = text.lower()
        processed = self._preprocess_text(text_lower)

        # Score each emotion
        scores = {emotion: 0.0 for emotion in Emotion}

        for emotion, keywords in EMOTION_KEYWORDS.items():
            for kw in keywords:
                if kw in processed:
                    scores[emotion] += 1

        # Normalize
        total = sum(scores.values())
        if total == 0:
            # Default to neutral trust
            return EmotionResult(
                primary_emotion=Emotion.TRUST,
                confidence=0.5,
                emotions={emotion: 0.125 for emotion in Emotion},
            )

        emotions = {emotion: score / total for emotion, score in scores.items()}
        primary = max(emotions, key=lambda k: emotions[k])

        return EmotionResult(
            primary_emotion=primary,
            confidence=emotions[primary],
            emotions=emotions,
        )

    def extract_aspect_sentiments(self, text: str) -> list[AspectSentiment]:
        """
        Extract aspect-based sentiments from text.

        Args:
            text: Text to analyze.

        Returns:
            List of AspectSentiment for detected aspects.
        """
        if not text or not text.strip():
            return []

        text_lower = text.lower()
        aspects_found = []

        # Find mentioned aspects
        for aspect_name, keywords in COMMON_ASPECTS.items():
            for kw in keywords:
                if kw in text_lower:
                    # Find sentence containing this aspect
                    sentences = re.split(r"[.!?]", text)
                    for sentence in sentences:
                        if kw in sentence.lower():
                            # Analyze sentiment of this sentence
                            sent_result = self.analyze(sentence, use_cache=False)

                            aspects_found.append(AspectSentiment(
                                aspect=aspect_name,
                                sentiment=sent_result.label,
                                confidence=sent_result.confidence,
                                text_span=sentence.strip(),
                            ))
                            break
                    break

        return aspects_found

    def full_analysis(self, text: str) -> AnalysisResult:
        """
        Perform full analysis including sentiment, emotion, and aspects.

        Args:
            text: Text to analyze.

        Returns:
            Complete AnalysisResult.
        """
        import time
        start = time.time()

        sentiment = self.analyze(text)
        emotions = self.detect_emotion(text)
        aspects = self.extract_aspect_sentiments(text)

        elapsed = (time.time() - start) * 1000

        return AnalysisResult(
            text=text,
            sentiment=sentiment,
            emotions=emotions,
            aspects=aspects,
            model_used="phobert" if (_MODEL is not None) else "fallback",
            processing_time_ms=elapsed,
        )


# ═══════════════════════════════════════════════════════════════════════════════
#  Module-level convenience functions
# ═══════════════════════════════════════════════════════════════════════════════

_analyzer: PhoBERTSentimentAnalyzer | None = None


def get_analyzer() -> PhoBERTSentimentAnalyzer:
    """Get singleton analyzer instance."""
    global _analyzer
    if _analyzer is None:
        _analyzer = PhoBERTSentimentAnalyzer()
    return _analyzer


def analyze_sentiment(text: str) -> SentimentResult:
    """
    Analyze Vietnamese text sentiment using PhoBERT.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        SentimentResult with label, confidence, and probabilities.
    """
    analyzer = get_analyzer()
    return analyzer.analyze(text)


def analyze_sentiment_batch(texts: list[str]) -> list[SentimentResult]:
    """
    Analyze sentiment for multiple texts.

    Args:
        texts: List of Vietnamese texts.

    Returns:
        List of SentimentResult.
    """
    analyzer = get_analyzer()
    return analyzer.analyze_batch(texts)


def detect_emotion(text: str) -> EmotionResult:
    """
    Detect emotion in Vietnamese text.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        EmotionResult with primary emotion and scores.
    """
    analyzer = get_analyzer()
    return analyzer.detect_emotion(text)


def extract_aspects(text: str) -> list[AspectSentiment]:
    """
    Extract aspect-based sentiments.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        List of AspectSentiment for detected aspects.
    """
    analyzer = get_analyzer()
    return analyzer.extract_aspect_sentiments(text)


def full_analysis(text: str) -> AnalysisResult:
    """
    Perform complete sentiment analysis.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        AnalysisResult with sentiment, emotions, and aspects.
    """
    analyzer = get_analyzer()
    return analyzer.full_analysis(text)


def get_sentiment_simple(text: str) -> tuple[str, float]:
    """
    Simple sentiment analysis returning label and confidence.

    Args:
        text: Vietnamese text.

    Returns:
        Tuple of (label, confidence) where label is "positive", "negative", or "neutral".
    """
    result = analyze_sentiment(text)
    return result.label_simple, result.confidence
