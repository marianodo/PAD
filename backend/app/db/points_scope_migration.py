"""Scoping de los saldos de puntos por entidad.

Los puntos pasan de ser un saldo global por ciudadano a un saldo por entidad
(municipio, provincia o privado), porque un cupón nace de los puntos ganados en
una entidad y solo se consume en comercios de esa misma entidad.

Base.metadata.create_all() crea tablas nuevas pero NO altera las existentes, así
que sin este paso cualquier query que toque UserPoints.client_id revienta con
UndefinedColumn. Por eso corre en el arranque (app/main.py), igual que el resto
de las migraciones del proyecto; scripts/migrate_add_client_to_points.py es el
mismo código para correrlo a mano con reporte detallado.

La segunda mitad del módulo reparte los saldos según el historial de
transacciones (ver plan_reconciliation). Corre al final del scoping, y para las
bases que ya estaban migradas se aplica con scripts/reconcile_points_scope.py.

Todo el módulo es idempotente.
"""

from collections import defaultdict, namedtuple
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple, Union
from uuid import UUID, uuid4

from sqlalchemy import func, insert, select, text, update

from app.models.integration_audit import IntegrationAuditLog
from app.models.points import PointTransaction, UserPoints
from app.models.provider import ProviderClient
from app.models.response import SurveyResponse
from app.models.survey import Survey
from app.models.user_client import UserClient


def is_pending(inspector) -> bool:
    """True si falta aplicar algo del scoping.

    Chequea la columna y también la constraint, porque una base pudo quedar a
    medio migrar si el proceso se cortó entre ambos pasos.
    """
    if not inspector.has_table("user_points"):
        return False

    columns = [c["name"] for c in inspector.get_columns("user_points")]
    if "client_id" not in columns:
        return True

    constraints = inspector.get_unique_constraints("user_points")
    return not any(
        set(c.get("column_names") or []) == {"user_id", "client_id"}
        for c in constraints
    )


