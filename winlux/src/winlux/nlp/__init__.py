"""Shared Vietnamese NLP library for AI engines.

Public API:
    segment, ner, pos_tag — Vietnamese NLP (word segmentation, NER, POS tagging)
    normalize_slang — Slang normalization
    detect_provinces — Province/region detection
    get_events, get_events_in_range, lunar_to_solar — Vietnamese calendar
    analyze_sentiment — Sentiment analysis
    normalize_phone, validate_phone, detect_carrier — Phone number utilities
    format_vnd, format_compact, parse_vnd — VND currency formatting
    parse_address — Address parsing
"""

from winlux.nlp.core import segment, ner, pos_tag
from winlux.nlp.slang import normalize_slang
from winlux.nlp.provinces import detect_provinces
from winlux.nlp.calendar import get_events, get_events_in_range, lunar_to_solar
from winlux.nlp.sentiment import analyze_sentiment
from winlux.nlp.phone import normalize_phone, validate_phone, detect_carrier, PhoneResult
from winlux.nlp.currency import format_vnd, format_compact, parse_vnd
from winlux.nlp.address import parse_address, ParsedAddress

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
    # Phone utilities
    "normalize_phone",
    "validate_phone",
    "detect_carrier",
    "PhoneResult",
    # Currency formatting
    "format_vnd",
    "format_compact",
    "parse_vnd",
    # Address parsing
    "parse_address",
    "ParsedAddress",
]
