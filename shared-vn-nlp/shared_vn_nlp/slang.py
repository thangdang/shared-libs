"""Vietnamese slang normalization.

Provides case-insensitive slang expansion with idempotence guarantee.
"""

import json
import re
from pathlib import Path
from typing import Dict

_DATA_DIR = Path(__file__).parent / "data"
_slang_dict: Dict[str, str] | None = None
_slang_pattern: re.Pattern | None = None


def load_slang_dict() -> Dict[str, str]:
    """Load slang mappings from data/vn_slang.json.

    Returns:
        Dictionary mapping slang abbreviations (lowercase) to their expansions.
        Contains at least 100 entries.

    Raises:
        FileNotFoundError: If vn_slang.json is missing.
        json.JSONDecodeError: If the file is malformed.
    """
    global _slang_dict
    if _slang_dict is not None:
        return _slang_dict

    slang_path = _DATA_DIR / "vn_slang.json"
    with open(slang_path, "r", encoding="utf-8") as f:
        raw = json.load(f)

    # Normalize keys to lowercase for case-insensitive matching
    _slang_dict = {k.lower(): v for k, v in raw.items()}
    return _slang_dict


def _get_slang_pattern() -> re.Pattern:
    """Build and cache a regex pattern matching all slang keys.

    Uses word boundaries to avoid partial matches within larger words.
    Keys are sorted by length (longest first) so longer matches take priority.
    """
    global _slang_pattern
    if _slang_pattern is not None:
        return _slang_pattern

    slang = load_slang_dict()
    # Sort by length descending so longer keys match first
    keys = sorted(slang.keys(), key=len, reverse=True)
    # Escape regex special characters in keys
    escaped = [re.escape(k) for k in keys]
    # Use word boundaries for matching; UNICODE flag handles Vietnamese chars
    pattern_str = r"(?<!\w)(" + "|".join(escaped) + r")(?!\w)"
    _slang_pattern = re.compile(pattern_str, re.IGNORECASE | re.UNICODE)
    return _slang_pattern


def normalize_slang(text: str) -> str:
    """Replace slang abbreviations with their full-form expansions.

    - Case-insensitive matching (e.g., "Ko", "KO", "ko" all match)
    - Preserves original casing of non-slang text
    - Idempotent: normalize(normalize(x)) == normalize(x)
    - Returns original text unchanged when no slang is found

    Args:
        text: Vietnamese text potentially containing slang.

    Returns:
        Text with all recognized slang replaced by expansions.
    """
    if not text:
        return text

    slang = load_slang_dict()
    pattern = _get_slang_pattern()

    def _replace(match: re.Match) -> str:
        matched_text = match.group(0)
        key = matched_text.lower()
        return slang.get(key, matched_text)

    return pattern.sub(_replace, text)
