"""Vietnamese province and region detection.

Detects mentions of Vietnam's 63 provinces using regex matching
against official names and common alternate names.
"""

import json
import re
from pathlib import Path
from typing import List
from dataclasses import dataclass

_DATA_DIR = Path(__file__).parent / "data"
_provinces_data: List[dict] | None = None
_province_pattern: re.Pattern | None = None
_name_to_province: dict | None = None


@dataclass
class ProvinceMatch:
    """A detected province mention in text."""

    name: str           # official name
    region: str         # e.g., "Đông Nam Bộ"
    matched_text: str   # what was found in input
    start: int          # start position in text
    end: int            # end position in text


def _load_provinces() -> List[dict]:
    """Load province data from JSON file."""
    global _provinces_data
    if _provinces_data is not None:
        return _provinces_data

    provinces_path = _DATA_DIR / "vn_provinces.json"
    with open(provinces_path, "r", encoding="utf-8") as f:
        _provinces_data = json.load(f)
    return _provinces_data


def _build_lookup() -> dict:
    """Build a lookup mapping all name variants (lowercased) to province info."""
    global _name_to_province
    if _name_to_province is not None:
        return _name_to_province

    provinces = _load_provinces()
    _name_to_province = {}

    for prov in provinces:
        official = prov["name"]
        region = prov["region"]
        # Map official name
        _name_to_province[official.lower()] = {"name": official, "region": region}
        # Map all alternates
        for alt in prov.get("alternates", []):
            _name_to_province[alt.lower()] = {"name": official, "region": region}

    return _name_to_province


def _get_pattern() -> re.Pattern:
    """Build and cache regex pattern for province detection."""
    global _province_pattern
    if _province_pattern is not None:
        return _province_pattern

    lookup = _build_lookup()
    # Sort by length descending so longer names match first
    names = sorted(lookup.keys(), key=len, reverse=True)
    escaped = [re.escape(n) for n in names]
    # Use word boundaries to avoid partial matches
    pattern_str = r"(?<!\w)(" + "|".join(escaped) + r")(?!\w)"
    _province_pattern = re.compile(pattern_str, re.IGNORECASE | re.UNICODE)
    return _province_pattern


def detect_provinces(text: str) -> List[ProvinceMatch]:
    """Detect province mentions in text via regex matching.

    Supports official names and alternate names (e.g., "Sài Gòn" → "Hồ Chí Minh").
    Case-insensitive matching.

    Args:
        text: Vietnamese text to scan for province mentions.

    Returns:
        List of ProvinceMatch objects. Empty list if no provinces found
        or if input is empty/whitespace.
    """
    if not text or not text.strip():
        return []

    pattern = _get_pattern()
    lookup = _build_lookup()
    matches = []
    seen_positions = set()

    for match in pattern.finditer(text):
        start = match.start()
        end = match.end()
        # Avoid duplicate matches at same position
        if start in seen_positions:
            continue
        seen_positions.add(start)

        matched_text = match.group(0)
        key = matched_text.lower()
        prov_info = lookup.get(key)
        if prov_info:
            matches.append(ProvinceMatch(
                name=prov_info["name"],
                region=prov_info["region"],
                matched_text=matched_text,
                start=start,
                end=end,
            ))

    return matches


def get_all_provinces() -> List[dict]:
    """Return all 63 provinces with names, alternates, and regions.

    Returns:
        List of province dictionaries with keys: name, alternates, region, code.
    """
    return _load_provinces()
