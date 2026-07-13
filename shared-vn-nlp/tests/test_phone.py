"""Unit tests for shared_vn_nlp.phone module."""

import pytest
from shared_vn_nlp.phone import (
    normalize_phone,
    validate_phone,
    detect_carrier,
    PhoneResult,
    CARRIER_PREFIXES,
)


class TestNormalizePhone:
    """Tests for normalize_phone()."""

    def test_local_format(self):
        """Normalizes standard local format (0xxxxxxxxx)."""
        result = normalize_phone("0912345678")
        assert result.valid is True
        assert result.e164 == "+84912345678"
        assert result.local == "0912345678"
        assert result.sms_api == "84912345678"
        assert result.display == "0912 345 678"
        assert result.error_vi is None

    def test_international_plus84(self):
        """Normalizes +84 international format."""
        result = normalize_phone("+84912345678")
        assert result.valid is True
        assert result.local == "0912345678"
        assert result.e164 == "+84912345678"

    def test_international_84_no_plus(self):
        """Normalizes 84xxx format without plus sign."""
        result = normalize_phone("84912345678")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_dots_separator(self):
        """Normalizes phone with dot separators."""
        result = normalize_phone("0912.345.678")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_dash_separator(self):
        """Normalizes phone with dash separators."""
        result = normalize_phone("0912-345-678")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_space_separator(self):
        """Normalizes phone with space separators."""
        result = normalize_phone("0912 345 678")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_mixed_separators(self):
        """Normalizes phone with mixed separators."""
        result = normalize_phone("091-234.56 78")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_international_with_spaces(self):
        """Normalizes +84 format with spaces."""
        result = normalize_phone("+84 912 345 678")
        assert result.valid is True
        assert result.local == "0912345678"

    def test_empty_string(self):
        """Empty string returns invalid with error."""
        result = normalize_phone("")
        assert result.valid is False
        assert result.error_vi == "Số điện thoại không được để trống"

    def test_whitespace_only(self):
        """Whitespace-only returns invalid with error."""
        result = normalize_phone("   ")
        assert result.valid is False
        assert result.error_vi == "Số điện thoại không được để trống"

    def test_wrong_length_short(self):
        """Too short number returns invalid."""
        result = normalize_phone("091234")
        assert result.valid is False
        assert "10 chữ số" in result.error_vi

    def test_wrong_length_long(self):
        """Too long number returns invalid."""
        result = normalize_phone("09123456789")
        assert result.valid is False
        assert "10 chữ số" in result.error_vi

    def test_invalid_prefix(self):
        """Non-VN mobile prefix returns invalid."""
        result = normalize_phone("0112345678")
        assert result.valid is False
        assert "đầu số" in result.error_vi.lower()

    def test_display_format_structure(self):
        """Display format is 0xxx xxx xxx."""
        result = normalize_phone("0386123456")
        assert result.display == "0386 123 456"

    def test_returns_dataclass(self):
        """Returns PhoneResult dataclass."""
        result = normalize_phone("0912345678")
        assert isinstance(result, PhoneResult)


class TestNormalizePhoneCarriers:
    """Tests for carrier detection via normalize_phone()."""

    def test_viettel_096(self):
        """Detects Viettel from 096 prefix."""
        result = normalize_phone("0961234567")
        assert result.carrier == "viettel"

    def test_viettel_032(self):
        """Detects Viettel from 032 prefix."""
        result = normalize_phone("0321234567")
        assert result.carrier == "viettel"

    def test_mobifone_090(self):
        """Detects Mobifone from 090 prefix."""
        result = normalize_phone("0901234567")
        assert result.carrier == "mobifone"

    def test_mobifone_076(self):
        """Detects Mobifone from 076 prefix."""
        result = normalize_phone("0761234567")
        assert result.carrier == "mobifone"

    def test_vinaphone_091(self):
        """Detects Vinaphone from 091 prefix."""
        result = normalize_phone("0911234567")
        assert result.carrier == "vinaphone"

    def test_vinaphone_084(self):
        """Detects Vinaphone from 084 prefix."""
        result = normalize_phone("0841234567")
        assert result.carrier == "vinaphone"

    def test_vietnamobile_092(self):
        """Detects Vietnamobile from 092 prefix."""
        result = normalize_phone("0921234567")
        assert result.carrier == "vietnamobile"

    def test_gmobile_099(self):
        """Detects Gmobile from 099 prefix."""
        result = normalize_phone("0991234567")
        assert result.carrier == "gmobile"


