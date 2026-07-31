"""Generación y consumo de cupones de descuento.

Un cupón nace de los puntos que un ciudadano acumuló en UNA entidad (municipio,
provincia o privado) y solo puede consumirse en comercios adheridos a esa misma
entidad. Los puntos se debitan al generar, no al consumir: si se debitaran al
consumir, un ciudadano podría emitir varios cupones respaldados por el mismo
saldo y todos serían válidos.
"""

import secrets
from datetime import datetime, timedelta, timezone
from typing import List, Optional
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.coupon import (
    Coupon,
    CouponReward,
    COUPON_ACTIVE,
    COUPON_REDEEMED,
    COUPON_EXPIRED,
    COUPON_EXPIRY_DAYS,
    COUPON_CODE_ALPHABET,
    COUPON_CODE_LENGTH,
)
from app.models.merchant import Merchant
from app.models.points import PointTransaction, UserPoints


class CouponError(Exception):
    """Error de dominio con un código estable, para que la UI elija el mensaje."""

    def __init__(self, code: str, message: str, status_code: int = 400):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status_code = status_code


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _as_utc(value: Optional[datetime]) -> Optional[datetime]:
    """Normaliza un datetime leído de la DB a UTC aware.

    Postgres devuelve datetimes con tzinfo y SQLite (los tests) sin él. Comparar
    uno naive con uno aware levanta TypeError, así que todo pasa por acá.
    """
    if value is None:
        return None
    return value if value.tzinfo is not None else value.replace(tzinfo=timezone.utc)


def _is_expired(coupon: Coupon) -> bool:
    expires_at = _as_utc(coupon.expires_at)
    return expires_at is not None and expires_at <= _utcnow()