def run(conn) -> dict:
    """Aplica el scoping sobre una conexión abierta. Devuelve un resumen."""
    stats = {}

    # --- Columnas nuevas ---
    conn.execute(text("ALTER TABLE user_points ADD COLUMN IF NOT EXISTS client_id UUID"))
    conn.execute(text("""
        DO $$ BEGIN
            ALTER TABLE user_points
            ADD CONSTRAINT fk_user_points_client_id
            FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_user_points_client_id ON user_points(client_id)"
    ))

    conn.execute(text(
        "ALTER TABLE point_transactions ADD COLUMN IF NOT EXISTS client_id UUID"
    ))
    conn.execute(text("""
        DO $$ BEGIN
            ALTER TABLE point_transactions
            ADD CONSTRAINT fk_point_transactions_client_id
            FOREIGN KEY (client_id) REFERENCES clients(id);
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """))
    conn.execute(text(
        "CREATE INDEX IF NOT EXISTS idx_point_transactions_client_id "
        "ON point_transactions(client_id)"
    ))

    # --- Backfill de transacciones ---
    # Las 'earned' se atribuyen con precisión: la respuesta apunta a una
    # encuesta y la encuesta tiene su entidad.
    result = conn.execute(text("""
        UPDATE point_transactions pt
        SET client_id = s.client_id
        FROM survey_responses sr
        JOIN surveys s ON s.id = sr.survey_id
        WHERE pt.related_response_id = sr.id
          AND pt.client_id IS NULL
          AND s.client_id IS NOT NULL
    """))
    stats["transactions_attributed"] = result.rowcount

    # --- Backfill de saldos ---
    # Primero cada saldo global se asigna a UNA entidad; el reparto por
    # historial de más abajo mueve después los puntos que son de otras.
    # No hay MIN() para uuid en Postgres; el HAVING garantiza un único valor.
    result = conn.execute(text("""
        UPDATE user_points up
        SET client_id = sub.client_id
        FROM (
            SELECT user_id, MIN(client_id::text)::uuid AS client_id
            FROM point_transactions
            WHERE client_id IS NOT NULL
            GROUP BY user_id
            HAVING COUNT(DISTINCT client_id) = 1
        ) sub
        WHERE up.user_id = sub.user_id AND up.client_id IS NULL
    """))
    stats["balances_by_transactions"] = result.rowcount

    result = conn.execute(text("""
        UPDATE user_points up
        SET client_id = sub.client_id
        FROM (
            SELECT user_id, MIN(client_id::text)::uuid AS client_id
            FROM user_clients
            GROUP BY user_id
            HAVING COUNT(*) = 1
        ) sub
        WHERE up.user_id = sub.user_id AND up.client_id IS NULL
    """))
    stats["balances_by_membership"] = result.rowcount

    # --- unique(user_id) -> unique(user_id, client_id) ---
    # El nombre lo generó Postgres al crear la tabla, así que se busca por
    # definición en vez de asumir 'user_points_user_id_key'.
    conn.execute(text("""
        DO $$
        DECLARE con_name text;
        BEGIN
            SELECT c.conname INTO con_name
            FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            WHERE t.relname = 'user_points'
              AND c.contype = 'u'
              AND c.conkey = ARRAY[(
                  SELECT attnum FROM pg_attribute
                  WHERE attrelid = t.oid AND attname = 'user_id'
              )]::smallint[];

            IF con_name IS NOT NULL THEN
                EXECUTE format('ALTER TABLE user_points DROP CONSTRAINT %I', con_name);
            END IF;
        END $$;
    """))

    conn.execute(text("""
        DO $$ BEGIN
            ALTER TABLE user_points
            ADD CONSTRAINT uq_user_points_user_client UNIQUE (user_id, client_id);
        EXCEPTION WHEN duplicate_object THEN null;
        END $$;
    """))

    # En Postgres los NULL son distintos entre sí, así que el UNIQUE de arriba no
    # impide dos filas (user, NULL). Este índice parcial sí.
    conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS uq_user_points_user_legacy
        ON user_points(user_id) WHERE client_id IS NULL
    """))

    # --- Reparto por historial ---
    plan = plan_reconciliation(conn)
    apply_reconciliation(conn, plan)
    stats["reconciled_transactions"] = len(plan.transactions)
    stats["reconciled_balances"] = len(plan.balances)
    stats["skipped_balances"] = len(plan.skipped)

    result = conn.execute(text("""
        SELECT COUNT(*), COALESCE(SUM(available_points), 0)
        FROM user_points WHERE client_id IS NULL
    """))
    stranded_rows, stranded_points = result.fetchone()
    stats["stranded_rows"] = stranded_rows
    stats["stranded_points"] = stranded_points

    return stats


# --- Reparto de saldos por historial ---
#
# Asignar cada saldo global a una sola entidad deja los puntos de las demás
# dentro de esa fila: un ciudadano que ganó en Alta Gracia y en Córdoba quedaba
# con todo en Alta Gracia, y podía gastar en sus comercios lo ganado en Córdoba.
# Lo mismo pasa si código previo al scoping sigue sumando puntos sobre una base
# ya migrada: no sabe de entidades y suma en la única fila que encuentra.
#
# El historial de transacciones dice cuánto se ganó y canjeó en cada entidad,
# así que se usa como fuente de verdad para mover los puntos a su fila. Nunca se
# crean ni se destruyen puntos: por cada ciudadano, la suma de total, disponible
# y canjeado queda igual. Los puntos que el historial no explica (cargados a mano,
# por ejemplo) se quedan en la fila donde están.

Balance = namedtuple("Balance", "total available redeemed")
ZERO = Balance(0, 0, 0)

REDEEM_ENDPOINT = "POST /points/redeem"


class ReconcileError(Exception):
    """La reparación no dio lo planificado; quien la llama debe revertir."""


