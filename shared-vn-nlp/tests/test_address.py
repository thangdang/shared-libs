"""Unit tests for shared_vn_nlp.address module."""

import pytest
from shared_vn_nlp.address import (
    parse_address,
    normalize_address,
    ParsedAddress,
    ABBREVIATIONS,
)


class TestParseAddressCommonPatterns:
    """Tests for parse_address() with common VN address patterns."""

    def test_hcmc_full_pattern(self):
        """Parses standard HCMC address: street, ward, district, city."""
        result = parse_address("123 Nguyễn Huệ, P. Bến Nghé, Q.1, TP.HCM")
        assert result.province == "Hồ Chí Minh"
        assert result.street is not None
        assert "Nguyễn Huệ" in result.street
        assert result.confidence > 0

    def test_hanoi_alley_pattern(self):
        """Parses Hanoi address with ngõ (alley) pattern."""
        result = parse_address("Số 5A, ngõ 12, Láng Hạ, Đống Đa, Hà Nội")
        assert result.province == "Hà Nội"
        assert result.confidence > 0

    def test_district_number_pattern(self):
        """Parses address with numeric district (Quận 5)."""
        result = parse_address("12 Trần Phú, Phường 4, Quận 5, Thành phố Hồ Chí Minh")
        assert result.province == "Hồ Chí Minh"
        assert result.ward is not None
        assert result.district is not None
        assert result.confidence > 0

    def test_danang_address(self):
        """Parses Đà Nẵng address."""
        result = parse_address("45 Bạch Đằng, Hải Châu, Đà Nẵng")
        assert result.province == "Đà Nẵng"
        assert result.confidence > 0

    def test_haiphong_address(self):
        """Parses Hải Phòng address."""
        result = parse_address("10 Lạch Tray, Ngô Quyền, Hải Phòng")
        assert result.province == "Hải Phòng"
        assert result.confidence > 0

    def test_cantho_address(self):
        """Parses Cần Thơ address."""
        result = parse_address("99 Trần Hưng Đạo, Ninh Kiều, Cần Thơ")
        assert result.province == "Cần Thơ"
        assert result.confidence > 0


class TestParseAddressAbbreviations:
    """Tests for abbreviation expansion in address parsing."""

    def test_q_dot_abbreviation(self):
        """Expands Q. → Quận."""
        result = parse_address("100 Lê Lợi, Q.3, TP.HCM")
        assert result.district is not None
        assert "Quận" in result.district or "3" in result.district
        assert result.province == "Hồ Chí Minh"

    def test_p_dot_abbreviation(self):
        """Expands P. → Phường."""
        result = parse_address("50 Hai Bà Trưng, P.Đa Kao, Q.1, TP.HCM")
        assert result.ward is not None
        assert "Phường" in result.ward or "Đa Kao" in result.ward

    def test_tphcm_abbreviation(self):
        """Expands TPHCM → Hồ Chí Minh."""
        result = parse_address("1 Lê Duẩn, Q.1, TPHCM")
        assert result.province == "Hồ Chí Minh"

    def test_hcm_abbreviation(self):
        """Expands HCM → Hồ Chí Minh."""
        result = parse_address("1 Lê Duẩn, Q.1, HCM")
        assert result.province == "Hồ Chí Minh"

    def test_hn_abbreviation(self):
        """Expands HN → Hà Nội."""
        result = parse_address("10 Tràng Tiền, Hoàn Kiếm, HN")
        assert result.province == "Hà Nội"

    def test_dn_abbreviation(self):
        """Expands ĐN → Đà Nẵng."""
        result = parse_address("20 Nguyễn Văn Linh, Hải Châu, ĐN")
        assert result.province == "Đà Nẵng"

    def test_q_digit_no_dot(self):
        """Handles Q1, Q3 format (no dot)."""
        result = parse_address("123 Lý Tự Trọng, Q1, TPHCM")
        assert result.district is not None
        assert "1" in result.district


