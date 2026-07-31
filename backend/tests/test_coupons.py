"""Tests de generación y consumo de cupones.

Nota sobre concurrencia: los tests corren sobre SQLite, donde with_for_update()
es un no-op. El doble consumo se testea contra la revalidación de estado, que es
la garantía lógica; el lock de fila que evita la carrera real solo se ejerce en
Postgres y no se puede cubrir acá.
"""

import uuid
from datetime import datetime, timedelta, timezone
from decimal import Decimal

import pytest

from app.core.security import create_access_token
from app.models.coupon import (
    Coupon,
    CouponReward,
    COUPON_ACTIVE,
    COUPON_REDEEMED,
    COUPON_EXPIRED,
    COUPON_CODE_ALPHABET,
    COUPON_CODE_LENGTH,
    COUPON_EXPIRY_DAYS,
)
from app.models.merchant import (
    Merchant,
    MERCHANT_APPROVED,
    MERCHANT_PENDING,
)
from app.models.points import PointTransaction, UserPoints
from app.core.security import get_password_hash


API = "/api/v1"


# --- Helpers y fixtures ---

def _citizen_header(user) -> dict:
    token = create_access_token(data={"sub": str(user.id), "account_type": "user"})
    return {"Authorization": f"Bearer {token}"}


def _merchant_header(merchant) -> dict:
    token = create_access_token(
        data={"sub": str(merchant.id), "account_type": "merchant"}
    )
    return {"Authorization": f"Bearer {token}"}


def _make_merchant(db, client_obj, status=MERCHANT_APPROVED, email=None) -> Merchant:
    m = Merchant(
        id=uuid.uuid4(),
        client_id=client_obj.id,
        email=email or f"comercio-{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("comercio123"),
        name="Almacén de Prueba",
        status=status,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def _make_reward(db, client_obj, points_cost=100, discount_pct=5) -> CouponReward:
    r = CouponReward(
        id=uuid.uuid4(),
        client_id=client_obj.id,
        name=f"{discount_pct}% de descuento",
        points_cost=points_cost,
        discount_pct=Decimal(str(discount_pct)),
        is_active=True,
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return r


@pytest.fixture
def approved_merchant(db, sample_client) -> Merchant:
    return _make_merchant(db, sample_client, MERCHANT_APPROVED)


@pytest.fixture
def pending_merchant(db, sample_client) -> Merchant:
    return _make_merchant(db, sample_client, MERCHANT_PENDING)


@pytest.fixture
def reward(db, sample_client) -> CouponReward:
    return _make_reward(db, sample_client, points_cost=100, discount_pct=5)


@pytest.fixture
def coupon(client, db, sample_user, sample_user_points, sample_client, reward):
    """Un cupón ya emitido por el ciudadano (100 de sus 100 puntos)."""
    resp = client.post(
        f"{API}/coupons",
        json={"client_id": str(sample_client.id), "reward_id": str(reward.id)},
        headers=_citizen_header(sample_user),
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# --- Generación ---

class TestGenerateCoupon:

    def test_generate_returns_code_and_terms(self, coupon):
        assert len(coupon["code"]) == COUPON_CODE_LENGTH
        assert all(c in COUPON_CODE_ALPHABET for c in coupon["code"])
        assert coupon["discount_pct"] == 5.0
        assert coupon["points_spent"] == 100
        assert coupon["status"] == COUPON_ACTIVE

    def test_code_avoids_ambiguous_characters(self, coupon):
        # El código se dicta en el mostrador: no debe poder confundirse O con 0.
        assert not set(coupon["code"]) & set("ILOU01")

    def test_expires_in_60_days(self, coupon):
        expires = datetime.fromisoformat(coupon["expires_at"].replace("Z", "+00:00"))
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=timezone.utc)
        delta = expires - datetime.now(timezone.utc)
        assert COUPON_EXPIRY_DAYS - 1 < delta.days + 1 <= COUPON_EXPIRY_DAYS

    def test_debits_points_on_generation(self, coupon, db, sample_user, sample_client):
        points = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == sample_client.id,
        ).first()
        assert points.available_points == 0    # tenía 100, gastó 100
        assert points.redeemed_points == 150   # tenía 50, sumó 100

    def test_creates_point_transaction(self, coupon, db, sample_user, sample_client):
        tx = db.query(PointTransaction).filter(
            PointTransaction.reference_id == f"coupon:{coupon['id']}"
        ).first()
        assert tx is not None
        assert tx.amount == -100
        assert tx.transaction_type == "redeemed"
        assert tx.client_id == sample_client.id

    def test_insufficient_points_is_rejected(
        self, client, db, sample_user, sample_user_points, sample_client
    ):
        expensive = _make_reward(db, sample_client, points_cost=5000, discount_pct=50)
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(sample_client.id), "reward_id": str(expensive.id)},
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "insufficient_points"

    def test_cannot_use_reward_of_another_entity(
        self, client, db, sample_user, sample_user_points, sample_client, another_client
    ):
        """Un tier de otra entidad no se puede canjear con los puntos de la propia."""
        foreign = _make_reward(db, another_client, points_cost=10, discount_pct=90)
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(sample_client.id), "reward_id": str(foreign.id)},
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 404
        assert resp.json()["detail"]["code"] == "reward_not_found"

    def test_no_balance_in_entity_is_rejected(
        self, client, db, sample_user, sample_user_points, another_client
    ):
        """Tener puntos en una entidad no habilita a generar cupones en otra."""
        other_reward = _make_reward(db, another_client, points_cost=10, discount_pct=5)
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(another_client.id), "reward_id": str(other_reward.id)},
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 400
        assert resp.json()["detail"]["code"] == "insufficient_points"

    def test_terms_are_frozen_at_issue_time(self, coupon, db, reward):
        """Editar el catálogo no cambia lo prometido en un cupón ya emitido."""
        reward.discount_pct = Decimal("50")
        reward.points_cost = 999
        db.commit()

        stored = db.query(Coupon).filter(Coupon.id == uuid.UUID(coupon["id"])).first()
        assert float(stored.discount_pct) == 5.0
        assert stored.points_spent == 100

    def test_merchant_cannot_generate_coupons(
        self, client, approved_merchant, sample_client, reward
    ):
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(sample_client.id), "reward_id": str(reward.id)},
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 403


