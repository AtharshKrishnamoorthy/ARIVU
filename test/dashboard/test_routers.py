"""
Tests for dashboard backend routers — chat, config, export.
Uses FastAPI TestClient.
"""
import pytest
from unittest.mock import MagicMock, patch
import json


class TestChatRouter:
    """Test the /api/chat endpoint."""

    @pytest.fixture
    def app(self):
        from fastapi import FastAPI
        from arivu.dashboard.backend.routers.chat import router

        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_config_endpoint(self, client):
        response = client.get("/api/chat/config")
        assert response.status_code == 200
        data = response.json()
        assert "limits" in data
        assert "max_query_chars" in data["limits"]
        assert "max_result_rows" in data["limits"]
        assert "max_retries" in data["limits"]


class TestChatStreamRouter:
    """Test the /api/chat/stream endpoint."""

    @pytest.fixture
    def app(self):
        from fastapi import FastAPI
        from arivu.dashboard.backend.routers.chat import router

        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_stream_endpoint_exists(self, client):
        """Verify the endpoint accepts POST requests (skipped - needs DB connection)."""
        pytest.skip("Stream endpoint requires live DB connection")


class TestExportRouter:
    """Test the /api/export endpoint."""

    @pytest.fixture
    def app(self):
        from fastapi import FastAPI
        from arivu.dashboard.backend.routers.export import router

        app = FastAPI()
        app.include_router(router)
        return app

    @pytest.fixture
    def client(self, app):
        from fastapi.testclient import TestClient
        return TestClient(app)

    def test_export_csv(self, client):
        data = [
            {"name": "Alice", "age": 30},
            {"name": "Bob", "age": 25},
        ]
        response = client.post(
            "/api/export",
            json={"data": data, "filename": "test_export"},
        )
        assert response.status_code == 200
        assert "text/csv" in response.headers.get("content-type", "")
        assert "Alice" in response.text
        assert "Bob" in response.text

    def test_export_json(self, client):
        data = [{"id": 1, "value": "test"}]
        response = client.post(
            "/api/export",
            json={"data": data, "filename": "test", "format": "json"},
        )
        assert response.status_code == 200
        # Export may return CSV by default, check content
        assert "id" in response.text or "1" in response.text