class TestValidatePhone:
    """Tests for validate_phone()."""

    def test_valid_number(self):
        """Returns True for valid VN number."""
        assert validate_phone("0912345678") is True

    def test_valid_international(self):
        """Returns True for valid +84 format."""
        assert validate_phone("+84912345678") is True

    def test_invalid_empty(self):
        """Returns False for empty string."""
        assert validate_phone("") is False

    def test_invalid_prefix(self):
        """Returns False for invalid prefix."""
        assert validate_phone("0112345678") is False

    def test_invalid_length(self):
        """Returns False for wrong length."""
        assert validate_phone("091234") is False


class TestDetectCarrier:
    """Tests for detect_carrier()."""

    def test_detect_viettel(self):
        """Detects Viettel carrier."""
        assert detect_carrier("0961234567") == "viettel"

    def test_detect_mobifone(self):
        """Detects Mobifone carrier."""
        assert detect_carrier("0901234567") == "mobifone"

    def test_detect_vinaphone(self):
        """Detects Vinaphone carrier."""
        assert detect_carrier("0911234567") == "vinaphone"

    def test_detect_vietnamobile(self):
        """Detects Vietnamobile carrier."""
        assert detect_carrier("0921234567") == "vietnamobile"

    def test_detect_gmobile(self):
        """Detects Gmobile carrier."""
        assert detect_carrier("0991234567") == "gmobile"

    def test_detect_from_international(self):
        """Detects carrier from +84 format."""
        assert detect_carrier("+84961234567") == "viettel"

    def test_invalid_returns_none(self):
        """Returns None for invalid number."""
        assert detect_carrier("0112345678") is None

    def test_empty_returns_none(self):
        """Returns None for empty string."""
        assert detect_carrier("") is None

    def test_detect_from_dotted_format(self):
        """Detects carrier from dotted format."""
        assert detect_carrier("0912.345.678") == "vinaphone"

    def test_detect_gmobile_059(self):
        """Detects Gmobile from 059 prefix."""
        assert detect_carrier("0591234567") == "gmobile"

    def test_detect_vietnamobile_056(self):
        """Detects Vietnamobile from 056 prefix."""
        assert detect_carrier("0561234567") == "vietnamobile"


class TestPhoneErrorMessages:
    """Tests that error messages are in Vietnamese."""

    def test_empty_error_is_vietnamese(self):
        """Empty phone error message is in Vietnamese."""
        result = normalize_phone("")
        assert result.error_vi is not None
        assert "không được để trống" in result.error_vi

    def test_wrong_length_error_is_vietnamese(self):
        """Wrong length error message is in Vietnamese."""
        result = normalize_phone("0912")
        assert result.error_vi is not None
        assert "chữ số" in result.error_vi

    def test_invalid_prefix_error_is_vietnamese(self):
        """Invalid prefix error message is in Vietnamese."""
        result = normalize_phone("0112345678")
        assert result.error_vi is not None
        assert "đầu số" in result.error_vi.lower()
        assert "hợp lệ" in result.error_vi

    def test_valid_has_no_error(self):
        """Valid phone number has no error message."""
        result = normalize_phone("0912345678")
        assert result.error_vi is None

    def test_non_vn_country_code(self):
        """Non-VN country code prefix treated as invalid."""
        result = normalize_phone("+1234567890")
        assert result.valid is False

    def test_all_zeros(self):
        """All zeros is invalid (no valid carrier prefix)."""
        result = normalize_phone("0000000000")
        assert result.valid is False

    def test_alphabetic_input(self):
        """Alphabetic input is invalid."""
        result = normalize_phone("abcdefghij")
        assert result.valid is False
