from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class UserPoints(Base):
    """Saldo de puntos de un ciudadano EN UNA entidad.

    Los puntos se acumulan por entidad (municipio, provincia o privado), no de
    forma global: un cupón nace de los puntos ganados en una entidad y solo se
    consume en comercios de esa misma entidad. Sin esto, los comercios de una
    entidad terminarían subsidiando la participación ocurrida en otra.
    """

    __tablename__ = "user_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)

    # Nullable solo por las filas previas al scoping por entidad: esos saldos
    # históricos no se pueden convertir en cupones (ver scripts/migrate_points_client_scope.sql).
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=True, index=True)

    total_points = Column(Integer, default=0)
    available_points = Column(Integer, default=0)  # Puntos disponibles para canjear
    redeemed_points = Column(Integer, default=0)   # Puntos ya canjeados
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="points")
    client = relationship("Client")

    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_user_points_user_client"),
    )


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    # Entidad sobre cuyo saldo impactó el movimiento. Nullable por las
    # transacciones previas al scoping por entidad.
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True, index=True)
    transaction_type = Column(String(50), nullable=False)  # earned, redeemed, expired
    amount = Column(Integer, nullable=False)
    description = Column(Text)
    reference_id = Column(String(255), unique=True, nullable=True, index=True)  # Idempotencia para canjeos
    related_response_id = Column(UUID(as_uuid=True), ForeignKey("survey_responses.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="point_transactions")
    related_response = relationship("SurveyResponse", foreign_keys=[related_response_id])
