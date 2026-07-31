"""Siembra el catálogo de cupones de cada entidad.

El catálogo no tiene UI: se administra por base de datos. Este script deja el
tier por defecto (100 puntos = 5%) en toda entidad que todavía no tenga ninguno,
sin tocar las que ya fueron configuradas a mano.

Uso:
    python scripts/seed_coupon_rewards.py                    # todas las entidades
    python scripts/seed_coupon_rewards.py --points 200 --pct 5
    python scripts/seed_coupon_rewards.py --client-id <uuid>
    python scripts/seed_coupon_rewards.py --list             # ver lo que hay
"""

import argparse
import sys
import os
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.client import Client
from app.models.coupon import CouponReward


def list_rewards(db):
    rewards = (
        db.query(CouponReward, Client.name)
        .join(Client, Client.id == CouponReward.client_id)
        .order_by(Client.name, CouponReward.points_cost)
        .all()
    )

    if not rewards:
        print("No hay recompensas configuradas.")
        return

    print(f"{'Entidad':<40} {'Puntos':>8} {'Desc.':>7}  Activo")
    print("-" * 70)
    for reward, client_name in rewards:
        activo = "sí" if reward.is_active else "no"
        print(
            f"{client_name[:39]:<40} {reward.points_cost:>8} "
            f"{float(reward.discount_pct):>6.1f}%  {activo}"
        )


def seed(db, points: int, pct: float, client_id: str | None):
    query = db.query(Client)
    if client_id:
        query = query.filter(Client.id == client_id)

    entities = query.all()
    if not entities:
        print("⚠️  No se encontraron entidades.")
        return

    created = 0
    for entity in entities:
        already = db.query(CouponReward).filter(
            CouponReward.client_id == entity.id
        ).first()

        if already:
            print(f"·  {entity.name}: ya tiene catálogo, se omite")
            continue

        db.add(CouponReward(
            client_id=entity.id,
            name=f"{pct:g}% de descuento",
            points_cost=points,
            discount_pct=Decimal(str(pct)),
            is_active=True,
        ))
        created += 1
        print(f"✅ {entity.name}: {points} puntos → {pct:g}%")

    db.commit()
    print(f"\n{created} recompensa(s) creada(s).")

    if created:
        print("\nPara agregar más tiers a una entidad, insertá directo en la tabla:")
        print("  INSERT INTO coupon_rewards (id, client_id, name, points_cost, discount_pct, is_active)")
        print("  VALUES (gen_random_uuid(), '<client_uuid>', '10% de descuento', 200, 10, true);")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--points", type=int, default=100, help="Puntos que cuesta (default: 100)")
    parser.add_argument("--pct", type=float, default=5, help="Descuento en %% (default: 5)")
    parser.add_argument("--client-id", help="Sembrar solo esta entidad")
    parser.add_argument("--list", action="store_true", help="Listar el catálogo actual y salir")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        if args.list:
            list_rewards(db)
        else:
            seed(db, args.points, args.pct, args.client_id)
    finally:
        db.close()


if __name__ == "__main__":
    main()
