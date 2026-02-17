"""Tests for integration API authentication and authorization."""

import pytest
from tests.conftest import api_key_header


class TestAPIKeyAuthentication:

    def test_missing_api_key_returns_422(self, client):
        """Request without X-API-Key header should return 422."""
        resp = client.get("/api/v1/integration/points/20345678901")
        assert resp.status_code == 422

    def test_short_api_key_returns_401(self, client):
        """API key shorter than 8 chars should be rejected."""
        resp = client.get(
            "/api/v1/integration/points/20345678901",
            headers=api_key_header("short")
        )
        assert resp.status_code == 401
        assert "inválida" in resp.json()["detail"]

    def test_invalid_api_key_returns_401(self, client, sample_provider):
        """Wrong API key should return 401."""
        resp = client.get(
            "/api/v1/integration/points/20345678901",
            headers=api_key_header("this-is-a-totally-wrong-api-key-that-is-long-enough")
        )
        assert resp.status_code == 401

    def test_valid_api_key_authenticates(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Valid API key should authenticate and return data."""
        resp = client.get(
            f"/api/v1/integration/points/{sample_user.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 200

    def test_inactive_provider_returns_401(
        self, client, inactive_provider, sample_user
    ):
        """Inactive provider's API key should be rejected."""
        _, raw_key = inactive_provider
        resp = client.get(
            f"/api/v1/integration/points/{sample_user.cuil}",
            headers=api_key_header(raw_key)
        )
        assert resp.status_code == 401


class TestAccessControl:

    def test_user_not_found_returns_404(
        self, client, sample_provider, sample_api_key
    ):
        """Non-existent CUIL should return 404."""
        resp = client.get(
            "/api/v1/integration/points/99999999999",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 404
        assert "no encontrado" in resp.json()["detail"]

    def test_user_without_client_returns_403(
        self, client, sample_provider, sample_api_key, user_without_client
    ):
        """User not linked to any municipality should return 403."""
        resp = client.get(
            f"/api/v1/integration/points/{user_without_client.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 403
        assert "no vinculado" in resp.json()["detail"]

    def test_user_from_unauthorized_client_returns_403(
        self, client, sample_provider, sample_api_key, user_other_client
    ):
        """User from a client not linked to the provider should return 403."""
        resp = client.get(
            f"/api/v1/integration/points/{user_other_client.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 403
        assert "No tiene acceso" in resp.json()["detail"]
