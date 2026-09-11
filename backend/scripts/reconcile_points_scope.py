"""Reparte los saldos de puntos por entidad según el historial de transacciones.

Hace falta en bases donde el scoping ya corrió pero los saldos quedaron mal
repartidos: un ciudadano con puntos en varias entidades tenía todo en una sola
fila, o código previo al scoping siguió sumando puntos sin entidad sobre la base
ya migrada. No crea ni destruye puntos: el total, el disponible y lo canjeado de
cada ciudadano quedan iguales; solo cambia en qué fila de entidad están.

Sin argumentos simula: calcula y muestra el antes y el después dentro de una
transacción de solo lectura. Con --apply escribe, con las tablas de puntos
bloqueadas para escritura, y verifica el resultado antes de confirmar.
Es idempotente: se puede correr las veces que haga falta.

Uso:
    python scripts/reconcile_points_scope.py           # simulación
    python scripts/reconcile_points_scope.py --apply   # aplica
"""

import argparse
import os
import sys
from collections import Counter

from sqlalchemy import inspect, select, text

# Add parent directory to path to import app modules
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import engine
from app.db import points_scope_migration as scope
from app.models.client import Client


def _entity_names(conn, plan) -> dict:
    ids = {e for fix in plan.balances for e in (*fix.before, *fix.after) if e is not None}
    if not ids:
        return {}
    return dict(conn.execute(select(Client.id, Client.name).where(Client.id.in_(ids))).all())


def _print_plan(conn, plan) -> None:
    names = _entity_names(conn, plan)

    def label(entity):
        return names.get(entity, str(entity)[:8]) if entity is not None else "(sin entidad)"

    print(f"Transacciones a atribuir: {len(plan.transactions)}")
    for source, n in sorted(Counter(f.source for f in plan.transactions).items()):
        print(f"  {n} por {source}")

    print(f"\nSaldos a repartir: {len(plan.balances)}")
    for fix in plan.balances:
        print(f"\n  Ciudadano {str(fix.user_id)[:8]}")
        print(f"    {'entidad':<32} {'total':>15} {'disponible':>15} {'canjeado':>15}")
        for entity in sorted(set(fix.before) | set(fix.after), key=label):
            b = fix.before.get(entity, scope.ZERO)
            a = fix.after.get(entity, b)
            cells = " ".join(f"{f'{x} → {y}':>15}" for x, y in zip(b, a))
            print(f"    {label(entity):<32} {cells}{'   *' if a != b else ''}")
        before = [sum(v) for v in zip(*fix.before.values())]
        after = [sum(v) for v in zip(*{**fix.before, **fix.after}.values())]
        print(f"    {'suma':<32} " + " ".join(
            f"{f'{x} → {y}':>15}" for x, y in zip(before, after)
        ))

    if plan.skipped:
        print(f"\n⚠️  {len(plan.skipped)} saldo(s) no se tocan:")
        for user_id, reason in plan.skipped:
            print(f"    {str(user_id)[:8]}: {reason}")

    if plan.unattributed:
        print(f"\nℹ️  {len(plan.unattributed)} transacción(es) siguen sin entidad "
              "(encuestas sin client_id o canjes ambiguos).")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--apply", action="store_true", help="escribir los cambios")
    args = parser.parse_args()

    inspector = inspect(engine)
    if not inspector.has_table("user_points") or scope.is_pending(inspector):
        print("❌ El scoping de puntos todavía no corrió en esta base.")
        print("   Arrancá la app o corré scripts/migrate_add_client_to_points.py primero.")
        sys.exit(1)

    if not args.apply:
        with engine.connect() as conn:
            if conn.dialect.name == "postgresql":
                conn.execute(text("SET TRANSACTION READ ONLY"))
            plan = scope.plan_reconciliation(conn)
            _print_plan(conn, plan)
            conn.rollback()
        print("\nSimulación: no se escribió nada.", end=" ")
        print("No hay nada que reparar." if plan.is_empty else "Para aplicar: --apply")
        return

    with engine.begin() as conn:
        scope.lock_for_reconciliation(conn)
        plan = scope.plan_reconciliation(conn)
        _print_plan(conn, plan)
        if plan.is_empty:
            print("\n✅ No hay nada que reparar.")
            return
        scope.apply_reconciliation(conn, plan)
    print("\n✅ Reparación aplicada y verificada.")


if __name__ == "__main__":
    main()