@dataclass
class TransactionFix:
    transaction_id: UUID
    user_id: UUID
    client_id: UUID
    source: str  # 'encuesta', 'auditoría' o 'proveedor'


@dataclass
class BalanceFix:
    user_id: UUID
    row_ids: Dict[Optional[UUID], UUID]
    before: Dict[Optional[UUID], Balance]
    after: Dict[Optional[UUID], Balance]


@dataclass
class ReconcilePlan:
    transactions: List[TransactionFix] = field(default_factory=list)
    balances: List[BalanceFix] = field(default_factory=list)
    # (user_id, motivo) de los saldos que no se tocan porque repartirlos
    # sería adivinar.
    skipped: List[Tuple[UUID, str]] = field(default_factory=list)
    # Transacciones que siguen sin entidad: las de encuestas sin client_id son
    # legítimas; un canje sin entidad deja al ciudadano en `skipped`.
    unattributed: List[UUID] = field(default_factory=list)

    @property
    def is_empty(self) -> bool:
        return not self.transactions and not self.balances


def lock_for_reconciliation(conn) -> None:
    """Bloquea las escrituras de puntos hasta el fin de la transacción.

    Sin esto, un punto sumado entre el cálculo y la escritura haría que la
    escritura pise el saldo con un valor viejo. Las lecturas siguen andando.

    Mientras el LOCK espera a otra transacción, todas las escrituras de puntos
    se encolan detrás de él; el lock_timeout lo hace fallar en vez de dejar
    colgada la app.
    """
    if conn.dialect.name == "postgresql":
        conn.execute(text("SET LOCAL lock_timeout = '10s'"))
        conn.execute(text(
            "LOCK TABLE user_points, point_transactions IN SHARE ROW EXCLUSIVE MODE"
        ))


def plan_reconciliation(conn) -> ReconcilePlan:
    """Calcula la reparación sin escribir nada."""
    plan = ReconcilePlan()
    attributed: Dict[UUID, UUID] = {}

    # 1. 'earned' sin entidad: la encuesta dice de qué entidad son.
    rows = conn.execute(
        select(PointTransaction.id, PointTransaction.user_id, Survey.client_id)
        .join(SurveyResponse, SurveyResponse.id == PointTransaction.related_response_id)
        .join(Survey, Survey.id == SurveyResponse.survey_id)
        .where(PointTransaction.client_id.is_(None), Survey.client_id.isnot(None))
    ).all()
    for tx_id, user_id, client_id in rows:
        plan.transactions.append(TransactionFix(tx_id, user_id, client_id, "encuesta"))

    # 2. Canjes por integración sin entidad.
    plan.transactions.extend(_attribute_redemptions(conn))

    for fix in plan.transactions:
        attributed[fix.transaction_id] = fix.client_id

    # 3. Historial por ciudadano y entidad, con lo planificado ya aplicado.
    ledger = defaultdict(lambda: defaultdict(lambda: [0, 0]))  # [ganado, canjeado]
    unknown_types = set()
    unattributed_redeems = set()
    for tx_id, user_id, client_id, tx_type, amount in conn.execute(select(
        PointTransaction.id,
        PointTransaction.user_id,
        PointTransaction.client_id,
        PointTransaction.transaction_type,
        PointTransaction.amount,
    )):
        entity = attributed.get(tx_id, client_id)
        if entity is None:
            plan.unattributed.append(tx_id)
        if tx_type == "earned":
            ledger[user_id][entity][0] += amount
        elif tx_type == "redeemed":
            ledger[user_id][entity][1] -= amount
            if entity is None:
                unattributed_redeems.add(user_id)
        else:
            unknown_types.add(user_id)

    # 4. Saldos guardados.
    stored = defaultdict(dict)
    row_ids = defaultdict(dict)
    for row_id, user_id, client_id, total, available, redeemed in conn.execute(select(
        UserPoints.id,
        UserPoints.user_id,
        UserPoints.client_id,
        UserPoints.total_points,
        UserPoints.available_points,
        UserPoints.redeemed_points,
    )):
        stored[user_id][client_id] = Balance(total or 0, available or 0, redeemed or 0)
        row_ids[user_id][client_id] = row_id

    for user_id in sorted(set(ledger) | set(stored), key=str):
        if user_id in unknown_types:
            plan.skipped.append((user_id, "tiene transacciones que no son earned ni redeemed"))
            continue
        if user_id in unattributed_redeems:
            plan.skipped.append((user_id, "tiene canjes que no se pueden atribuir a una entidad"))
            continue

        user_stored = stored.get(user_id, {})
        target = _rebalance(user_stored, ledger.get(user_id, {}))
        if isinstance(target, str):
            plan.skipped.append((user_id, target))
        elif target is not None:
            plan.balances.append(BalanceFix(
                user_id=user_id,
                row_ids=dict(row_ids[user_id]),
                before=dict(user_stored),
                after=target,
            ))

    return plan


