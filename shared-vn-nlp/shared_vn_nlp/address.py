"""Vietnamese address parsing and normalization.

Pattern-based parser for unstructured VN address strings.
Splits by delimiters, matches segments against known patterns
(province, district prefix, ward prefix), expands abbreviations,
and returns structured components with confidence scores.

Supports common VN address patterns:
    - "123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM"
    - "Số 5A, ngõ 12, Láng Hạ, Đống Đa, Hà Nội"
    - "12 Trần Phú, Phường 4, Quận 5, Thành phố Hồ Chí Minh"
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Abbreviation expansion map (lowercase keys)
ABBREVIATIONS: dict[str, str] = {
    "tp": "Thành phố",
    "tp.": "Thành phố",
    "q": "Quận",
    "q.": "Quận",
    "p": "Phường",
    "p.": "Phường",
    "h": "Huyện",
    "h.": "Huyện",
    "tx": "Thị xã",
    "tx.": "Thị xã",
    "tt": "Thị trấn",
    "tt.": "Thị trấn",
    "x": "Xã",
    "x.": "Xã",
    # Province-level abbreviations
    "tphcm": "Hồ Chí Minh",
    "tp.hcm": "Hồ Chí Minh",
    "hcm": "Hồ Chí Minh",
    "hn": "Hà Nội",
    "sg": "Hồ Chí Minh",
    "đn": "Đà Nẵng",
}

# District-level prefixes (regex patterns for matching)
# Single-char prefixes require a dot or digit to avoid false positives
_DISTRICT_PREFIXES = [
    r"quận",
    r"q\.\s*",       # Q. followed by name/number
    r"q(?=\d)",      # Q followed immediately by digit (Q1, Q12)
    r"huyện",
    r"h\.\s*",       # H. followed by name
    r"thị\s*xã",
    r"tx\.\s*",
    r"tx(?=\s)",
    r"thành\s*phố",  # district-level city (thành phố thuộc tỉnh)
]

# Ward-level prefixes
_WARD_PREFIXES = [
    r"phường",
    r"p\.\s*",       # P. followed by name/number
    r"p(?=\d)",      # P followed immediately by digit (P4, P12)
    r"xã",
    r"x\.\s*",       # X. followed by name
    r"thị\s*trấn",
    r"tt\.\s*",
    r"tt(?=\s)",
]

# Province-level prefixes (used when matching province segments)
_PROVINCE_PREFIXES = [
    r"thành\s*phố",
    r"tp\.",
    r"tp(?=\s)",
    r"tỉnh",
]

# Compile patterns
_DISTRICT_PATTERN = re.compile(
    r"^\s*(?:" + "|".join(_DISTRICT_PREFIXES) + r")\s*(.+)",
    re.IGNORECASE | re.UNICODE,
)

_WARD_PATTERN = re.compile(
    r"^\s*(?:" + "|".join(_WARD_PREFIXES) + r")\s*(.+)",
    re.IGNORECASE | re.UNICODE,
)

_PROVINCE_PREFIX_PATTERN = re.compile(
    r"^\s*(?:" + "|".join(_PROVINCE_PREFIXES) + r")\s*(.+)",
    re.IGNORECASE | re.UNICODE,
)

# ---------------------------------------------------------------------------
# Province data (loaded from JSON)
# ---------------------------------------------------------------------------

_DATA_DIR = Path(__file__).parent / "data"
_provinces_cache: list[dict] | None = None
_province_lookup: dict[str, str] | None = None


def _load_provinces() -> list[dict]:
    """Load province data from vn_provinces.json."""
    global _provinces_cache
    if _provinces_cache is not None:
        return _provinces_cache

    provinces_path = _DATA_DIR / "vn_provinces.json"
    with open(provinces_path, "r", encoding="utf-8") as f:
        _provinces_cache = json.load(f)
    return _provinces_cache


def _get_province_lookup() -> dict[str, str]:
    """Build a lookup: lowercased name/alternate → official province name."""
    global _province_lookup
    if _province_lookup is not None:
        return _province_lookup

    provinces = _load_provinces()
    _province_lookup = {}

    for prov in provinces:
        official = prov["name"]
        # Add official name (lowercase)
        _province_lookup[official.lower()] = official
        # Add alternates
        for alt in prov.get("alternates", []):
            _province_lookup[alt.lower()] = official
        # Add code
        if "code" in prov:
            _province_lookup[prov["code"].lower()] = official

    # Also add common abbreviation expansions that map to provinces
    _province_lookup["hồ chí minh"] = "Hồ Chí Minh"
    _province_lookup["hà nội"] = "Hà Nội"
    _province_lookup["đà nẵng"] = "Đà Nẵng"
    _province_lookup["hải phòng"] = "Hải Phòng"
    _province_lookup["cần thơ"] = "Cần Thơ"

    return _province_lookup


# ---------------------------------------------------------------------------
# Dataclass
# ---------------------------------------------------------------------------


@dataclass
class ParsedAddress:
    """Result of Vietnamese address parsing.

    Attributes:
        street: Street address (house number, street name, alley, etc.).
        ward: Ward/commune name (Phường, Xã, Thị trấn).
        district: District name (Quận, Huyện, Thị xã).
        province: Province/city name (mapped to official 63-province list).
        confidence: Overall confidence score (0.0–1.0).
        components_confidence: Per-component confidence scores.
    """

    street: str | None
    ward: str | None
    district: str | None
    province: str | None
    confidence: float
    components_confidence: dict[str, float] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------


def _split_segments(raw: str) -> List[str]:
    """Split address string into segments by comma or dash (but not dashes in names).

    Commas are the primary delimiter.  Dashes are used only when they
    appear surrounded by spaces (to avoid splitting "Bà Rịa - Vũng Tàu").
    """
    # Split primarily by comma
    segments = re.split(r"\s*,\s*", raw.strip())
    # Further split by " - " (space-dash-space) which sometimes separates components
    result = []
    for seg in segments:
        # Only split on standalone dashes that separate address levels
        # Don't split "Bà Rịa - Vũng Tàu" (province name with dash)
        parts = re.split(r"\s+-\s+", seg)
        if len(parts) > 1:
            # Check if rejoining looks like a known province
            full = seg.strip()
            lookup = _get_province_lookup()
            # Strip any province prefix before checking
            stripped = _strip_province_prefix(full)
            if stripped.lower() in lookup or full.lower() in lookup:
                result.append(seg.strip())
            else:
                result.extend(p.strip() for p in parts if p.strip())
        else:
            if seg.strip():
                result.append(seg.strip())
    return result


def _strip_province_prefix(text: str) -> str:
    """Remove province-level prefix (TP., Thành phố, Tỉnh) from text."""
    m = _PROVINCE_PREFIX_PATTERN.match(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def _strip_district_prefix(text: str) -> str:
    """Remove district prefix (Q., Quận, H., Huyện, TX., Thị xã) from text."""
    m = _DISTRICT_PATTERN.match(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def _strip_ward_prefix(text: str) -> str:
    """Remove ward prefix (P., Phường, X., Xã, TT., Thị trấn) from text."""
    m = _WARD_PATTERN.match(text)
    if m:
        return m.group(1).strip()
    return text.strip()


def _is_district_segment(text: str) -> bool:
    """Check if a segment looks like a district reference."""
    return bool(_DISTRICT_PATTERN.match(text))


def _is_ward_segment(text: str) -> bool:
    """Check if a segment looks like a ward reference."""
    return bool(_WARD_PATTERN.match(text))


def _is_province_segment(text: str) -> bool:
    """Check if a segment matches a known province (with or without prefix)."""
    lookup = _get_province_lookup()
    stripped = _strip_province_prefix(text)
    return (
        text.strip().lower() in lookup
        or stripped.lower() in lookup
    )


def _expand_abbreviation_in_segment(text: str) -> str:
    """Expand known abbreviations at the start of a segment.

    E.g., "Q.1" → "Quận 1", "P. Bến Nghé" → "Phường Bến Nghé",
          "TP.HCM" → "Thành phố Hồ Chí Minh"
    """
    stripped = text.strip()
    lower = stripped.lower()

    # Check full-segment abbreviations first (e.g., "TPHCM", "HCM", "HN")
    if lower in ABBREVIATIONS:
        expansion = ABBREVIATIONS[lower]
        # If it's a province abbreviation, return expanded province name
        if lower in ("tphcm", "tp.hcm", "hcm", "hn", "sg", "đn"):
            return expansion
        # Otherwise it's a prefix expansion — shouldn't happen for full segment
        return expansion

    # Check if segment starts with an abbreviation prefix followed by a dot or
    # a digit/space (to distinguish "Q.1" or "Q 1" from "Quảng Ninh").
    # Single-char prefixes (q, p, h, x) MUST have a dot or be followed by a digit
    # to avoid false positives on normal Vietnamese words starting with those letters.
    prefix_pattern = re.compile(
        r"^(tp\.?|tx\.?|tt\.?)"  # Multi-char prefixes (always safe)
        r"\s*(.*)$",
        re.IGNORECASE | re.UNICODE,
    )
    single_char_pattern = re.compile(
        r"^([qphx])\."  # Single-char prefix MUST have dot
        r"\s*(.*)$",
        re.IGNORECASE | re.UNICODE,
    )
    single_char_digit_pattern = re.compile(
        r"^([qphx])\s*(\d.*)$",  # Single-char prefix followed by digit (Q1, P4)
        re.IGNORECASE | re.UNICODE,
    )

    # Try multi-char prefixes first
    m = prefix_pattern.match(stripped)
    if m:
        prefix_raw = m.group(1).lower()
        rest = m.group(2).strip()

        prefix_key = prefix_raw.rstrip(".")
        expansion = ABBREVIATIONS.get(prefix_key) or ABBREVIATIONS.get(prefix_key + ".")

        if expansion and rest:
            rest_lower = rest.lower()
            if rest_lower in ABBREVIATIONS:
                province_name = ABBREVIATIONS[rest_lower]
                lookup = _get_province_lookup()
                if province_name.lower() in lookup:
                    return f"{expansion} {province_name}"
            return f"{expansion} {rest}"
        elif expansion and not rest:
            return expansion

    # Try single-char prefix with dot (Q.1, P.Bến Nghé, H.Bình Chánh)
    m = single_char_pattern.match(stripped)
    if m:
        prefix_raw = m.group(1).lower()
        rest = m.group(2).strip()
        expansion = ABBREVIATIONS.get(prefix_raw) or ABBREVIATIONS.get(prefix_raw + ".")
        if expansion and rest:
            return f"{expansion} {rest}"
        elif expansion:
            return expansion

    # Try single-char prefix followed directly by digit (Q1, P4)
    m = single_char_digit_pattern.match(stripped)
    if m:
        prefix_raw = m.group(1).lower()
        rest = m.group(2).strip()
        expansion = ABBREVIATIONS.get(prefix_raw) or ABBREVIATIONS.get(prefix_raw + ".")
        if expansion and rest:
            return f"{expansion} {rest}"

    return stripped


def _match_province(text: str) -> tuple[str | None, float]:
    """Try to match text against the province list.

    Returns (official_name, confidence) or (None, 0.0).
    """
    lookup = _get_province_lookup()

    # Try direct match after stripping prefix
    stripped = _strip_province_prefix(text)
    key = stripped.lower().strip()

    if key in lookup:
        return lookup[key], 1.0

    # Try the full text as-is
    full_key = text.strip().lower()
    if full_key in lookup:
        return lookup[full_key], 1.0

    # Try expanding abbreviation then matching
    expanded = _expand_abbreviation_in_segment(text)
    expanded_stripped = _strip_province_prefix(expanded)
    exp_key = expanded_stripped.lower().strip()
    if exp_key in lookup:
        return lookup[exp_key], 0.9

    # Try partial/fuzzy — just the expanded full text
    exp_full_key = expanded.lower().strip()
    if exp_full_key in lookup:
        return lookup[exp_full_key], 0.9

    return None, 0.0


def _compute_confidence(
    street: str | None,
    ward: str | None,
    district: str | None,
    province: str | None,
    province_confidence: float,
    num_segments: int,
) -> tuple[float, dict[str, float]]:
    """Compute overall and per-component confidence scores."""
    components_confidence: dict[str, float] = {}

    # Province confidence
    if province:
        components_confidence["province"] = province_confidence
    else:
        components_confidence["province"] = 0.0

    # District confidence: high if it had a recognized prefix
    if district:
        components_confidence["district"] = 0.85
    else:
        components_confidence["district"] = 0.0

    # Ward confidence: high if it had a recognized prefix
    if ward:
        components_confidence["ward"] = 0.85
    else:
        components_confidence["ward"] = 0.0

    # Street confidence: based on position (first segment) and content
    if street:
        # Higher confidence if it contains a number (house number)
        has_number = bool(re.search(r"\d", street))
        components_confidence["street"] = 0.9 if has_number else 0.7
    else:
        components_confidence["street"] = 0.0

    # Overall confidence: weighted average of present components
    present = {k: v for k, v in components_confidence.items() if v > 0}
    if not present:
        return 0.0, components_confidence

    # Weight province higher as it anchors the address
    weights = {"province": 1.5, "district": 1.2, "ward": 1.0, "street": 1.0}
    total_weight = sum(weights.get(k, 1.0) for k in present)
    weighted_sum = sum(v * weights.get(k, 1.0) for k, v in present.items())
    overall = weighted_sum / total_weight

    # Penalize if very few segments were parseable
    if num_segments >= 3 and len(present) <= 1:
        overall *= 0.7

    return round(min(overall, 1.0), 2), components_confidence


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def parse_address(raw: str) -> ParsedAddress:
    """Parse unstructured VN address string into structured components.

    Strategy:
        1. Split by delimiters (comma, space-dash-space)
        2. Scan from last segment forward for province match
        3. Identify district/ward segments by prefix patterns
        4. Remaining segments become street address

    Args:
        raw: Unstructured Vietnamese address string.

    Returns:
        ParsedAddress with street, ward, district, province and confidence.
    """
    if not raw or not raw.strip():
        return ParsedAddress(
            street=None,
            ward=None,
            district=None,
            province=None,
            confidence=0.0,
            components_confidence={
                "street": 0.0,
                "ward": 0.0,
                "district": 0.0,
                "province": 0.0,
            },
        )

    segments = _split_segments(raw)
    if not segments:
        return ParsedAddress(
            street=None,
            ward=None,
            district=None,
            province=None,
            confidence=0.0,
            components_confidence={
                "street": 0.0,
                "ward": 0.0,
                "district": 0.0,
                "province": 0.0,
            },
        )

    num_segments = len(segments)
    province: str | None = None
    province_confidence: float = 0.0
    district: str | None = None
    ward: str | None = None
    street_parts: list[str] = []

    # Track which segments have been classified
    classified = [False] * num_segments

    # Step 1: Find province (scan from last segment backward)
    for i in range(num_segments - 1, -1, -1):
        seg = segments[i]
        # Expand abbreviation first
        expanded = _expand_abbreviation_in_segment(seg)
        matched_province, conf = _match_province(expanded)
        if matched_province:
            province = matched_province
            province_confidence = conf
            classified[i] = True
            break

    # Step 2: Find district and ward segments
    for i, seg in enumerate(segments):
        if classified[i]:
            continue

        expanded = _expand_abbreviation_in_segment(seg)

        if _is_district_segment(expanded) and district is None:
            # Extract district name (with prefix for the normalized form)
            district = expanded
            classified[i] = True
        elif _is_ward_segment(expanded) and ward is None:
            ward = expanded
            classified[i] = True

    # Step 3: If district/ward not found by prefix, try positional heuristic
    # In a 4-segment address "street, ward, district, province",
    # segment[-2] is district, segment[-3] is ward
    if province and not district:
        # Look for unclassified segment just before province
        for i in range(num_segments - 1, -1, -1):
            if classified[i]:
                continue
            seg = segments[i]
            expanded = _expand_abbreviation_in_segment(seg)
            # If it's the segment right before province and has no number,
            # it might be a district without explicit prefix
            if not re.search(r"^\d", expanded):
                # Check if it could be a district (e.g., "Đống Đa", "Bình Thạnh")
                # Only assign if we have province already and this is the second-to-last
                # unclassified segment near the province
                idx_of_province = next(
                    j for j in range(num_segments) if classified[j] and segments[j] != ""
                    and _match_province(_expand_abbreviation_in_segment(segments[j]))[0] == province
                )
                if i == idx_of_province - 1:
                    district = expanded
                    classified[i] = True
                    break

    if province and not ward and district:
        # Look for unclassified segment just before district
        district_idx = next(
            (j for j in range(num_segments) if classified[j] and segments[j] != ""
             and _expand_abbreviation_in_segment(segments[j]) == district),
            None,
        )
        if district_idx is not None and district_idx > 0:
            prev_idx = district_idx - 1
            if not classified[prev_idx]:
                seg = segments[prev_idx]
                expanded = _expand_abbreviation_in_segment(seg)
                # Assign as ward if it doesn't look like a street (no house number at start)
                if not re.match(r"^\d+\s", expanded):
                    ward = expanded
                    classified[prev_idx] = True

    # Step 4: Remaining unclassified segments become street address
    for i, seg in enumerate(segments):
        if not classified[i]:
            street_parts.append(seg.strip())

    street = ", ".join(street_parts) if street_parts else None

    # Compute confidence
    overall_conf, comp_conf = _compute_confidence(
        street=street,
        ward=ward,
        district=district,
        province=province,
        province_confidence=province_confidence,
        num_segments=num_segments,
    )

    return ParsedAddress(
        street=street,
        ward=ward,
        district=district,
        province=province,
        confidence=overall_conf,
        components_confidence=comp_conf,
    )


def normalize_address(raw: str) -> str:
    """Return normalized full-form address string.

    Expands all abbreviations to full form and orders components
    as: street, ward, district, province.

    Args:
        raw: Unstructured Vietnamese address string.

    Returns:
        Normalized address string with abbreviations expanded.
        Returns empty string if input is empty.
    """
    if not raw or not raw.strip():
        return ""

    parsed = parse_address(raw)

    parts: list[str] = []
    if parsed.street:
        parts.append(parsed.street)
    if parsed.ward:
        parts.append(parsed.ward)
    if parsed.district:
        parts.append(parsed.district)
    if parsed.province:
        # Add "Thành phố" prefix for the 5 centrally-governed cities
        central_cities = {"Hà Nội", "Hồ Chí Minh", "Đà Nẵng", "Hải Phòng", "Cần Thơ"}
        if parsed.province in central_cities:
            # Check if district already has "Thành phố" prefix (avoid duplication)
            if not (parsed.district and parsed.district.lower().startswith("thành phố")):
                parts.append(f"Thành phố {parsed.province}")
            else:
                parts.append(parsed.province)
        else:
            parts.append(parsed.province)

    return ", ".join(parts)
