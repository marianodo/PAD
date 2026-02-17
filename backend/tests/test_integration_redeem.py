"""Tests for POST /integration/points/redeem endpoint."""

import uuid

import pytest
from app.models.points import UserPoints, PointTransaction
from tests.conftest import api_key_header


class TestRedeemPoints:

    def _redeem_payload(self, cuil="20345678901", points=30, ref_id=None, description=None):
        payload = {
            "cuil": cuil,
            "points": points,
            "reference_id": ref_id or f"REF-{uuid.uuid4().hex[:12]}",
        }
        if description:
            payload["description"] = description
        return payload

    def test_redeem_success(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Successful redeem should deduct points and create transaction."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=30)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["cuil"] == sample_user.cuil
        assert data["points_redeemed"] == 30
        assert data["available_points"] == 70  # 100 - 30
        assert data["reference_id"] == payload["reference_id"]
        assert data["already_processed"] is False
        assert "transaction_id" in data

    def test_redeem_updates_user_points(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Redeem should update UserPoints balances in the database."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=25)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200

        db.refresh(sample_user_points)
        assert sample_user_points.available_points == 75  # 100 - 25
        assert sample_user_points.redeemed_points == 75  # 50 + 25
        assert sample_user_points.total_points == 150  # unchanged

    def test_redeem_creates_transaction(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Redeem should create a PointTransaction record."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=20)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200

        tx = db.query(PointTransaction).filter(
            PointTransaction.reference_id == payload["reference_id"]
        ).first()
        assert tx is not None
        assert tx.user_id == sample_user.id
        assert tx.transaction_type == "redeemed"
        assert tx.amount == -20
        assert tx.reference_id == payload["reference_id"]

    def test_redeem_insufficient_points_returns_400(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Trying to redeem more than available should return 400."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=999)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 400
        assert "insuficientes" in resp.json()["detail"]

    def test_redeem_zero_points_returns_422(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Zero points should be rejected by Pydantic validation (gt=0)."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=0)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 422

    def test_redeem_negative_points_returns_422(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Negative points should be rejected by Pydantic validation."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=-10)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 422

    def test_redeem_exact_available_points(
        self, client, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Redeeming exactly all available points should succeed."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=100)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["available_points"] == 0
        assert data["points_redeemed"] == 100

    def test_redeem_user_no_points_record_returns_400(
        self, client, sample_provider, sample_api_key, sample_user
    ):
        """User with no UserPoints record should return 400."""
        payload = self._redeem_payload(cuil=sample_user.cuil, points=10)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 400
        assert "insuficientes" in resp.json()["detail"]

    def test_redeem_with_description(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Description should be saved in the transaction."""
        payload = self._redeem_payload(
            cuil=sample_user.cuil, points=10, description="Pago tasa Feb 2026"
        )

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200

        tx = db.query(PointTransaction).filter(
            PointTransaction.reference_id == payload["reference_id"]
        ).first()
        assert tx.description == "Pago tasa Feb 2026"

    def test_redeem_creates_audit_log(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Successful redeem should create an audit log entry."""
        from app.models.integration_audit import IntegrationAuditLog

        payload = self._redeem_payload(cuil=sample_user.cuil, points=10)

        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 200

        logs = db.query(IntegrationAuditLog).all()
        assert len(logs) == 1
        log = logs[0]
        assert log.endpoint == "POST /points/redeem"
        assert log.response_status == 200
        assert log.cuil == sample_user.cuil

    def test_redeem_invalid_cuil_format_returns_422(
        self, client, sample_provider, sample_api_key
    ):
        """CUIL with wrong format should be rejected by Pydantic."""
        payload = {
            "cuil": "ABC",
            "points": 10,
            "reference_id": "ref-test",
        }
        resp = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp.status_code == 422


class TestIdempotency:

    def test_duplicate_reference_id_returns_original(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Second request with same reference_id should return original transaction."""
        payload = {
            "cuil": sample_user.cuil,
            "points": 20,
            "reference_id": "PAGO-UNICO-001",
        }

        # First request
        resp1 = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp1.status_code == 200
        data1 = resp1.json()
        assert data1["already_processed"] is False
        assert data1["available_points"] == 80

        # Second request with same reference_id
        resp2 = client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )
        assert resp2.status_code == 200
        data2 = resp2.json()
        assert data2["already_processed"] is True
        assert data2["transaction_id"] == data1["transaction_id"]

    def test_duplicate_does_not_deduct_points_again(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Duplicate request should NOT deduct points a second time."""
        payload = {
            "cuil": sample_user.cuil,
            "points": 30,
            "reference_id": "PAGO-DUP-001",
        }

        # First request
        client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )

        # Second request
        client.post(
            "/api/v1/integration/points/redeem",
            json=payload,
            headers=api_key_header(sample_api_key),
        )

        db.refresh(sample_user_points)
        assert sample_user_points.available_points == 70  # 100 - 30, NOT 100 - 60
        assert sample_user_points.redeemed_points == 80  # 50 + 30, NOT 50 + 60

    def test_different_reference_ids_create_separate_transactions(
        self, client, db, sample_provider, sample_api_key, sample_user, sample_user_points
    ):
        """Different reference_ids should create separate transactions."""
        for i in range(3):
            payload = {
                "cuil": sample_user.cuil,
                "points": 10,
                "reference_id": f"PAGO-{i}",
            }
            resp = client.post(
                "/api/v1/integration/points/redeem",
                json=payload,
                headers=api_key_header(sample_api_key),
            )
            assert resp.status_code == 200
            assert resp.json()["already_processed"] is False

        transactions = db.query(PointTransaction).filter(
            PointTransaction.transaction_type == "redeemed"
        ).all()
        assert len(transactions) == 3

        db.refresh(sample_user_points)
        assert sample_user_points.available_points == 70  # 100 - 30