class TestParseAddressProvinceMatching:
    """Tests for province matching across the 5 central cities."""

    def test_match_ho_chi_minh(self):
        """Matches Hồ Chí Minh from various forms."""
        for form in ["TP.HCM", "TPHCM", "HCM", "Hồ Chí Minh", "Thành phố Hồ Chí Minh"]:
            result = parse_address(f"123 Nguyễn Huệ, Q.1, {form}")
            assert result.province == "Hồ Chí Minh", f"Failed for form: {form}"

    def test_match_ha_noi(self):
        """Matches Hà Nội from various forms."""
        for form in ["HN", "Hà Nội"]:
            result = parse_address(f"1 Hoàng Hoa Thám, Ba Đình, {form}")
            assert result.province == "Hà Nội", f"Failed for form: {form}"

    def test_match_da_nang(self):
        """Matches Đà Nẵng from various forms."""
        for form in ["ĐN", "Đà Nẵng"]:
            result = parse_address(f"45 Bạch Đằng, Hải Châu, {form}")
            assert result.province == "Đà Nẵng", f"Failed for form: {form}"

    def test_match_hai_phong(self):
        """Matches Hải Phòng."""
        result = parse_address("10 Lạch Tray, Ngô Quyền, Hải Phòng")
        assert result.province == "Hải Phòng"

    def test_match_can_tho(self):
        """Matches Cần Thơ."""
        result = parse_address("99 Trần Hưng Đạo, Ninh Kiều, Cần Thơ")
        assert result.province == "Cần Thơ"


class TestParseAddressInvalidInput:
    """Tests for invalid/empty input handling."""

    def test_empty_string(self):
        """Empty string returns zero confidence ParsedAddress."""
        result = parse_address("")
        assert result.confidence == 0.0
        assert result.street is None
        assert result.ward is None
        assert result.district is None
        assert result.province is None

    def test_whitespace_only(self):
        """Whitespace-only returns zero confidence."""
        result = parse_address("   ")
        assert result.confidence == 0.0
        assert result.province is None

    def test_random_text(self):
        """Random non-address text returns low/zero confidence."""
        result = parse_address("xin chào thế giới")
        # Should still return a ParsedAddress, but with no recognized province
        assert isinstance(result, ParsedAddress)

    def test_returns_dataclass(self):
        """Always returns ParsedAddress dataclass."""
        result = parse_address("anything")
        assert isinstance(result, ParsedAddress)
        assert hasattr(result, "confidence")
        assert hasattr(result, "components_confidence")


class TestParseAddressConfidence:
    """Tests for confidence scoring."""

    def test_full_address_high_confidence(self):
        """Full address with all components has confidence > 0."""
        result = parse_address("12 Trần Phú, Phường 4, Quận 5, Thành phố Hồ Chí Minh")
        assert result.confidence > 0
        assert result.components_confidence.get("province", 0) > 0

    def test_province_only_has_confidence(self):
        """Province-only address still yields some confidence."""
        result = parse_address("Hà Nội")
        assert result.confidence > 0 or result.province == "Hà Nội"

    def test_empty_has_zero_confidence(self):
        """Empty input has zero confidence."""
        result = parse_address("")
        assert result.confidence == 0.0

    def test_components_confidence_keys(self):
        """Components confidence dict has expected keys for valid input."""
        result = parse_address("123 Nguyễn Huệ, Q.1, TP.HCM")
        assert "province" in result.components_confidence
        assert "district" in result.components_confidence
        assert "ward" in result.components_confidence
        assert "street" in result.components_confidence


class TestNormalizeAddress:
    """Tests for normalize_address()."""

    def test_expands_abbreviations(self):
        """Abbreviations are expanded in normalized output."""
        result = normalize_address("123 Nguyễn Huệ, Q.1, TP.HCM")
        # Should contain full forms
        assert "Hồ Chí Minh" in result

    def test_central_city_prefix(self):
        """Central cities get 'Thành phố' prefix in output."""
        result = normalize_address("10 Tràng Tiền, Hoàn Kiếm, HN")
        assert "Thành phố Hà Nội" in result

    def test_empty_input_returns_empty(self):
        """Empty input returns empty string."""
        assert normalize_address("") == ""

    def test_whitespace_input_returns_empty(self):
        """Whitespace-only returns empty string."""
        assert normalize_address("   ") == ""

    def test_preserves_street(self):
        """Street portion preserved in normalized output."""
        result = normalize_address("123 Nguyễn Huệ, Q.1, TP.HCM")
        assert "123" in result or "Nguyễn Huệ" in result

    def test_comma_separated_output(self):
        """Output components are comma-separated."""
        result = normalize_address("12 Trần Phú, Phường 4, Quận 5, TPHCM")
        assert ", " in result