# --- Saldos y catálogo del ciudadano ---

class TestBalances:

    def test_lists_balance_and_affordable_rewards(
        self, client, db, sample_user, sample_user_points, sample_client
    ):
        _make_reward(db, sample_client, points_cost=100, discount_pct=5)
        _make_reward(db, sample_client, points_cost=500, discount_pct=20)

        resp = client.get(f"{API}/coupons/balances", headers=_citizen_header(sample_user))
        assert resp.status_code == 200

        balances = resp.json()
        assert len(balances) == 1
        assert balances[0]["client_id"] == str(sample_client.id)
        assert balances[0]["available_points"] == 100

        by_cost = {r["points_cost"]: r for r in balances[0]["rewards"]}
        assert by_cost[100]["affordable"] is True
        assert by_cost[500]["affordable"] is False

    def test_excludes_legacy_balance_without_entity(self, client, db, sample_user):
        """Un saldo histórico sin entidad no puede convertirse en cupones."""
        db.add(UserPoints(
            id=uuid.uuid4(),
            user_id=sample_user.id,
            client_id=None,
            total_points=999,
            available_points=999,
        ))
        db.commit()

        resp = client.get(f"{API}/coupons/balances", headers=_citizen_header(sample_user))
        assert resp.status_code == 200
        assert resp.json() == []


# --- Validación por el comercio ---

class TestValidateCoupon:

    def test_approved_merchant_sees_discount(self, client, coupon, approved_merchant):
        resp = client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["valid"] is True
        assert body["discount_pct"] == 5.0

    def test_validation_does_not_consume(self, client, coupon, approved_merchant, db):
        client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(approved_merchant),
        )
        stored = db.query(Coupon).filter(Coupon.code == coupon["code"]).first()
        assert stored.status == COUPON_ACTIVE

    def test_code_is_case_insensitive(self, client, coupon, approved_merchant):
        resp = client.get(
            f"{API}/coupons/validate/{coupon['code'].lower()}",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 200

    def test_pending_merchant_is_blocked(self, client, coupon, pending_merchant):
        resp = client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(pending_merchant),
        )
        assert resp.status_code == 403
        assert "no está habilitada" in resp.json()["detail"]

    def test_merchant_of_another_entity_gets_generic_invalid(
        self, client, db, coupon, another_client
    ):
        """No debe poder distinguir un cupón ajeno de uno inexistente: si pudiera,
        podría sondear códigos de otras entidades."""
        outsider = _make_merchant(db, another_client, MERCHANT_APPROVED)

        real = client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(outsider),
        )
        fake = client.get(
            f"{API}/coupons/validate/ZZZZZZ",
            headers=_merchant_header(outsider),
        )

        assert real.status_code == fake.status_code == 404
        assert real.json()["detail"] == fake.json()["detail"]

    def test_citizen_cannot_validate(self, client, coupon, sample_user):
        resp = client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 403

    def test_anonymous_cannot_validate(self, client, coupon):
        resp = client.get(f"{API}/coupons/validate/{coupon['code']}")
        assert resp.status_code == 401

    def test_rate_limit_blocks_code_probing(self, client, approved_merchant):
        """Barrer códigos desde una cuenta de comercio tiene que cortarse."""
        headers = _merchant_header(approved_merchant)
        codes = 429 in [
            client.get(f"{API}/coupons/validate/ZZZ{i:03d}", headers=headers).status_code
            for i in range(25)
        ]
        assert codes, "el rate limiter no cortó el sondeo de códigos"


# --- Consumo ---

