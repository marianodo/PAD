"""Tests for GET /integration/points/{cuil} endpoint."""

import pytest
from tests.conftest import api_key_header


class TestGetPoints:

    def test_get_points_success(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Should return correct point balances."""
        resp = client.get(
            f"/api/v1/integration/points/{sample_user.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["cuil"] == sample_user.cuil
        assert data["total_points"] == 150
        assert data["available_points"] == 100
        assert data["redeemed_points"] == 50

    def test_get_points_user_without_points_record(
        self, client, db, sample_provider, sample_api_key, sample_user
    ):
        """User with no UserPoints record should return all zeros."""
        resp = client.get(
            f"/api/v1/integration/points/{sample_user.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["total_points"] == 0
        assert data["available_points"] == 0
        assert data["redeemed_points"] == 0

    def test_get_points_creates_audit_log(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Successful request should create an audit log entry."""
        from app.models.integration_audit import IntegrationAuditLog

        resp = client.get(
            f"/api/v1/integration/points/{sample_user.cuil}",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 200

        logs = db.query(IntegrationAuditLog).all()
        assert len(logs) == 1
        log = logs[0]
        assert log.provider_id == sample_provider.id
        assert log.cuil == sample_user.cuil
        assert log.response_status == 200
        assert log.endpoint == f"GET /points/{sample_user.cuil}"

    def test_get_points_failed_request_creates_audit_log(
        self, client, db, sample_provider, sample_api_key
    ):
        """Failed request (404) should also create an audit log entry."""
        from app.models.integration_audit import IntegrationAuditLog

        resp = client.get(
            "/api/v1/integration/points/99999999999",
            headers=api_key_header(sample_api_key)
        )
        assert resp.status_code == 404

        logs = db.query(IntegrationAuditLog).all()
        assert len(logs) == 1
        assert logs[0].response_status == 404
