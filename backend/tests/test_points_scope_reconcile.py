"""Tests del reparto de saldos por historial (app/db/points_scope_migration.py).

Reproducen lo que apareció en la base de develop: puntos de una entidad
guardados en la fila de otra, transacciones sin entidad que sumó código previo
al scoping y canjes por integración que no registraban de qué entidad salían.
En todos se exige lo mismo: ningún ciudadano gana ni pierde puntos, solo cambia
en qué fila de entidad están.
"""

import uuid

from app.core.security import get_password_hash
from app.db.points_scope_migration import (
    Balance,
    ZERO,
    apply_reconciliation,
    plan_reconciliation,
)
from app.models.client import Client
from app.models.integration_audit import IntegrationAuditLog
from app.models.points import PointTransaction, UserPoints
from app.models.provider import ProviderClient
from app.models.response import SurveyResponse
from app.models.survey import Survey
from app.models.user_client import UserClient


# --- Helpers ---

def _earn(db, user, client_obj, points, recorded=True) -> PointTransaction:
    """Puntos ganados en una encuesta de client_obj.

    recorded=False simula el código previo al scoping, que no guardaba la
    entidad en la transacción.
    """
    survey = Survey(id=uuid.uuid4(), title="Encuesta", client_id=client_obj.id)
    db.add(survey)
    db.flush()
    response = SurveyResponse(
        id=uuid.uuid4(), survey_id=survey.id, user_id=user.id,
        completed=True, points_earned=points,
    )
    db.add(response)
    db.flush()
    tx = PointTransaction(
        id=uuid.uuid4(), user_id=user.id,
        client_id=client_obj.id if recorded else None,
        transaction_type="earned", amount=points,
        related_response_id=response.id,
    )
    db.add(tx)
    db.commit()
    return tx


def _integration_redeem(db, user, provider, points, audit_client=None) -> PointTransaction:
    """Canje informado por un proveedor, como lo registraba el código previo."""
    ref = f"ext-{uuid.uuid4().hex[:8]}"
    tx = PointTransaction(
        id=uuid.uuid4(), user_id=user.id, client_id=None,
        transaction_type="redeemed", amount=-points, reference_id=ref,
    )
    db.add(tx)
    _audit(db, provider, ref, user, audit_client)
    db.commit()
    return tx


def _audit(db, provider, ref, user, client_obj=None):
    db.add(IntegrationAuditLog(
        id=uuid.uuid4(), provider_id=provider.id,
        client_id=client_obj.id if client_obj else None,
        endpoint="POST /points/redeem", cuil=user.cuil,
        request_body={"cuil": user.cuil, "reference_id": ref},
        response_status=200,
    ))
    db.commit()


def _coupon_redeem(db, user, client_obj, points):
    db.add(PointTransaction(
        id=uuid.uuid4(), user_id=user.id, client_id=client_obj.id,
        transaction_type="redeemed", amount=-points,
        reference_id=f"coupon:{uuid.uuid4()}",
    ))
    db.commit()


def _set_balance(db, user, client_obj, total, redeemed=0, available=None):
    db.add(UserPoints(
        id=uuid.uuid4(), user_id=user.id,
        client_id=client_obj.id if client_obj else None,
        total_points=total,
        available_points=total - redeemed if available is None else available,
        redeemed_points=redeemed,
    ))
    db.commit()


def _make_client(db, name) -> Client:
    c = Client(
        id=uuid.uuid4(), email=f"{uuid.uuid4().hex[:8]}@example.com",
        hashed_password=get_password_hash("test123"), name=name,
        cuit="30" + uuid.uuid4().hex[:9], city="Ciudad",
    )
    db.add(c)
    db.commit()
    return c


def _balances(db, user) -> dict:
    db.expire_all()
    return {
        p.client_id: Balance(p.total_points, p.available_points, p.redeemed_points)
        for p in db.query(UserPoints).filter(UserPoints.user_id == user.id)
    }


def _sum(balances) -> Balance:
    return Balance(*(sum(b[i] for b in balances.values()) for i in range(3)))


def _reconcile(db):
    plan = plan_reconciliation(db.connection())
    apply_reconciliation(db.connection(), plan)
    db.commit()
    return plan


