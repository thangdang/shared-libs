"""Unit tests for shared_vn_nlp.slang module."""

import pytest
from shared_vn_nlp.slang import load_slang_dict, normalize_slang


class TestLoadSlangDict:
    """Tests for slang dictionary loading."""

    def test_load_returns_dict(self):
        """load_slang_dict returns a dictionary."""
        result = load_slang_dict()
        assert isinstance(result, dict)

    def test_load_has_minimum_entries(self):
        """Dictionary contains at least 100 entries."""
        result = load_slang_dict()
        assert len(result) >= 100

    def test_load_keys_are_lowercase(self):
        """All keys in the loaded dict are lowercase."""
        result = load_slang_dict()
        for key in result:
            assert key == key.lower()

    def test_known_entries_exist(self):
        """Known slang entries are present."""
        result = load_slang_dict()
        assert result["ko"] == "không"
        assert result["dc"] == "được"
        assert result["vs"] == "với"
        assert result["bt"] == "bình thường"


class TestNormalizeSlang:
    """Tests for slang normalization."""

    def test_basic_expansion(self):
        """Known slang abbreviations are expanded."""
        assert "không" in normalize_slang("ko biết")
        assert "được" in normalize_slang("dc rồi")

    def test_case_insensitive_matching(self):
        """Slang matching is case-insensitive."""
        result_lower = normalize_slang("ko biết")
        result_upper = normalize_slang("KO biết")
        result_mixed = normalize_slang("Ko biết")
        # All should expand "ko"/"KO"/"Ko" to "không"
        assert "không" in result_lower
        assert "không" in result_upper
        assert "không" in result_mixed

    def test_preserves_non_slang_casing(self):
        """Non-slang text preserves its original casing."""
        result = normalize_slang("Tôi ko biết")
        assert result.startswith("Tôi")

    def test_empty_string(self):
        """Empty string returns empty string."""
        assert normalize_slang("") == ""

    def test_no_slang_unchanged(self):
        """Text without slang is returned unchanged."""
        text = "Tôi đi học ở trường"
        assert normalize_slang(text) == text

    def test_idempotence(self):
        """Normalizing twice produces same result as normalizing once."""
        texts = [
            "ko biết dc",
            "Tôi ko thích",
            "bt thôi",
            "Hello world",
            "",
        ]
        for text in texts:
            once = normalize_slang(text)
            twice = normalize_slang(once)
            assert once == twice, f"Not idempotent for: {text!r}"

    def test_multiple_slang_in_one_text(self):
        """Multiple slang terms in one text are all expanded."""
        result = normalize_slang("ko dc bt")
        assert "không" in result
        assert "được" in result
        assert "bình thường" in result

    def test_slang_not_matched_within_words(self):
        """Slang patterns should not match within larger words."""
        # "ko" should not match inside "không" (which is the expansion)
        text = "không biết"
        assert normalize_slang(text) == text
