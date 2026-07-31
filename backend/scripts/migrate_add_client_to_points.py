"""Aplica a mano el scoping de los saldos de puntos por entidad.

La misma migración corre sola al arrancar la app (app/main.py); este script
existe para ejecutarla por separado y ver el reporte de qué se atribuyó y qué
quedó sin atribuir. Es idempotente: se puede correr las veces que haga falta.

Uso:
    python scripts/migrate_add_client_to_points.py
"""

import sys
import os
from sqlalchemy import inspect

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine
from app.db import points_scope_migration


def migrate():
    print("Starting migration: scoping de puntos por entidad...")

    with engine.connect() as conn:
        trans = conn.begin()
        try:
            inspector = inspect(engine)
            if not points_scope_migration.is_pending(inspector):
                trans.rollback()
                print("✅ Ya estaba aplicada, no hay nada que hacer.")
                return

            stats = points_scope_migration.run(conn)
            trans.commit()

            print(f"  {stats['transactions_attributed']} transacciones atribuidas por encuesta")
            print(f"  {stats['balances_by_transactions']} saldos atribuidos por sus transacciones")
            print(f"  {stats['balances_by_membership']} saldos atribuidos por membresía única")
            print("✅ Migration completed successfully!")

            if stats["stranded_rows"]:
                print(f"\n⚠️  {stats['stranded_rows']} saldo(s) quedaron sin entidad "
                      f"({stats['stranded_points']} puntos disponibles en total).")
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
