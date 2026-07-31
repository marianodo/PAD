"""Scoping de los saldos de puntos por entidad.

Los puntos pasan de ser un saldo global por ciudadano a un saldo por entidad
(municipio, provincia o privado), porque un cupón nace de los puntos ganados en
una entidad y solo se consume en comercios de esa misma entidad.

Base.metadata.create_all() crea tablas nuevas pero NO altera las existentes, así
que sin este paso cualquier query que toque UserPoints.client_id revienta con
UndefinedColumn. Por eso corre en el arranque (app/main.py), igual que el resto
de las migraciones del proyecto; scripts/migrate_add_client_to_points.py es el
mismo código para correrlo a mano con reporte detallado.

Todo el módulo es idempotente.
"""

from sqlalchemy import text


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
    # Solo sin ambigüedad: si el ciudadano ganó puntos en varias entidades, su
    # saldo global no se puede repartir sin una decisión de negocio.
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

    result = conn.execute(text("""
        SELECT COUNT(*), COALESCE(SUM(available_points), 0)
        FROM user_points WHERE client_id IS NULL
    """))
    stranded_rows, stranded_points = result.fetchone()
    stats["stranded_rows"] = stranded_rows
    stats["stranded_points"] = stranded_points

    return stats
