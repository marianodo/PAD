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

    def test_zero_cost_reward_is_rejected(
        self, client, db, sample_user, sample_user_points, sample_client
    ):
        """El catálogo se edita por SQL a mano, sin validación de la app.

        Un tier de costo 0 saltearía el chequeo de saldo (`0 < 0` es falso) y
        emitiría cupones infinitos; uno negativo acreditaría puntos.
        """
        free = _make_reward(db, sample_client, points_cost=0, discount_pct=100)
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(sample_client.id), "reward_id": str(free.id)},
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 404

    def test_negative_cost_reward_is_rejected(
        self, client, db, sample_user, sample_user_points, sample_client
    ):
        evil = _make_reward(db, sample_client, points_cost=-500, discount_pct=100)
        resp = client.post(
            f"{API}/coupons",
            json={"client_id": str(sample_client.id), "reward_id": str(evil.id)},
            headers=_citizen_header(sample_user),
        )
        assert resp.status_code == 404

        points = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == sample_client.id,
        ).first()
        assert points.available_points == 100, "un costo negativo acreditó puntos"

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
            for i in range(40)
        ]
        assert codes, "el rate limiter no cortó el sondeo de códigos"

    def test_valid_operations_never_consume_the_limit(
        self, client, coupon, approved_merchant
    ):
        """Un local con varias cajas tiene que poder operar en paralelo.

        El límite existe contra el sondeo de códigos, no contra el trabajo del
        mostrador: validar cupones que existen no debe gastar cupo por más veces
        que se haga.
        """
        headers = _merchant_header(approved_merchant)
        for _ in range(60):
            resp = client.get(
                f"{API}/coupons/validate/{coupon['code']}", headers=headers
            )
            assert resp.status_code == 200, (
                f"una operación válida se comió el rate limit: {resp.status_code}"
            )

    def test_expired_and_used_codes_do_not_count_as_probing(
        self, client, coupon, approved_merchant, db
    ):
        """Son códigos reales de la propia entidad, no sondeo."""
        client.post(
            f"{API}/coupons/{coupon['code']}/redeem",
            headers=_merchant_header(approved_merchant),
        )

        headers = _merchant_header(approved_merchant)
        for _ in range(40):
            resp = client.get(
                f"{API}/coupons/validate/{coupon['code']}", headers=headers
            )
            assert resp.status_code == 409, (
                f"un cupón ya consumido contó como sondeo: {resp.status_code}"
            )


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

    def test_owner_sees_expired_coupon_as_expired(
        self, client, coupon, db, sample_user
    ):
        """Un cupón que venció sin que ningún comercio lo escanee.

        Es el caso real: el ciudadano genera, se olvida, y a los 61 días abre la
        app. Si su propio listado se lo muestra como disponible, va al comercio
        con un cupón que la UI le dijo que servía.
        """
        self._expire(db, coupon["code"])

        resp = client.get(f"{API}/coupons/me", headers=_citizen_header(sample_user))
        assert resp.status_code == 200

        mine = next(c for c in resp.json() if c["code"] == coupon["code"])
        assert mine["status"] == COUPON_EXPIRED

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


# --- Los puntos se acumulan en la entidad dueña de la encuesta ---

