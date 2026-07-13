"""Unit tests for shared_vn_nlp.currency module."""

import pytest
from shared_vn_nlp.currency import format_vnd, format_compact, parse_vnd, format_range


class TestFormatVnd:
    """Tests for format_vnd() — standard VND display formatting."""

    def test_small_amount(self):
        """Formats small amount with dot separator."""
        assert format_vnd(5000) == "5.000đ"

    def test_medium_amount(self):
        """Formats typical product price."""
        assert format_vnd(79000) == "79.000đ"

    def test_large_amount(self):
        """Formats million-range amount."""
        assert format_vnd(1500000) == "1.500.000đ"

    def test_billion_amount(self):
        """Formats billion-range amount."""
        assert format_vnd(2000000000) == "2.000.000.000đ"

    def test_zero(self):
        """Formats zero."""
        assert format_vnd(0) == "0đ"

    def test_under_thousand(self):
        """Formats amount under 1000 (no separator needed)."""
        assert format_vnd(500) == "500đ"

    def test_exact_thousand(self):
        """Formats exactly 1000."""
        assert format_vnd(1000) == "1.000đ"

    def test_float_input(self):
        """Handles float input by truncating to int."""
        assert format_vnd(79000.5) == "79.000đ"

    def test_ten_million(self):
        """Formats ten million amount."""
        assert format_vnd(25000000) == "25.000.000đ"


class TestFormatCompact:
    """Tests for format_compact() — compact VND display."""

    # K (nghìn) threshold tests
    def test_compact_5k(self):
        """Formats 5000 as 5K."""
        assert format_compact(5000) == "5K"

    def test_compact_79k(self):
        """Formats 79000 as 79K."""
        assert format_compact(79000) == "79K"

    def test_compact_150k(self):
        """Formats 150000 as 150K."""
        assert format_compact(150000) == "150K"

    def test_compact_999k(self):
        """Formats 999000 as 999K."""
        assert format_compact(999000) == "999K"

    # tr (triệu) threshold tests
    def test_compact_1_5_million(self):
        """Formats 1.5 million with comma decimal."""
        assert format_compact(1500000) == "1,5tr"

    def test_compact_exact_million(self):
        """Formats exact million without decimal."""
        assert format_compact(1000000) == "1tr"

    def test_compact_25_million(self):
        """Formats 25 million."""
        assert format_compact(25000000) == "25tr"

    def test_compact_2_3_million(self):
        """Formats 2.3 million with comma decimal."""
        assert format_compact(2300000) == "2,3tr"

    # tỷ threshold tests
    def test_compact_2_billion(self):
        """Formats 2 billion as tỷ."""
        assert format_compact(2000000000) == "2 tỷ"

    def test_compact_1_5_billion(self):
        """Formats 1.5 billion with comma decimal."""
        assert format_compact(1500000000) == "1,5 tỷ"

    def test_compact_exact_billion(self):
        """Formats exact 1 billion without decimal."""
        assert format_compact(1000000000) == "1 tỷ"

    # Below 1000
    def test_compact_below_thousand(self):
        """Formats amount below 1000 with đ suffix."""
        assert format_compact(500) == "500đ"

    def test_compact_zero(self):
        """Formats zero."""
        assert format_compact(0) == "0đ"

    # Boundary cases
    def test_boundary_thousand(self):
        """At exactly 1000 — should be 1K."""
        assert format_compact(1000) == "1K"

    def test_boundary_million(self):
        """At exactly 1,000,000 — should be 1tr."""
        assert format_compact(1000000) == "1tr"

    def test_boundary_billion(self):
        """At exactly 1,000,000,000 — should be 1 tỷ."""
        assert format_compact(1000000000) == "1 tỷ"