def apply_reconciliation(conn, plan: ReconcilePlan) -> None:
    """Escribe el plan y verifica que la base quedó reparada.

    Cada escritura exige que la fila siga como estaba al planificar; si no,
    levanta ReconcileError y la transacción se tiene que revertir.
    """
    pt = PointTransaction.__table__
    up = UserPoints.__table__

    for fix in plan.transactions:
        result = conn.execute(
            update(pt)
            .where(pt.c.id == fix.transaction_id, pt.c.client_id.is_(None))
            .values(client_id=fix.client_id)
        )
        if result.rowcount != 1:
            raise ReconcileError(
                f"la transacción {fix.transaction_id} cambió durante la reparación"
            )

    for fix in plan.balances:
        for entity, balance in fix.after.items():
            values = dict(
                total_points=balance.total,
                available_points=balance.available,
                redeemed_points=balance.redeemed,
                updated_at=func.now(),
            )
            if entity not in fix.row_ids:
                conn.execute(insert(up).values(
                    id=uuid4(), user_id=fix.user_id, client_id=entity, **values
                ))
                continue

            before = fix.before[entity]
            if balance == before:
                continue
            result = conn.execute(
                update(up)
                .where(
                    up.c.id == fix.row_ids[entity],
                    func.coalesce(up.c.total_points, 0) == before.total,
                    func.coalesce(up.c.available_points, 0) == before.available,
                    func.coalesce(up.c.redeemed_points, 0) == before.redeemed,
                )
                .values(**values)
            )
            if result.rowcount != 1:
                raise ReconcileError(
                    f"el saldo del ciudadano {fix.user_id} cambió durante la reparación"
                )

    if not plan_reconciliation(conn).is_empty:
        raise ReconcileError("después de aplicar todavía queda algo por reparar")


