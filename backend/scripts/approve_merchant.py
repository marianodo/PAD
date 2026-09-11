"""Habilita comercios para consumir cupones.

El comercio se registra por su cuenta y queda en 'pending'. Recién cuando se
verifica con la entidad que está efectivamente adherido al plan se lo habilita
acá; hasta entonces puede entrar pero no puede consumir cupones.

Uso:
    python scripts/approve_merchant.py --list                     # pendientes
    python scripts/approve_merchant.py --list --all               # todos
    python scripts/approve_merchant.py --approve <email>
    python scripts/approve_merchant.py --reject <email>
"""

import argparse
import sys
import os
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.client import Client
from app.models.merchant import (
    Merchant,
    MERCHANT_APPROVED,
    MERCHANT_PENDING,
    MERCHANT_REJECTED,
)


def list_merchants(db, show_all: bool):
    query = (
        db.query(Merchant, Client.name)
        .join(Client, Client.id == Merchant.client_id)
    )
    if not show_all:
        query = query.filter(Merchant.status == MERCHANT_PENDING)

    rows = query.order_by(Merchant.created_at).all()

    if not rows:
        print("No hay comercios pendientes." if not show_all else "No hay comercios.")
        return

    print(f"{'Email':<34} {'Comercio':<24} {'Entidad':<24} {'CUIT':<12} Estado")
    print("-" * 110)
    for merchant, client_name in rows:
        print(
            f"{merchant.email[:33]:<34} {merchant.name[:23]:<24} "
            f"{client_name[:23]:<24} {(merchant.cuit or '—'):<12} {merchant.status}"
        )


def set_status(db, email: str, new_status: str):
    merchant = db.query(Merchant).filter(Merchant.email == email.strip().lower()).first()

    if not merchant:
        print(f"❌ No existe un comercio con el email {email}")
        return

    entity = db.query(Client).filter(Client.id == merchant.client_id).first()
    previous = merchant.status

    merchant.status = new_status
    merchant.approved_at = (
        datetime.now(timezone.utc) if new_status == MERCHANT_APPROVED else None
    )
    db.commit()

    verb = "habilitado" if new_status == MERCHANT_APPROVED else "rechazado"
    print(f"✅ {merchant.name} ({merchant.email}) {verb}.")
    print(f"   Entidad: {entity.name if entity else '—'}")
    print(f"   Estado: {previous} → {new_status}")

    if new_status == MERCHANT_APPROVED:
        print("\nYa puede validar y consumir cupones de esa entidad en /comercio.")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true", help="Listar comercios")
    parser.add_argument("--all", action="store_true", help="Con --list, incluir todos los estados")
    parser.add_argument("--approve", metavar="EMAIL", help="Habilitar este comercio")
    parser.add_argument("--reject", metavar="EMAIL", help="Rechazar este comercio")
    args = parser.parse_args()

    if not (args.list or args.approve or args.reject):
        parser.print_help()
        return

    db = SessionLocal()
    try:
        if args.list:
            list_merchants(db, args.all)
        if args.approve:
            set_status(db, args.approve, MERCHANT_APPROVED)
        if args.reject:
            set_status(db, args.reject, MERCHANT_REJECTED)
    finally:
        db.close()


if __name__ == "__main__":
    main()