class TestRedeemCoupon:

    def test_redeem_marks_coupon_used(self, client, coupon, approved_merchant, db):
        resp = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 200
        assert resp.json()["discount_pct"] == 5.0

        stored = db.query(Coupon).filter(Coupon.code == coupon["code"]).first()
        assert stored.status == COUPON_REDEEMED
        assert stored.redeemed_by_merchant_id == approved_merchant.id
        assert stored.redeemed_at is not None

    def test_double_redeem_is_rejected(self, client, coupon, approved_merchant):
        first = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(approved_merchant),
        )
        second = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(approved_merchant),
        )
        assert first.status_code == 200
        assert second.status_code == 409
        assert second.json()["detail"]["code"] == "already_redeemed"

    def test_merchant_of_another_entity_cannot_redeem(
        self, client, db, coupon, another_client
    ):
        outsider = _make_merchant(db, another_client, MERCHANT_APPROVED)
        resp = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(outsider),
        )
        assert resp.status_code == 404

        stored = db.query(Coupon).filter(Coupon.code == coupon["code"]).first()
        assert stored.status == COUPON_ACTIVE

    def test_pending_merchant_cannot_redeem(self, client, coupon, pending_merchant, db):
        resp = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(pending_merchant),
        )
        assert resp.status_code == 403

        stored = db.query(Coupon).filter(Coupon.code == coupon["code"]).first()
        assert stored.status == COUPON_ACTIVE


# --- Vencimiento ---

class TestExpiry:

    def _expire(self, db, code):
        stored = db.query(Coupon).filter(Coupon.code == code).first()
        stored.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
        db.commit()
        return stored

    def test_expired_coupon_cannot_be_validated(
        self, client, coupon, approved_merchant, db
    ):
        self._expire(db, coupon["code"])
        resp = client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "expired"

    def test_expired_coupon_cannot_be_redeemed(
        self, client, coupon, approved_merchant, db
    ):
        self._expire(db, coupon["code"])
        resp = client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 409
        assert resp.json()["detail"]["code"] == "expired"

    def test_validation_normalizes_status_to_expired(
        self, client, coupon, approved_merchant, db
    ):
        """No hay job de vencimiento: el estado se corrige cuando alguien mira."""
        self._expire(db, coupon["code"])
        client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(approved_merchant),
        )
        db.expire_all()
        stored = db.query(Coupon).filter(Coupon.code == coupon["code"]).first()
        assert stored.status == COUPON_EXPIRED

    def test_expiry_does_not_refund_points(
        self, client, coupon, approved_merchant, db, sample_user, sample_client
    ):
        """Decisión de producto: vencer no reintegra los puntos gastados."""
        self._expire(db, coupon["code"])
        client.get(
            f"{API}/coupons/validate/{coupon['code']}",
            headers=_merchant_header(approved_merchant),
        )

        db.expire_all()
        points = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == sample_client.id,
        ).first()
        assert points.available_points == 0


# --- Alta y habilitación de comercios ---

class TestMerchantOnboarding:

    def test_registration_starts_pending(self, client, sample_client):
        resp = client.post(
            f"{API}/merchants/register",
            json={
                "client_id": str(sample_client.id),
                "email": "nuevo@comercio.com",
                "password": "comercio123",
                "name": "Panadería Nueva",
                "cuit": "30123456789",
            },
        )
        assert resp.status_code == 201
        assert resp.json()["status"] == MERCHANT_PENDING

    def test_pending_merchant_can_login_and_see_status(self, client, db, sample_client):
        """Tiene que poder entrar para ver que su solicitud está en revisión."""
        _make_merchant(db, sample_client, MERCHANT_PENDING, email="p@comercio.com")

        login = client.post(
            f"{API}/merchants/login",
            json={"email": "p@comercio.com", "password": "comercio123"},
        )
        assert login.status_code == 200

        token = login.json()["access_token"]
        me = client.get(
            f"{API}/merchants/me",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert me.status_code == 200
        assert me.json()["status"] == MERCHANT_PENDING

    def test_duplicate_email_is_rejected(self, client, db, sample_client):
        _make_merchant(db, sample_client, MERCHANT_APPROVED, email="dup@comercio.com")
        resp = client.post(
            f"{API}/merchants/register",
            json={
                "client_id": str(sample_client.id),
                "email": "dup@comercio.com",
                "password": "comercio123",
                "name": "Otro",
            },
        )
        assert resp.status_code == 400

    def test_registration_requires_existing_entity(self, client):
        resp = client.post(
            f"{API}/merchants/register",
            json={
                "client_id": str(uuid.uuid4()),
                "email": "x@comercio.com",
                "password": "comercio123",
                "name": "Fantasma",
            },
        )
        assert resp.status_code == 404

    def test_wrong_password_is_rejected(self, client, db, sample_client):
        _make_merchant(db, sample_client, MERCHANT_APPROVED, email="w@comercio.com")
        resp = client.post(
            f"{API}/merchants/login",
            json={"email": "w@comercio.com", "password": "incorrecta"},
        )
        assert resp.status_code == 401