class TestPointsScoping:
    """El otorgamiento es la pieza que cambió de semántica: antes había un saldo
    global por ciudadano y ahora hay uno por entidad. De ese saldo salen los
    cupones, así que si los puntos caen en la entidad equivocada el ciudadano
    puede canjear descuentos en comercios donde nunca participó."""

    def _award(self, db, user, client_obj, points=100):
        from app.models.survey import Survey
        from app.services.survey_service import SurveyService

        survey = Survey(id=uuid.uuid4(), title="Encuesta", client_id=client_obj.id)
        db.add(survey)
        db.flush()
        SurveyService._update_user_points(db, user.id, points, None, survey.client_id)
        db.commit()

    def test_points_land_in_the_survey_owner_entity(
        self, db, sample_user, sample_client, another_client
    ):
        self._award(db, sample_user, sample_client, 100)

        mine = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == sample_client.id,
        ).first()
        assert mine is not None and mine.available_points == 100

        other = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == another_client.id,
        ).first()
        assert other is None, "los puntos se filtraron a otra entidad"

    def test_two_entities_keep_separate_balances(
        self, db, sample_user, sample_client, another_client
    ):
        self._award(db, sample_user, sample_client, 100)
        self._award(db, sample_user, another_client, 250)

        balances = {
            p.client_id: p.available_points
            for p in db.query(UserPoints).filter(UserPoints.user_id == sample_user.id)
        }
        assert balances[sample_client.id] == 100
        assert balances[another_client.id] == 250

    def test_transaction_records_the_entity(self, db, sample_user, sample_client):
        self._award(db, sample_user, sample_client, 100)

        tx = db.query(PointTransaction).filter(
            PointTransaction.user_id == sample_user.id
        ).first()
        assert tx.client_id == sample_client.id

    def test_concurrent_first_award_does_not_break(
        self, db, sample_user, sample_client
    ):
        """Dos respuestas simultáneas en una entidad donde aún no hay saldo.

        Las dos pasan el "no existe la fila" y las dos intentan insertar. El
        unique deja entrar a una sola; la otra tiene que releer esa fila en vez
        de reventar la respuesta de la encuesta con un 500.
        """
        from app.models.survey import Survey
        from app.services.survey_service import SurveyService
        from tests.conftest import TestingSessionLocal

        from sqlalchemy import event

        survey = Survey(id=uuid.uuid4(), title="Encuesta", client_id=sample_client.id)
        db.add(survey)
        db.commit()

        # La otra respuesta inserta el saldo justo entre nuestra consulta (que no
        # encontró nada) y nuestro INSERT. Enganchado al flush porque es el único
        # punto donde la ventana existe de verdad.
        state = {"raced": False}

        def race(session, flush_context, instances):
            if state["raced"]:
                return
            state["raced"] = True
            other = TestingSessionLocal()
            try:
                other.add(UserPoints(
                    id=uuid.uuid4(),
                    user_id=sample_user.id,
                    client_id=sample_client.id,
                    total_points=0,
                    available_points=0,
                    redeemed_points=0,
                ))
                other.commit()
            finally:
                other.close()

        event.listen(db, "before_flush", race)
        try:
            SurveyService._update_user_points(
                db, sample_user.id, 100, None, sample_client.id
            )
            db.commit()
        finally:
            event.remove(db, "before_flush", race)

        assert state["raced"], "el test no llegó a provocar la carrera"

        rows = db.query(UserPoints).filter(
            UserPoints.user_id == sample_user.id,
            UserPoints.client_id == sample_client.id,
        ).all()
        assert len(rows) == 1, "se crearon saldos duplicados para la misma entidad"
        assert rows[0].available_points == 100

    def test_aggregate_sums_across_entities(
        self, db, sample_user, sample_client, another_client
    ):
        """Sin client_id, get_user_points conserva la semántica de "total"."""
        from app.services.user_service import UserService

        self._award(db, sample_user, sample_client, 100)
        self._award(db, sample_user, another_client, 250)

        total = UserService.get_user_points(db, sample_user.id)
        assert total.available_points == 350
        assert total.client_id is None  # es un agregado, no una fila real

        scoped = UserService.get_user_points(db, sample_user.id, sample_client.id)
        assert scoped.available_points == 100


# --- Aislamiento del token de comercio ---

class TestMerchantTokenIsolation:
    """El token de comercio no puede entrar por la puerta de los ciudadanos.

    Los endpoints de encuestas autorizan con deny-lists ("si es User, 403; si es
    Client de otra entidad, 403"), así que una cuenta de un tipo nuevo los
    atraviesa sin control. Como el alta de comercio es pública y no requiere
    aprobación, eso alcanzaría para leer datos personales de cualquier entidad.
    """

    @pytest.mark.parametrize("path", [
        "/surveys/{sid}/results",
        "/surveys/{sid}/segments",
        "/surveys/{sid}/segments/export",
    ])
    def test_merchant_cannot_reach_survey_data(
        self, client, db, another_client, pending_merchant, path
    ):
        from app.models.survey import Survey
        survey = Survey(id=uuid.uuid4(), title="Encuesta ajena", client_id=another_client.id)
        db.add(survey)
        db.commit()

        resp = client.get(
            f"{API}{path.format(sid=survey.id)}",
            headers=_merchant_header(pending_merchant),
        )
        assert resp.status_code == 403, (
            f"{path} dejó pasar a un comercio: {resp.status_code}"
        )

    def test_merchant_token_on_auth_me_is_rejected_not_crashed(
        self, client, approved_merchant
    ):
        """El branch else de /auth/me asume User y desreferencia .cuil."""
        resp = client.get(f"{API}/auth/me", headers=_merchant_header(approved_merchant))
        assert resp.status_code == 403

    def test_merchant_cannot_read_citizen_points(
        self, client, sample_user, sample_user_points, approved_merchant
    ):
        resp = client.get(
            f"{API}/users/{sample_user.id}/points",
            headers=_merchant_header(approved_merchant),
        )
        assert resp.status_code == 403


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

    def test_login_accepts_accounts_with_special_use_domains(
        self, client, db, sample_client
    ):
        """Una cuenta ya guardada tiene que poder entrar siempre.

        Validar el formato del email en el login deja fuera para siempre a
        cualquier cuenta cuyo dominio el validador no acepte —.test y .local son
        de uso especial y los rechaza— y devuelve 422 en vez del 401 que
        corresponde. El formato se valida en el alta, no acá.
        """
        _make_merchant(db, sample_client, MERCHANT_APPROVED, email="demo@comercio.test")

        resp = client.post(
            f"{API}/merchants/login",
            json={"email": "demo@comercio.test", "password": "comercio123"},
        )
        assert resp.status_code == 200, resp.text

    def test_login_with_garbage_email_is_401_not_422(self, client):
        """Un email inexistente falla como credencial, no como validación."""
        resp = client.post(
            f"{API}/merchants/login",
            json={"email": "no soy un email", "password": "comercio123"},
        )
        assert resp.status_code == 401

    def test_wrong_password_is_rejected(self, client, db, sample_client):
        _make_merchant(db, sample_client, MERCHANT_APPROVED, email="w@comercio.com")
        resp = client.post(
            f"{API}/merchants/login",
            json={"email": "w@comercio.com", "password": "incorrecta"},
        )
        assert resp.status_code == 401