def _attribute_redemptions(conn) -> List[TransactionFix]:
    """Entidad de los canjes por integración que no la registraron.

    El log de auditoría del canje guarda la entidad autorizada. Si no la tiene,
    sirve la intersección entre las entidades del proveedor y las membresías del
    ciudadano, que es la misma cuenta que hace la integración al autorizar. Si
    quedan varias candidatas no se elige ninguna.
    """
    pending = conn.execute(
        select(PointTransaction.id, PointTransaction.user_id, PointTransaction.reference_id)
        .where(
            PointTransaction.transaction_type == "redeemed",
            PointTransaction.client_id.is_(None),
            PointTransaction.reference_id.isnot(None),
        )
    ).all()
    if not pending:
        return []

    refs = {ref: (tx_id, user_id) for tx_id, user_id, ref in pending}
    ref_col = IntegrationAuditLog.request_body["reference_id"].as_string()

    logged_clients = defaultdict(set)
    logged_providers = defaultdict(set)
    for ref, provider_id, client_id in conn.execute(
        select(ref_col, IntegrationAuditLog.provider_id, IntegrationAuditLog.client_id)
        .where(
            IntegrationAuditLog.endpoint == REDEEM_ENDPOINT,
            IntegrationAuditLog.response_status == 200,
            ref_col.in_(list(refs)),
        )
    ):
        logged_providers[ref].add(provider_id)
        # Los reintentos idempotentes se loguean sin entidad; no cuentan.
        if client_id is not None:
            logged_clients[ref].add(client_id)

    provider_ids = set().union(*logged_providers.values())
    provider_clients = defaultdict(set)
    if provider_ids:
        for provider_id, client_id in conn.execute(
            select(ProviderClient.provider_id, ProviderClient.client_id)
            .where(ProviderClient.provider_id.in_(provider_ids))
        ):
            provider_clients[provider_id].add(client_id)

    memberships = defaultdict(set)
    for user_id, client_id in conn.execute(
        select(UserClient.user_id, UserClient.client_id)
        .where(UserClient.user_id.in_({user_id for _, user_id in refs.values()}))
    ):
        memberships[user_id].add(client_id)

    fixes = []
    for ref, (tx_id, user_id) in refs.items():
        logged = logged_clients.get(ref, set())
        if len(logged) == 1:
            fixes.append(TransactionFix(tx_id, user_id, next(iter(logged)), "auditoría"))
            continue
        if logged:
            continue  # el log se contradice

        candidates = set()
        for provider_id in logged_providers.get(ref, ()):
            candidates |= provider_clients[provider_id]
        candidates &= memberships[user_id]
        if len(candidates) == 1:
            fixes.append(TransactionFix(tx_id, user_id, candidates.pop(), "proveedor"))

    return fixes


def _rebalance(
    stored: Dict, ledger: Dict
) -> Optional[Union[str, Dict[Optional[UUID], Balance]]]:
    """Saldos objetivo de un ciudadano, por entidad.

    Devuelve None si no hay nada que mover, un str con el motivo si no se puede
    decidir sin adivinar, o el dict entidad -> Balance a escribir.

    Por cada componente (total, disponible, canjeado), las entidades cuyo saldo
    guardado es menor que su historial tienen un faltante, y los puntos solo
    pueden venir de la fila que tiene de más. Si esa fila es una sola, se mueve
    exactamente el faltante; lo que sobra en ella es lo que el historial no
    explica y se queda ahí.
    """
    expected = {
        entity: Balance(earned, earned - redeemed, redeemed)
        for entity, (earned, redeemed) in ledger.items()
    }
    entities = set(stored) | set(expected)
    target = {entity: list(stored.get(entity, ZERO)) for entity in entities}
    donors = set()

    for i in range(3):
        excess = {
            entity: stored.get(entity, ZERO)[i] - expected.get(entity, ZERO)[i]
            for entity in entities
        }
        missing = sum(-x for x in excess.values() if x < 0)
        if not missing:
            continue

        sources = [entity for entity, x in excess.items() if x > 0]
        if len(sources) > 1:
            return "los puntos faltantes podrían venir de más de una fila"
        if not sources or excess[sources[0]] < missing:
            return "el saldo guardado es menor que el historial"

        donors.add(sources[0])
        for entity, x in excess.items():
            if x < 0:
                target[entity][i] -= x
        target[sources[0]][i] -= missing

    if len(donors) > 1:
        return "los puntos faltantes podrían venir de más de una fila"
    if not donors:
        return None

    result = {entity: Balance(*values) for entity, values in target.items()}
    if any(value < 0 for balance in result.values() for value in balance):
        return "moverlos dejaría un saldo negativo (ya se canjearon esos puntos)"

    # No se crean filas vacías para entidades que no tienen nada.
    return {
        entity: balance for entity, balance in result.items()
        if entity in stored or balance != ZERO
    }