# --- Reparto ---

class TestReconcileBalances:

    def test_moves_points_of_another_entity_to_their_own_row(
        self, db, sample_user, sample_client, another_client
    ):
        """El caso de develop: todo quedó en la fila de la entidad de membresía.

        Los 450 que el historial no explica se quedan en esa fila.
        """
        _earn(db, sample_user, sample_client, 2480)
        _earn(db, sample_user, another_client, 250)
        _set_balance(db, sample_user, sample_client, total=2480 + 250 + 450)
        before = _balances(db, sample_user)

        _reconcile(db)

        after = _balances(db, sample_user)
        assert after[sample_client.id] == Balance(2930, 2930, 0)
        assert after[another_client.id] == Balance(250, 250, 0)
        assert _sum(after) == _sum(before)

    def test_moves_points_out_of_the_legacy_row(self, db, sample_user, sample_client):
        """Saldo creado sin entidad por código previo, con puntos de una encuesta."""
        _earn(db, sample_user, sample_client, 100, recorded=False)
        _set_balance(db, sample_user, None, total=100)

        _reconcile(db)

        after = _balances(db, sample_user)
        assert after[sample_client.id] == Balance(100, 100, 0)
        assert after[None] == ZERO

    def test_fixes_rows_after_new_code_already_created_the_entity_row(
        self, db, sample_user, sample_client, another_client
    ):
        """Si la reparación corre después del deploy, la otra entidad ya puede
        tener su fila con lo ganado desde entonces."""
        _earn(db, sample_user, sample_client, 1000)
        _earn(db, sample_user, another_client, 250, recorded=False)  # código viejo
        _earn(db, sample_user, another_client, 100)                  # código nuevo
        _set_balance(db, sample_user, sample_client, total=1250)
        _set_balance(db, sample_user, another_client, total=100)

        _reconcile(db)

        after = _balances(db, sample_user)
        assert after[sample_client.id] == Balance(1000, 1000, 0)
        assert after[another_client.id] == Balance(350, 350, 0)

    def test_consistent_balances_are_not_touched(
        self, db, sample_user, sample_client, another_client
    ):
        _earn(db, sample_user, sample_client, 100)
        _earn(db, sample_user, another_client, 250)
        _set_balance(db, sample_user, sample_client, total=100)
        _set_balance(db, sample_user, another_client, total=250)

        assert plan_reconciliation(db.connection()).is_empty

    def test_legacy_balance_without_history_is_left_alone(self, db, user_without_client):
        _set_balance(db, user_without_client, None, total=80)

        assert plan_reconciliation(db.connection()).is_empty
        assert _balances(db, user_without_client) == {None: Balance(80, 80, 0)}

    def test_is_idempotent(self, db, sample_user, sample_client, another_client):
        _earn(db, sample_user, sample_client, 300)
        _earn(db, sample_user, another_client, 200, recorded=False)
        _set_balance(db, sample_user, sample_client, total=500)

        assert not _reconcile(db).is_empty
        assert plan_reconciliation(db.connection()).is_empty

    def test_planning_does_not_write(self, db, sample_user, sample_client, another_client):
        tx = _earn(db, sample_user, another_client, 200, recorded=False)
        _set_balance(db, sample_user, sample_client, total=200)

        plan = plan_reconciliation(db.connection())
        db.rollback()

        assert not plan.is_empty
        assert _balances(db, sample_user) == {sample_client.id: Balance(200, 200, 0)}
        assert db.get(PointTransaction, tx.id).client_id is None


# --- Casos en los que repartir sería adivinar ---

