"""Unit tests for shared_vn_nlp.provinces module."""

import pytest
from shared_vn_nlp.provinces import detect_provinces, get_all_provinces, ProvinceMatch


class TestDetectProvinces:
    """Tests for province detection."""

    def test_detect_official_name(self):
        """Detects province by official name."""
        result = detect_provinces("Tôi sống ở Hà Nội")
        assert len(result) >= 1
        match = result[0]
        assert isinstance(match, ProvinceMatch)
        assert match.name == "Hà Nội"
        assert match.region == "Đồng bằng sông Hồng"

    def test_detect_alternate_name(self):
        """Detects province by alternate name (Sài Gòn → Hồ Chí Minh)."""
        result = detect_provinces("Sài Gòn đẹp lắm")
        assert len(result) >= 1
        assert result[0].name == "Hồ Chí Minh"
        assert result[0].matched_text == "Sài Gòn"

    def test_detect_no_diacritics_alternate(self):
        """Detects province by non-diacritics alternate name."""
        result = detect_provinces("I visited Da Nang last week")
        assert len(result) >= 1
        assert result[0].name == "Đà Nẵng"

    def test_detect_multiple_provinces(self):
        """Detects multiple provinces in one text."""
        result = detect_provinces("Đi từ Hà Nội vào Đà Nẵng")
        names = [m.name for m in result]
        assert "Hà Nội" in names
        assert "Đà Nẵng" in names

    def test_detect_empty_string(self):
        """Empty string returns empty list."""
        assert detect_provinces("") == []

    def test_detect_whitespace_only(self):
        """Whitespace-only string returns empty list."""
        assert detect_provinces("   ") == []

    def test_detect_no_province(self):
        """Text without province mentions returns empty list."""
        assert detect_provinces("Hôm nay trời đẹp") == []

    def test_match_has_position(self):
        """ProvinceMatch includes correct start/end positions."""
        text = "Tôi ở Hà Nội"
        result = detect_provinces(text)
        assert len(result) >= 1
        match = result[0]
        assert text[match.start:match.end] == match.matched_text

    def test_case_insensitive(self):
        """Detection is case-insensitive."""
        result = detect_provinces("tôi thích hà nội")
        assert len(result) >= 1
        assert result[0].name == "Hà Nội"

    def test_city_alternate_nha_trang(self):
        """Detects city alternate names (Nha Trang → Khánh Hòa)."""
        result = detect_provinces("Du lịch Nha Trang")
        assert len(result) >= 1
        assert result[0].name == "Khánh Hòa"


class TestGetAllProvinces:
    """Tests for get_all_provinces."""

    def test_returns_63_provinces(self):
        """Returns all 63 Vietnamese provinces."""
        result = get_all_provinces()
        assert len(result) == 63

    def test_province_has_required_fields(self):
        """Each province has name, alternates, region, code."""
        result = get_all_provinces()
        for prov in result:
            assert "name" in prov
            assert "alternates" in prov
            assert "region" in prov
            assert "code" in prov

    def test_returns_list_of_dicts(self):
        """Returns a list of dictionaries."""
        result = get_all_provinces()
        assert isinstance(result, list)
        for item in result:
            assert isinstance(item, dict)
