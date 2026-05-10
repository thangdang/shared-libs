"""Shared Vietnamese NLP library for AI engines.

Public API:
    segment, ner, pos_tag — Vietnamese NLP (word segmentation, NER, POS tagging)
    normalize_slang — Slang normalization
    detect_provinces — Province/region detection
    get_events, get_events_in_range, lunar_to_solar — Vietnamese calendar
    analyze_sentiment — Sentiment analysis
"""

from shared_vn_nlp.nlp import segment, ner, pos_tag
from shared_vn_nlp.slang import normalize_slang
from shared_vn_nlp.provinces import detect_provinces
from shared_vn_nlp.calendar import get_events, get_events_in_range, lunar_to_solar
from shared_vn_nlp.sentiment import analyze_sentiment

__all__ = [
    "segment",
    "ner",
    "pos_tag",
    "normalize_slang",
    "detect_provinces",
    "get_events",
    "get_events_in_range",
    "lunar_to_solar",
    "analyze_sentiment",
]
