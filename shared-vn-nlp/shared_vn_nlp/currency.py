"""Vietnamese currency (VND) formatting, compact display, and parsing.

Handles:
    - Standard VND formatting with dot separator and đ suffix
    - Compact display: K (nghìn), tr (triệu), tỷ
    - Parsing VND strings back to numeric values
    - Range formatting for price ranges

VN locale rules:
    - Thousands separator: . (dot)
    - Decimal separator: , (comma)
    - Currency symbol: đ (suffix)
"""

import re


def format_vnd(amount: int | float) -> str:
    """Format a number as VND display string.

    Uses dot (.) as thousands separator and đ suffix.

    Args:
        amount: Numeric amount in VND (e.g., 79000).

    Returns:
        Formatted VND string (e.g., "79.000đ").

    Examples:
        >>> format_vnd(79000)
        '79.000đ'
        >>> format_vnd(1500000)
        '1.500.000đ'
        >>> format_vnd(2000000000)
        '2.000.000.000đ'
    """
    amount = int(amount)
    # Format with dot as thousands separator
    formatted = f"{amount:,}".replace(",", ".")
    return f"{formatted}đ"


def format_compact(amount: int | float) -> str:
    """Format a number as compact VND string.

    Thresholds:
        >= 1 tỷ (1,000,000,000): "2 tỷ", "1,5 tỷ"
        >= 1 triệu (1,000,000): "1,5tr", "25tr"
        >= 1 nghìn (1,000): "79K", "150K"
        < 1,000: "500đ"

    Uses comma (,) as decimal separator per VN locale.

    Args:
        amount: Numeric amount in VND.

    Returns:
        Compact formatted string.

    Examples:
        >>> format_compact(79000)
        '79K'
        >>> format_compact(1500000)
        '1,5tr'
        >>> format_compact(2000000000)
        '2 tỷ'
    """
    amount = int(amount) if isinstance(amount, float) and amount == int(amount) else amount

    if amount >= 1_000_000_000:
        value = amount / 1_000_000_000
        # Format with 1 decimal, use comma as decimal separator
        result = f"{value:.1f} tỷ".replace(".", ",")
        # Remove trailing ",0" for clean whole numbers
        result = result.replace(",0 tỷ", " tỷ")
        return result
    elif amount >= 1_000_000:
        value = amount / 1_000_000
        # Format with 1 decimal, use comma as decimal separator
        result = f"{value:.1f}tr".replace(".", ",")
        # Remove trailing ",0" for clean whole numbers
        result = result.replace(",0tr", "tr")
        return result
    elif amount >= 1_000:
        return f"{amount // 1_000}K"
    else:
        return f"{int(amount)}đ"


def parse_vnd(text: str) -> int | None:
    """Parse a VND-formatted string back to a numeric value.

    Supported input patterns:
        - "79.000đ" → 79000
        - "79,000 VND" → 79000  (comma as thousands sep in some contexts)
        - "1,5 triệu" or "1,5tr" → 1500000
        - "1.5 triệu" or "1.5tr" → 1500000
        - "2 tỷ" → 2000000000
        - "79K" → 79000
        - "500đ" → 500

    Args:
        text: VND-formatted string.

    Returns:
        Integer amount or None if unparseable.

    Examples:
        >>> parse_vnd("79.000đ")
        79000
        >>> parse_vnd("1,5 triệu")
        1500000
        >>> parse_vnd("2 tỷ")
        2000000000
    """
    if not text or not text.strip():
        return None

    text = text.strip()

    # Pattern: tỷ (billions)
    match = re.match(r"^([\d.,]+)\s*tỷ$", text, re.IGNORECASE)
    if match:
        num_str = match.group(1).replace(",", ".")
        try:
            return int(float(num_str) * 1_000_000_000)
        except ValueError:
            return None

    # Pattern: triệu / tr (millions)
    match = re.match(r"^([\d.,]+)\s*(?:triệu|tr)$", text, re.IGNORECASE)
    if match:
        num_str = match.group(1).replace(",", ".")
        try:
            return int(float(num_str) * 1_000_000)
        except ValueError:
            return None

    # Pattern: K (thousands)
    match = re.match(r"^([\d.,]+)\s*[Kk]$", text)
    if match:
        num_str = match.group(1).replace(",", ".")
        try:
            return int(float(num_str) * 1_000)
        except ValueError:
            return None

    # Pattern: number with đ suffix (e.g., "79.000đ", "500đ")
    match = re.match(r"^([\d.]+)\s*đ$", text)
    if match:
        num_str = match.group(1).replace(".", "")
        try:
            return int(num_str)
        except ValueError:
            return None

    # Pattern: number with VND suffix (e.g., "79,000 VND", "79.000 VND")
    match = re.match(r"^([\d.,]+)\s*VND$", text, re.IGNORECASE)
    if match:
        num_str = match.group(1)
        # Determine separator convention:
        # If comma is used as thousands separator (e.g., "79,000")
        # If dot is used as thousands separator (e.g., "79.000")
        # Heuristic: if there's a comma followed by 3 digits at end, comma is thousands sep
        if re.match(r"^\d{1,3}(,\d{3})+$", num_str):
            # Comma as thousands separator (e.g., "79,000")
            num_str = num_str.replace(",", "")
        elif re.match(r"^\d{1,3}(\.\d{3})+$", num_str):
            # Dot as thousands separator (e.g., "79.000")
            num_str = num_str.replace(".", "")
        else:
            # Try removing all separators
            num_str = num_str.replace(".", "").replace(",", "")
        try:
            return int(num_str)
        except ValueError:
            return None

    # Pattern: plain number with dot as thousands separator (e.g., "79.000")
    match = re.match(r"^(\d{1,3}(?:\.\d{3})+)$", text)
    if match:
        num_str = match.group(1).replace(".", "")
        try:
            return int(num_str)
        except ValueError:
            return None

    # Pattern: plain integer
    match = re.match(r"^(\d+)$", text)
    if match:
        try:
            return int(match.group(1))
        except ValueError:
            return None

    return None


def format_range(low: int | float, high: int | float) -> str:
    """Format a price range using compact notation.

    Uses en-dash (–) as range separator with spaces.

    Args:
        low: Lower bound amount in VND.
        high: Upper bound amount in VND.

    Returns:
        Formatted range string (e.g., "50K – 200K").

    Examples:
        >>> format_range(50000, 200000)
        '50K – 200K'
        >>> format_range(1500000, 3000000)
        '1,5tr – 3tr'
    """
    return f"{format_compact(low)} – {format_compact(high)}"
