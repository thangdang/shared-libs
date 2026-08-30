"""Vietnamese NLP utilities: word segmentation, NER, POS tagging.

Wraps underthesea functions with consistent empty-input handling.
"""

from typing import List, Tuple

from underthesea import word_tokenize, ner as _underthesea_ner, pos_tag as _underthesea_pos_tag


def segment(text: str) -> List[str]:
    """Vietnamese word segmentation using underthesea.

    Args:
        text: Vietnamese text to segment.

    Returns:
        List of word tokens. Empty list for empty/whitespace input.
    """
    if not text or not text.strip():
        return []
    return word_tokenize(text)


def ner(text: str) -> List[Tuple[str, str, str, str]]:
    """Named Entity Recognition using underthesea.

    Args:
        text: Vietnamese text to analyze.

    Returns:
        List of (word, pos, chunk, ner_tag) tuples.
        Empty list for empty/whitespace input.
    """
    if not text or not text.strip():
        return []
    return _underthesea_ner(text)


def pos_tag(text: str) -> List[Tuple[str, str]]:
    """POS tagging using underthesea.

    Args:
        text: Vietnamese text to tag.

    Returns:
        List of (word, tag) tuples.
        Empty list for empty/whitespace input.
    """
    if not text or not text.strip():
        return []
    return _underthesea_pos_tag(text)
