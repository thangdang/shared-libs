"""Vietnamese phone number normalization, validation, and carrier detection.

Handles all common VN phone formats:
    - Local: 0912345678, 0912.345.678, 0912-345-678
    - International: +84912345678, 84912345678
    - With spaces: 0912 345 678

VN phone numbers are 10 digits (since 2018 migration).
Carrier detection uses the 3-digit prefix after leading 0.
"""

import re
from dataclasses import dataclass

# Carrier prefix mapping (3-digit prefix after leading 0)
CARRIER_PREFIXES: dict[str, list[str]] = {
    "viettel": [
        "086", "096", "097", "098",
        "032", "033", "034", "035", "036", "037", "038", "039",
    ],
    "mobifone": [
        "089", "090", "093",
        "070", "076", "077", "078", "079",
    ],
    "vinaphone": [
        "088", "091", "094",
        "081", "082", "083", "084", "085",
    ],
    "vietnamobile": ["092", "056", "058"],
    "gmobile": ["099", "059"],
}

# Reverse lookup: prefix → carrier name
_PREFIX_TO_CARRIER: dict[str, str] = {}
for _carrier, _prefixes in CARRIER_PREFIXES.items():
    for _prefix in _prefixes:
        _PREFIX_TO_CARRIER[_prefix] = _carrier


@dataclass
class PhoneResult:
    """Result of VN phone normalization.

    Attributes:
        valid: Whether the phone number is a valid VN mobile number.
        e164: E.164 format (+84xxxxxxxxx). Empty string if invalid.
        local: Local format (0xxxxxxxxx). Empty string if invalid.
        display: Display format (0xxx xxx xxx). Empty string if invalid.
        sms_api: SMS API format (84xxxxxxxxx). Empty string if invalid.
        carrier: Carrier name (viettel, mobifone, etc.). Empty string if invalid.
        error_vi: Vietnamese error message if invalid, None if valid.
    """

    valid: bool
    e164: str
    local: str
    display: str
    sms_api: str
    carrier: str
    error_vi: str | None


def _strip_to_local(raw: str) -> str:
    """Strip non-digits and normalize to local 0-prefixed form.

    Steps:
        1. Strip all non-digit characters (except leading +)
        2. Handle +84 / 84 prefix → replace with 0
    """
    # Remove leading/trailing whitespace
    raw = raw.strip()

    # Handle +84 prefix before stripping non-digits
    if raw.startswith("+84"):
        raw = "0" + raw[3:]
    elif raw.startswith("84") and len(raw) > 2 and raw[2] != "0":
        # "84912345678" → "0912345678"
        # But avoid "840..." which is not a valid international format
        raw = "0" + raw[2:]

    # Strip all non-digit characters
    digits = re.sub(r"\D", "", raw)

    # After stripping, check if it started with 84 (from digits perspective)
    if len(digits) == 11 and digits.startswith("84"):
        digits = "0" + digits[2:]

    return digits


def normalize_phone(raw: str) -> PhoneResult:
    """Normalize any VN phone format to structured result.

    Handles formats: 0xx, +84xx, 84xx, with dots/dashes/spaces.

    Args:
        raw: Raw phone number string in any common format.

    Returns:
        PhoneResult with all format variants if valid,
        or with error_vi message if invalid.
    """
    if not raw or not raw.strip():
        return PhoneResult(
            valid=False,
            e164="",
            local="",
            display="",
            sms_api="",
            carrier="",
            error_vi="Số điện thoại không được để trống",
        )

    local = _strip_to_local(raw)

    # Validate length
    if len(local) != 10:
        return PhoneResult(
            valid=False,
            e164="",
            local="",
            display="",
            sms_api="",
            carrier="",
            error_vi="Số điện thoại phải có 10 chữ số",
        )

    # Validate starts with 0
    if not local.startswith("0"):
        return PhoneResult(
            valid=False,
            e164="",
            local="",
            display="",
            sms_api="",
            carrier="",
            error_vi="Số điện thoại Việt Nam phải bắt đầu bằng số 0",
        )

    # Get 3-digit prefix (e.g., "091")
    prefix = local[:3]
    carrier = _PREFIX_TO_CARRIER.get(prefix, "")

    if not carrier:
        return PhoneResult(
            valid=False,
            e164="",
            local="",
            display="",
            sms_api="",
            carrier="",
            error_vi=f"Đầu số {prefix} không phải là đầu số di động Việt Nam hợp lệ",
        )

    # Build all formats
    subscriber = local[1:]  # 9 digits without leading 0
    e164 = f"+84{subscriber}"
    sms_api = f"84{subscriber}"
    display = f"{local[:4]} {local[4:7]} {local[7:]}"

    return PhoneResult(
        valid=True,
        e164=e164,
        local=local,
        display=display,
        sms_api=sms_api,
        carrier=carrier,
        error_vi=None,
    )


def validate_phone(raw: str) -> bool:
    """Quick validation check for VN phone number.

    Args:
        raw: Raw phone number string.

    Returns:
        True if the number is a valid VN mobile number.
    """
    return normalize_phone(raw).valid


def detect_carrier(raw: str) -> str | None:
    """Detect carrier from phone number prefix.

    Args:
        raw: Raw phone number string in any format.

    Returns:
        Carrier name (e.g., "viettel", "mobifone") or None if invalid.
    """
    result = normalize_phone(raw)
    if result.valid:
        return result.carrier
    return None
