"""
Migration script: scopea los puntos por entidad (client).

Los puntos pasan de ser un saldo global por ciudadano a un saldo por entidad
(municipio, provincia o privado), porque un cupón nace de los puntos ganados en
una entidad y solo se consume en comercios de esa misma entidad.

Cambios:
  - user_points.client_id  (+ FK, + índice)
  - user_points: unique(user_id) -> unique(user_id, client_id)
  - point_transactions.client_id  (+ FK, + índice)
  - backfill de client_id donde se puede determinar sin ambigüedad

Importante: Base.metadata.create_all() NO altera tablas existentes, así que este
script es obligatorio en cualquier base que ya tenga la tabla user_points.
Es idempotente: se puede correr varias veces sin efecto adicional.
"""

import sys
import os
from sqlalchemy import text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine


def migrate():
    """Agrega client_id a user_points y point_transactions, y hace el backfill"""
    print("Starting migration: scoping de puntos por entidad...")

    with engine.connect() as conn:
        trans = conn.begin()

        try:
            # --- user_points.client_id ---
            print("Adding user_points.client_id...")
            conn.execute(text("""
                ALTER TABLE user_points
                ADD COLUMN IF NOT EXISTS client_id UUID
            """))

            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE user_points
                    ADD CONSTRAINT fk_user_points_client_id
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE;
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_user_points_client_id
                ON user_points(client_id)
            """))

            # --- point_transactions.client_id ---
            print("Adding point_transactions.client_id...")
            conn.execute(text("""
                ALTER TABLE point_transactions
                ADD COLUMN IF NOT EXISTS client_id UUID
            """))

            conn.execute(text("""
                DO $$ BEGIN
                    ALTER TABLE point_transactions
                    ADD CONSTRAINT fk_point_transactions_client_id
                    FOREIGN KEY (client_id) REFERENCES clients(id);
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            conn.execute(text("""
                CREATE INDEX IF NOT EXISTS idx_point_transactions_client_id
                ON point_transactions(client_id)
            """))

            # --- Backfill de point_transactions ---
            # Las transacciones 'earned' se pueden atribuir con precisión: la
            # respuesta apunta a una encuesta, y la encuesta tiene su entidad.
            print("Backfilling point_transactions.client_id desde las encuestas...")
            result = conn.execute(text("""
                UPDATE point_transactions pt
                SET client_id = s.client_id
                FROM survey_responses sr
                JOIN surveys s ON s.id = sr.survey_id
                WHERE pt.related_response_id = sr.id
                  AND pt.client_id IS NULL
                  AND s.client_id IS NOT NULL
            """))
            print(f"  {result.rowcount} transacciones atribuidas por encuesta")

            # --- Backfill de user_points ---
            # Solo cuando no hay ambigüedad: el ciudadano ganó puntos en UNA sola
            # entidad. Si ganó en varias, su saldo global no se puede repartir sin
            # decidir un criterio de negocio, así que se deja en NULL y se reporta.
            print("Backfilling user_points.client_id...")
            result = conn.execute(text("""
                UPDATE user_points up
                SET client_id = sub.client_id
                FROM (
                    -- No hay MIN() para uuid en Postgres; el HAVING garantiza que
                    -- hay un solo valor distinto, así que el cast es inocuo.
                    SELECT user_id, MIN(client_id::text)::uuid AS client_id
                    FROM point_transactions
                    WHERE client_id IS NOT NULL
                    GROUP BY user_id
                    HAVING COUNT(DISTINCT client_id) = 1
                ) sub
                WHERE up.user_id = sub.user_id
                  AND up.client_id IS NULL
            """))
            print(f"  {result.rowcount} saldos atribuidos por sus transacciones")

            # Segundo intento para saldos sin transacciones atribuibles: si el
            # ciudadano pertenece a una sola entidad, es esa.
            result = conn.execute(text("""
                UPDATE user_points up
                SET client_id = sub.client_id
                FROM (
                    SELECT user_id, MIN(client_id::text)::uuid AS client_id
                    FROM user_clients
                    GROUP BY user_id
                    HAVING COUNT(*) = 1
                ) sub
                WHERE up.user_id = sub.user_id
                  AND up.client_id IS NULL
            """))
            print(f"  {result.rowcount} saldos atribuidos por membresía única")

            # --- Reemplazar el unique de user_id por (user_id, client_id) ---
            # El nombre lo genera Postgres al crear la tabla, así que lo busco por
            # su definición en vez de asumir 'user_points_user_id_key'.
            print("Reemplazando unique(user_id) por unique(user_id, client_id)...")
            conn.execute(text("""
                DO $$
                DECLARE
                    con_name text;
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
                    ADD CONSTRAINT uq_user_points_user_client
                    UNIQUE (user_id, client_id);
                EXCEPTION
                    WHEN duplicate_object THEN null;
                END $$;
            """))

            # En Postgres los NULL son distintos entre sí, así que el UNIQUE de
            # arriba no impide dos filas (user, NULL). Este índice parcial sí.
            conn.execute(text("""
                CREATE UNIQUE INDEX IF NOT EXISTS uq_user_points_user_legacy
                ON user_points(user_id)
                WHERE client_id IS NULL
            """))

            # --- Reporte de lo que quedó sin atribuir ---
            result = conn.execute(text("""
                SELECT COUNT(*), COALESCE(SUM(available_points), 0)
                FROM user_points
                WHERE client_id IS NULL
            """))
            stranded_rows, stranded_points = result.fetchone()

            trans.commit()
            print("✅ Migration completed successfully!")

            if stranded_rows:
                print(f"\n⚠️  {stranded_rows} saldo(s) quedaron sin entidad "
                      f"({stranded_points} puntos disponibles en total).")
                print("   Son ciudadanos que ganaron puntos en más de una entidad, o que")
                print("   no tienen transacciones ni membresía única. Esos puntos NO pueden")
                print("   convertirse en cupones hasta que se les asigne un client_id a mano:")
                print("     UPDATE user_points SET client_id = '<uuid>' WHERE user_id = '<uuid>';")

        except Exception as e:
            trans.rollback()
            print(f"❌ Migration failed: {e}")
            raise


if __name__ == "__main__":
    migrate()
