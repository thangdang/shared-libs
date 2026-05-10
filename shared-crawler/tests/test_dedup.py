"""Unit tests for shared_crawler.dedup module."""

import pytest
from shared_crawler.dedup import URLDeduplicator


class TestURLNormalization:
    """Tests for URL normalization logic."""

    def setup_method(self):
        self.dedup = URLDeduplicator("redis://localhost:6379")

    def test_lowercase_scheme_and_host(self):
        """Scheme and host are lowercased."""
        result = self.dedup.normalize_url("HTTP://WWW.EXAMPLE.COM/path")
        assert result.startswith("http://www.example.com")

    def test_remove_trailing_slash(self):
        """Trailing slash is removed from path."""
        result = self.dedup.normalize_url("http://example.com/path/")
        assert result == "http://example.com/path"

    def test_root_path_preserved(self):
        """Root path (/) is preserved."""
        result = self.dedup.normalize_url("http://example.com/")
        assert result == "http://example.com/"

    def test_sort_query_params(self):
        """Query parameters are sorted alphabetically."""
        url1 = self.dedup.normalize_url("http://example.com/p?b=2&a=1")
        url2 = self.dedup.normalize_url("http://example.com/p?a=1&b=2")
        assert url1 == url2

    def test_remove_default_http_port(self):
        """Default HTTP port 80 is removed."""
        result = self.dedup.normalize_url("http://example.com:80/path")
        assert ":80" not in result

    def test_remove_default_https_port(self):
        """Default HTTPS port 443 is removed."""
        result = self.dedup.normalize_url("https://example.com:443/path")
        assert ":443" not in result

    def test_keep_non_default_port(self):
        """Non-default ports are preserved."""
        result = self.dedup.normalize_url("http://example.com:8080/path")
        assert ":8080" in result

    def test_remove_fragment(self):
        """URL fragments are removed."""
        result = self.dedup.normalize_url("http://example.com/path#section")
        assert "#" not in result


class TestURLHashing:
    """Tests for URL hashing."""

    def setup_method(self):
        self.dedup = URLDeduplicator("redis://localhost:6379")

    def test_same_url_same_hash(self):
        """Same URL produces same hash."""
        h1 = self.dedup.hash_url("http://example.com/path")
        h2 = self.dedup.hash_url("http://example.com/path")
        assert h1 == h2

    def test_normalized_variants_same_hash(self):
        """URL variants that normalize to same URL produce same hash."""
        h1 = self.dedup.hash_url("http://example.com/path?b=2&a=1")
        h2 = self.dedup.hash_url("http://example.com/path?a=1&b=2")
        assert h1 == h2

    def test_trailing_slash_variants_same_hash(self):
        """URLs with/without trailing slash produce same hash."""
        h1 = self.dedup.hash_url("http://example.com/path")
        h2 = self.dedup.hash_url("http://example.com/path/")
        assert h1 == h2

    def test_different_urls_different_hash(self):
        """Different URLs produce different hashes."""
        h1 = self.dedup.hash_url("http://example.com/path1")
        h2 = self.dedup.hash_url("http://example.com/path2")
        assert h1 != h2

    def test_hash_is_hex_string(self):
        """Hash is a valid hex string (SHA-256 = 64 chars)."""
        h = self.dedup.hash_url("http://example.com")
        assert len(h) == 64
        assert all(c in "0123456789abcdef" for c in h)
