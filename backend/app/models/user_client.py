from sqlalchemy import Column, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class UserClient(Base):
    """Membresía N–N entre ciudadanos (users) y municipios (clients).

    Un ciudadano puede pertenecer a varios clientes (ej: su municipio y la
    provincia que lo contiene). La elegibilidad para votar una encuesta se basa
    en estas membresías (ver membership_service).
    """
    __tablename__ = "user_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="client_memberships")
    client = relationship("Client", back_populates="user_memberships")

    __table_args__ = (
        UniqueConstraint("user_id", "client_id", name="uq_user_client"),
    )
