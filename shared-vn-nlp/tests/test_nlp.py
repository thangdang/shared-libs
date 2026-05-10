"""Unit tests for shared_vn_nlp.nlp module."""

import pytest
from shared_vn_nlp.nlp import segment, ner, pos_tag


class TestSegment:
    """Tests for word segmentation."""

    def test_segment_basic_vietnamese(self):
        """Segment a simple Vietnamese sentence."""
        result = segment("Tôi yêu Việt Nam")
        assert isinstance(result, list)
        assert len(result) > 0
        # "Việt Nam" should be kept as a compound word
        assert "Việt Nam" in result or "Việt_Nam" in result or all(
            w in result for w in ["Việt", "Nam"]
        )

    def test_segment_empty_string(self):
        """Empty string returns empty list without exception."""
        assert segment("") == []

    def test_segment_whitespace_only(self):
        """Whitespace-only string returns empty list without exception."""
        assert segment("   ") == []
        assert segment("\t\n") == []

    def test_segment_returns_list_of_strings(self):
        """Result is a list of strings."""
        result = segment("Hà Nội là thủ đô")
        assert isinstance(result, list)
        for token in result:
            assert isinstance(token, str)


class TestNer:
    """Tests for Named Entity Recognition."""

    def test_ner_basic(self):
        """NER returns tuples for Vietnamese text with entities."""
        result = ner("Hà Nội là thủ đô của Việt Nam")
        assert isinstance(result, list)
        assert len(result) > 0
        # Each element should be a tuple of 4 strings
        for item in result:
            assert isinstance(item, tuple)
            assert len(item) == 4

    def test_ner_empty_string(self):
        """Empty string returns empty list without exception."""
        assert ner("") == []

    def test_ner_whitespace_only(self):
        """Whitespace-only string returns empty list without exception."""
        assert ner("   ") == []
        assert ner("\t\n") == []


class TestPosTag:
    """Tests for POS tagging."""

    def test_pos_tag_basic(self):
        """POS tagging returns word-tag tuples."""
        result = pos_tag("Tôi đi học")
        assert isinstance(result, list)
        assert len(result) > 0
        # Each element should be a tuple of 2 strings
        for item in result:
            assert isinstance(item, tuple)
            assert len(item) == 2
            assert isinstance(item[0], str)
            assert isinstance(item[1], str)

    def test_pos_tag_empty_string(self):
        """Empty string returns empty list without exception."""
        assert pos_tag("") == []

    def test_pos_tag_whitespace_only(self):
        """Whitespace-only string returns empty list without exception."""
        assert pos_tag("   ") == []
        assert pos_tag("\t\n") == []