class TestParseVnd:
    """Tests for parse_vnd() — parsing VND strings back to numbers."""

    # đ suffix patterns
    def test_parse_dong_suffix_small(self):
        """Parses '500đ' → 500."""
        assert parse_vnd("500đ") == 500

    def test_parse_dong_suffix_thousands(self):
        """Parses '79.000đ' with dot separator."""
        assert parse_vnd("79.000đ") == 79000

    def test_parse_dong_suffix_millions(self):
        """Parses '1.500.000đ'."""
        assert parse_vnd("1.500.000đ") == 1500000

    # VND suffix patterns
    def test_parse_vnd_suffix_comma_sep(self):
        """Parses '79,000 VND' with comma as thousands separator."""
        assert parse_vnd("79,000 VND") == 79000

    def test_parse_vnd_suffix_dot_sep(self):
        """Parses '79.000 VND' with dot as thousands separator."""
        assert parse_vnd("79.000 VND") == 79000

    def test_parse_vnd_suffix_large(self):
        """Parses '1,500,000 VND'."""
        assert parse_vnd("1,500,000 VND") == 1500000

    # K (nghìn) patterns
    def test_parse_k_uppercase(self):
        """Parses '79K' → 79000."""
        assert parse_vnd("79K") == 79000

    def test_parse_k_lowercase(self):
        """Parses '79k' → 79000."""
        assert parse_vnd("79k") == 79000

    def test_parse_k_decimal(self):
        """Parses '1,5K' (1.5 thousand) → 1500."""
        assert parse_vnd("1,5K") == 1500

    # triệu/tr patterns
    def test_parse_trieu_full(self):
        """Parses '1,5 triệu' → 1500000."""
        assert parse_vnd("1,5 triệu") == 1500000

    def test_parse_trieu_abbrev(self):
        """Parses '1,5tr' → 1500000."""
        assert parse_vnd("1,5tr") == 1500000

    def test_parse_trieu_dot_decimal(self):
        """Parses '1.5tr' (dot as decimal) → 1500000."""
        assert parse_vnd("1.5tr") == 1500000

    def test_parse_trieu_whole(self):
        """Parses '25tr' → 25000000."""
        assert parse_vnd("25tr") == 25000000

    def test_parse_trieu_with_space(self):
        """Parses '1,5 triệu' with space."""
        assert parse_vnd("1,5 triệu") == 1500000

    # tỷ patterns
    def test_parse_ty(self):
        """Parses '2 tỷ' → 2000000000."""
        assert parse_vnd("2 tỷ") == 2000000000

    def test_parse_ty_decimal(self):
        """Parses '1,5 tỷ' → 1500000000."""
        assert parse_vnd("1,5 tỷ") == 1500000000

    # Plain numbers
    def test_parse_plain_integer(self):
        """Parses plain integer string '79000'."""
        assert parse_vnd("79000") == 79000

    def test_parse_plain_dotted(self):
        """Parses plain number with dot separator '79.000'."""
        assert parse_vnd("79.000") == 79000

    # Edge cases
    def test_parse_empty_string(self):
        """Empty string returns None."""
        assert parse_vnd("") is None

    def test_parse_whitespace_only(self):
        """Whitespace-only returns None."""
        assert parse_vnd("   ") is None

    def test_parse_invalid_text(self):
        """Non-numeric text returns None."""
        assert parse_vnd("abc") is None

    def test_parse_with_leading_trailing_spaces(self):
        """Handles leading/trailing whitespace."""
        assert parse_vnd("  79.000đ  ") == 79000

    def test_parse_mixed_invalid(self):
        """Random symbols return None."""
        assert parse_vnd("@#$%") is None


class TestFormatRange:
    """Tests for format_range() — price range formatting."""

    def test_range_k_to_k(self):
        """Formats K-range to K-range."""
        assert format_range(50000, 200000) == "50K – 200K"

    def test_range_tr_to_tr(self):
        """Formats triệu-range to triệu-range."""
        assert format_range(1500000, 3000000) == "1,5tr – 3tr"

    def test_range_mixed_k_tr(self):
        """Formats mixed K-range to triệu-range."""
        assert format_range(500000, 2000000) == "500K – 2tr"

    def test_range_same_value(self):
        """Formats range with same low and high."""
        assert format_range(100000, 100000) == "100K – 100K"

    def test_range_ty(self):
        """Formats tỷ-range."""
        assert format_range(1000000000, 2000000000) == "1 tỷ – 2 tỷ"

    def test_range_small_amounts(self):
        """Formats small amounts in range."""
        assert format_range(5000, 10000) == "5K – 10K"