class CouponService:

    # --- Lado del ciudadano ---

    @staticmethod
    def list_rewards(db: Session, client_id: UUID) -> List[CouponReward]:
        """Catálogo activo de una entidad, del más barato al más caro."""
        return db.query(CouponReward).filter(
            CouponReward.client_id == client_id,
            CouponReward.is_active == True,  # noqa: E712
        ).order_by(CouponReward.points_cost.asc()).all()

    @staticmethod
    def get_balances(db: Session, user_id: UUID) -> List[UserPoints]:
        """Saldos del ciudadano por entidad.

        Excluye el saldo histórico sin entidad (client_id NULL), que no puede
        convertirse en cupones porque no se sabe en qué comercios se consumiría.
        """
        return db.query(UserPoints).filter(
            UserPoints.user_id == user_id,
            UserPoints.client_id.isnot(None),
        ).all()

    @staticmethod
    def list_user_coupons(
        db: Session,
        user_id: UUID,
        client_id: Optional[UUID] = None,
    ) -> List[Coupon]:
        query = db.query(Coupon).filter(Coupon.user_id == user_id)
        if client_id is not None:
            query = query.filter(Coupon.client_id == client_id)
        return query.order_by(Coupon.created_at.desc()).all()

    @staticmethod
    def _generate_unique_code(db: Session, attempts: int = 10) -> str:
        """Código corto aleatorio que no colisione con uno existente.

        Entre el chequeo y el INSERT hay una ventana en la que otro request podría
        tomar el mismo código; el UNIQUE de la columna es el que garantiza que no
        se dupliquen, y con 30^6 combinaciones la colisión es despreciable.
        """
        for _ in range(attempts):
            code = "".join(
                secrets.choice(COUPON_CODE_ALPHABET) for _ in range(COUPON_CODE_LENGTH)
            )
            if not db.query(Coupon.id).filter(Coupon.code == code).first():
                return code

        raise CouponError(
            "code_generation_failed",
            "No se pudo generar un código de cupón. Intentá de nuevo.",
            500,
        )

    @staticmethod
    def generate(
        db: Session,
        user_id: UUID,
        client_id: UUID,
        reward_id: UUID,
    ) -> Coupon:
        """Canjea puntos por un cupón. Debita el saldo de esa entidad."""
        reward = db.query(CouponReward).filter(
            CouponReward.id == reward_id,
            CouponReward.client_id == client_id,
            CouponReward.is_active == True,  # noqa: E712
        ).first()

        if not reward:
            raise CouponError(
                "reward_not_found",
                "La recompensa no existe o no está disponible en esta entidad.",
                404,
            )

        # Lock del saldo: sin esto, dos requests simultáneos leerían el mismo
        # available_points y emitirían dos cupones pagados una sola vez.
        user_points = db.query(UserPoints).filter(
            UserPoints.user_id == user_id,
            UserPoints.client_id == client_id,
        ).with_for_update().first()

        available = user_points.available_points if user_points else 0
        if available < reward.points_cost:
            raise CouponError(
                "insufficient_points",
                f"Puntos insuficientes. Disponibles: {available}, "
                f"requeridos: {reward.points_cost}.",
                400,
            )

        code = CouponService._generate_unique_code(db)

        coupon = Coupon(
            code=code,
            user_id=user_id,
            client_id=client_id,
            reward_id=reward.id,
            # Condiciones congeladas: si mañana se edita el catálogo, este cupón
            # sigue valiendo lo que se le prometió al emitirlo.
            discount_pct=reward.discount_pct,
            points_spent=reward.points_cost,
            status=COUPON_ACTIVE,
            expires_at=_utcnow() + timedelta(days=COUPON_EXPIRY_DAYS),
        )
        db.add(coupon)
        db.flush()  # necesito coupon.id para el reference_id de la transacción

        user_points.available_points -= reward.points_cost
        user_points.redeemed_points += reward.points_cost

        db.add(PointTransaction(
            user_id=user_id,
            client_id=client_id,
            transaction_type="redeemed",
            amount=-reward.points_cost,
            description=f"Cupón {code} — {reward.name}",
            reference_id=f"coupon:{coupon.id}",
        ))

        db.commit()
        db.refresh(coupon)
        return coupon

    # --- Lado del comercio ---

    @staticmethod
    def _lookup_for_merchant(
        db: Session,
        code: str,
        merchant: Merchant,
        lock: bool = False,
    ) -> Coupon:
        normalized = (code or "").strip().upper()
        if not normalized:
            raise CouponError("invalid_code", "Cupón inválido.", 404)

        query = db.query(Coupon).filter(Coupon.code == normalized)
        if lock:
            query = query.with_for_update()
        coupon = query.first()

        # Un cupón de otra entidad se reporta idéntico a uno inexistente: si la
        # respuesta los distinguiera, un comercio podría sondear códigos ajenos.
        if not coupon or coupon.client_id != merchant.client_id:
            raise CouponError("invalid_code", "Cupón inválido.", 404)

        return coupon

    @staticmethod
    def _assert_usable(coupon: Coupon) -> None:
        if coupon.status == COUPON_REDEEMED:
            raise CouponError(
                "already_redeemed",
                "El cupón ya fue consumido.",
                409,
            )
        if coupon.status == COUPON_EXPIRED or _is_expired(coupon):
            raise CouponError(
                "expired",
                "El cupón está vencido.",
                409,
            )
        if coupon.status != COUPON_ACTIVE:
            raise CouponError("invalid_code", "Cupón inválido.", 404)

    @staticmethod
    def validate(db: Session, code: str, merchant: Merchant) -> Coupon:
        """Verifica un cupón sin consumirlo."""
        coupon = CouponService._lookup_for_merchant(db, code, merchant)

        # Vencimiento perezoso: no hay job que lo marque, y como el vencimiento no
        # reintegra puntos, alcanza con normalizar el estado cuando alguien mira.
        if coupon.status == COUPON_ACTIVE and _is_expired(coupon):
            coupon.status = COUPON_EXPIRED
            db.commit()

        CouponService._assert_usable(coupon)
        return coupon

    @staticmethod
    def redeem(db: Session, code: str, merchant: Merchant) -> Coupon:
        """Consume un cupón de forma atómica.

        El lock y la revalidación del estado dentro de la misma transacción son
        los que evitan que dos cajas consuman el mismo cupón a la vez.
        """
        coupon = CouponService._lookup_for_merchant(db, code, merchant, lock=True)
        CouponService._assert_usable(coupon)

        coupon.status = COUPON_REDEEMED
        coupon.redeemed_at = _utcnow()
        coupon.redeemed_by_merchant_id = merchant.id

        db.commit()
        db.refresh(coupon)
        return coupon
