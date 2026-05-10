"""Unit tests for product_linker.api module."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from fastapi.testclient import TestClient


class TestHealthEndpoint:
    """Tests for /api/health endpoint."""

    def test_health_returns_200(self):
        """Health endpoint returns 200."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data
        assert data["service"] == "product-linker"

    def test_health_shows_port(self):
        """Health endpoint shows configured port."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.get("/api/health")
        data = response.json()
        assert "port" in data


class TestLinkEndpoint:
    """Tests for /api/link endpoint."""

    def test_link_accepts_post(self):
        """Link endpoint accepts POST with text body."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.post(
            "/api/link",
            json={"text": "Test text", "source_engine": "test"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "mentions" in data
        assert "processing_time_ms" in data

    def test_link_returns_empty_when_no_detector(self):
        """Returns empty mentions when detector is not initialized."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.post("/api/link", json={"text": "iPhone 15"})
        data = response.json()
        assert data["mentions"] == []

    def test_link_validates_request(self):
        """Returns 422 for invalid request body."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.post("/api/link", json={})
        assert response.status_code == 422


class TestCatalogStatsEndpoint:
    """Tests for /api/catalog/stats endpoint."""

    def test_catalog_stats_returns_200(self):
        """Catalog stats endpoint returns 200."""
        from product_linker.api import app
        client = TestClient(app)
        response = client.get("/api/catalog/stats")
        assert response.status_code == 200
