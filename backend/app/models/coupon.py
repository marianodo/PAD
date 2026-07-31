from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, func, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


COUPON_ACTIVE = "active"
COUPON_REDEEMED = "redeemed"
COUPON_EXPIRED = "expired"

# Días de validez de un cupón desde su generación. Vencido no se reintegran los
# puntos, así que la confirmación al generar tiene que ser explícita.
COUPON_EXPIRY_DAYS = 60

# Alfabeto sin caracteres ambiguos (sin I, L, O, U, 0, 1) porque el código se
# dicta y se tipea a mano en el mostrador. 30^6 ≈ 729 millones de combinaciones.
COUPON_CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ"
COUPON_CODE_LENGTH = 6


class CouponReward(Base):
    """Catálogo de recompensas por entidad: cuántos puntos cuesta qué descuento.

    Se administra directamente por base de datos (no hay UI). Cada entidad define
    sus propios tiers: un municipio puede querer 100 puntos = 5% y otro 200 = 5%.
    """

    __tablename__ = "coupon_rewards"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)

    name = Column(String(255), nullable=False)
    points_cost = Column(Integer, nullable=False)
    discount_pct = Column(Numeric(5, 2), nullable=False)

    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    client = relationship("Client")
    coupons = relationship("Coupon", back_populates="reward")


class Coupon(Base):
    """Cupón de descuento generado por un ciudadano canjeando puntos.

    Nace de los puntos que el ciudadano acumuló en UNA entidad y solo puede
    consumirse en comercios adheridos a esa misma entidad.
    """

    __tablename__ = "coupons"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Código corto que el ciudadano le muestra al comercio.
    code = Column(String(12), unique=True, nullable=False, index=True)

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)
    reward_id = Column(UUID(as_uuid=True), ForeignKey("coupon_rewards.id"), nullable=False)

    # Condiciones congeladas al momento de emitir: si después se edita el
    # catálogo por BD, los cupones ya emitidos conservan lo que se les prometió.
    discount_pct = Column(Numeric(5, 2), nullable=False)
    points_spent = Column(Integer, nullable=False)

    status = Column(String(20), nullable=False, default=COUPON_ACTIVE, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=False)

    redeemed_at = Column(DateTime(timezone=True), nullable=True)
    redeemed_by_merchant_id = Column(UUID(as_uuid=True), ForeignKey("merchants.id"), nullable=True)

    # Relationships
    user = relationship("User")
    client = relationship("Client")
    reward = relationship("CouponReward", back_populates="coupons")
    redeemed_by_merchant = relationship("Merchant")
