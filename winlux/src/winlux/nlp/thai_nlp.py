"""
Thai NLP Module Stub (T66 — REQ-39)

Provides Thai language support for Q3 2027 Thailand expansion.
Currently a stub with basic implementations that don't require PyThaiNLP dependency.
When ready to activate, install `pythainlp` and uncomment the full implementations.

Features (stub):
  - tokenize_thai(): Word segmentation (falls back to whitespace split)
  - format_thai_baht(): ฿ currency formatting
  - normalize_thai_phone(): Thai phone normalization (E.164)
  - detect_language(): Simple lang detection (vi/th/en)

Usage:
  from winlux.nlp.thai_nlp import format_thai_baht, normalize_thai_phone

  price = format_thai_baht(15900)  # "15,900฿"
  phone = normalize_thai_phone("081-234-5678")  # "+66812345678"
"""

import re
from typing import Optional


# ═══════════════════════════════════════════════════════════════
#  Thai Tokenization (stub — uses whitespace until PyThaiNLP installed)
# ═══════════════════════════════════════════════════════════════

def tokenize_thai(text: str) -> list[str]:
    """
    Tokenize Thai text into words.

    Currently uses simple space/punctuation split.
    For production: install pythainlp and use `word_tokenize(text, engine='newmm')`.
    """
    try:
        # Try PyThaiNLP if installed
        from pythainlp.tokenize import word_tokenize
        return word_tokenize(text, engine="newmm")
    except ImportError:
        # Fallback: split on whitespace and common Thai punctuation
        tokens = re.split(r'[\s,\.\!?;:]+', text)
        return [t for t in tokens if t.strip()]


# ═══════════════════════════════════════════════════════════════
#  Thai Baht Currency Formatting
# ═══════════════════════════════════════════════════════════════

def format_thai_baht(amount: float, compact: bool = False) -> str:
    """
    Format a number as Thai Baht currency.

    Args:
        amount: Numeric amount
        compact: If True, use compact format (e.g., "1.5M฿")

    Returns:
        Formatted string like "15,900฿" or "1.5M฿"

    Examples:
        format_thai_baht(15900)          → "15,900฿"
        format_thai_baht(1500000, True)  → "1.5ล้าน฿"
        format_thai_baht(25000000, True) → "25ล้าน฿"
    """
    if compact:
        if amount >= 1_000_000_000:
            return f"{amount / 1_000_000_000:.1f}พันล้าน฿"
        elif amount >= 1_000_000:
            val = amount / 1_000_000
            return f"{val:.1f}ล้าน฿" if val != int(val) else f"{int(val)}ล้าน฿"
        elif amount >= 100_000:
            return f"{amount / 1_000:.0f}K฿"
        elif amount >= 10_000:
            return f"{amount / 1_000:.1f}K฿"

    # Standard format with comma separator
    if amount == int(amount):
        return f"{int(amount):,}฿"
    return f"{amount:,.2f}฿"


# ═══════════════════════════════════════════════════════════════
#  Thai Phone Normalization
# ═══════════════════════════════════════════════════════════════

# Thai mobile prefixes (after removing leading 0)
THAI_MOBILE_PREFIXES = {
    "06", "08", "09",  # Mobile
    "02",  # Bangkok landline
    "03", "04", "05", "07",  # Regional landlines
}

# Thai mobile carriers by prefix
THAI_CARRIERS = {
    "06": "AIS/DTAC/TRUE (new)",
    "08": "AIS/DTAC/TRUE",
    "09": "AIS/DTAC/TRUE",
}


def normalize_thai_phone(phone: str) -> Optional[str]:
    """
    Normalize a Thai phone number to E.164 format.

    Handles formats:
      - 0812345678 → +66812345678
      - 081-234-5678 → +66812345678
      - +66812345678 → +66812345678 (already normalized)
      - 66812345678 → +66812345678

    Returns None if the input is not a valid Thai phone number.
    """
    if not phone:
        return None

    # Remove all non-digit characters except leading +
    cleaned = re.sub(r'[^\d+]', '', phone)

    # Handle +66 prefix
    if cleaned.startswith('+66'):
        digits = cleaned[3:]
    elif cleaned.startswith('66') and len(cleaned) >= 11:
        digits = cleaned[2:]
    elif cleaned.startswith('0'):
        digits = cleaned[1:]
    else:
        digits = cleaned

    # Validate length (Thai mobile = 9 digits after country code)
    if len(digits) != 9:
        return None

    # Validate prefix
    prefix = digits[:2]
    if prefix not in THAI_MOBILE_PREFIXES:
        return None

    return f"+66{digits}"


def detect_thai_carrier(phone: str) -> Optional[str]:
    """Detect carrier from Thai phone number."""
    normalized = normalize_thai_phone(phone)
    if not normalized:
        return None

    prefix = normalized[3:5]  # After +66
    return THAI_CARRIERS.get(prefix)


# ═══════════════════════════════════════════════════════════════
#  Simple Language Detection
# ═══════════════════════════════════════════════════════════════

# Thai character range: U+0E00 to U+0E7F
THAI_PATTERN = re.compile(r'[\u0E00-\u0E7F]')
# Vietnamese diacritics (unique to Vietnamese)
VN_PATTERN = re.compile(r'[ăâđêôơưàảãáạ]', re.IGNORECASE)


def detect_language(text: str) -> str:
    """
    Simple language detection for Vietnamese, Thai, or English.
    Not a replacement for langdetect/fasttext — just a quick heuristic.

    Returns: 'vi', 'th', or 'en'
    """
    if not text or len(text.strip()) < 3:
        return 'en'

    sample = text[:200]  # Only check first 200 chars

    thai_chars = len(THAI_PATTERN.findall(sample))
    vn_chars = len(VN_PATTERN.findall(sample))

    total_chars = len(sample)
    if total_chars == 0:
        return 'en'

    thai_ratio = thai_chars / total_chars
    vn_ratio = vn_chars / total_chars

    if thai_ratio > 0.2:
        return 'th'
    elif vn_ratio > 0.05:
        return 'vi'
    else:
        return 'en'