class TestReconcileRefusesToGuess:

    def test_skips_when_stored_balance_is_below_history(
        self, db, sample_user, sample_client, another_client
    ):
        _earn(db, sample_user, sample_client, 100)
        _earn(db, sample_user, another_client, 100)
        _set_balance(db, sample_user, sample_client, total=150)
        before = _balances(db, sample_user)

        plan = _reconcile(db)

        assert [u for u, _ in plan.skipped] == [sample_user.id]
        assert _balances(db, sample_user) == before

    def test_skips_when_several_rows_could_hold_the_missing_points(
        self, db, sample_user, sample_client, another_client
    ):
        third = _make_client(db, "Tercera entidad")
        _earn(db, sample_user, sample_client, 100)
        _earn(db, sample_user, another_client, 100)
        _earn(db, sample_user, third, 100)
        _set_balance(db, sample_user, sample_client, total=150)
        _set_balance(db, sample_user, another_client, total=150)
        before = _balances(db, sample_user)

        plan = _reconcile(db)

        assert [u for u, _ in plan.skipped] == [sample_user.id]
        assert _balances(db, sample_user) == before

    def test_skips_when_misplaced_points_were_already_spent(
        self, db, sample_user, sample_client, another_client
    ):
        """Los puntos de otra entidad ya se gastaron en cupones de esta: sacarlos
        dejaría el saldo en negativo."""
        _earn(db, sample_user, sample_client, 100)
        _earn(db, sample_user, another_client, 100)
        _coupon_redeem(db, sample_user, sample_client, 150)
        _set_balance(db, sample_user, sample_client, total=200, redeemed=150)
        before = _balances(db, sample_user)

        plan = _reconcile(db)

        assert [u for u, _ in plan.skipped] == [sample_user.id]
        assert _balances(db, sample_user) == before


# --- Atribución de transacciones ---

class TestReconcileTransactions:

    def test_earned_without_entity_takes_the_survey_entity(
        self, db, sample_user, sample_client
    ):
        tx = _earn(db, sample_user, sample_client, 100, recorded=False)
        _set_balance(db, sample_user, sample_client, total=100)

        plan = _reconcile(db)

        assert [f.source for f in plan.transactions] == ["encuesta"]
        assert db.get(PointTransaction, tx.id).client_id == sample_client.id
        assert _balances(db, sample_user) == {sample_client.id: Balance(100, 100, 0)}

    def test_integration_redemption_takes_the_entity_from_the_audit_log(
        self, db, sample_user, sample_client, sample_provider
    ):
        _earn(db, sample_user, sample_client, 300)
        tx = _integration_redeem(db, sample_user, sample_provider, 100, sample_client)
        # Un reintento idempotente del mismo canje se loguea sin entidad.
        _audit(db, sample_provider, tx.reference_id, sample_user, None)
        _set_balance(db, sample_user, sample_client, total=300, redeemed=100)

        plan = _reconcile(db)

        assert [f.source for f in plan.transactions] == ["auditoría"]
        assert db.get(PointTransaction, tx.id).client_id == sample_client.id
        assert _balances(db, sample_user) == {sample_client.id: Balance(300, 200, 100)}

    def test_redemption_falls_back_to_provider_and_membership(
        self, db, sample_user, sample_client, another_client, sample_provider
    ):
        _earn(db, sample_user, sample_client, 300)
        tx = _integration_redeem(db, sample_user, sample_provider, 100)
        _set_balance(db, sample_user, sample_client, total=300, redeemed=100)

        plan = _reconcile(db)

        assert [f.source for f in plan.transactions] == ["proveedor"]
        assert db.get(PointTransaction, tx.id).client_id == sample_client.id

    def test_ambiguous_redemption_stays_unattributed_and_balance_untouched(
        self, db, sample_user, sample_client, another_client, sample_provider
    ):
        """Proveedor autorizado en dos entidades del ciudadano: no se elige."""
        db.add(ProviderClient(
            id=uuid.uuid4(), provider_id=sample_provider.id,
            client_id=another_client.id, is_active=True,
        ))
        db.add(UserClient(id=uuid.uuid4(), user_id=sample_user.id, client_id=another_client.id))
        db.commit()
        _earn(db, sample_user, sample_client, 200)
        _earn(db, sample_user, another_client, 100)
        tx = _integration_redeem(db, sample_user, sample_provider, 50)
        _set_balance(db, sample_user, sample_client, total=300, redeemed=50)
        before = _balances(db, sample_user)

        plan = _reconcile(db)

        assert tx.id in plan.unattributed
        assert db.get(PointTransaction, tx.id).client_id is None
        assert [u for u, _ in plan.skipped] == [sample_user.id]
        assert _balances(db, sample_user) == before
