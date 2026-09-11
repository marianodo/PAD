from sqlalchemy import Column, String, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


# Estados del onboarding de un comercio. El comercio se registra por su cuenta y
# queda en 'pending': recién cuando verificamos con la entidad que está adherido
# al plan lo pasamos a 'approved', y solo entonces puede consumir cupones.
MERCHANT_PENDING = "pending"
MERCHANT_APPROVED = "approved"
MERCHANT_REJECTED = "rejected"

MERCHANT_STATUSES = (MERCHANT_PENDING, MERCHANT_APPROVED, MERCHANT_REJECTED)


class Merchant(Base):
    """Comercio adherido al plan de cupones de una entidad (municipio, provincia
    o privado). El alta la hace el propio comercio; la habilitación es manual."""

    __tablename__ = "merchants"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)

    # Entidad a la que está adherido. Solo puede consumir cupones de esta entidad.
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False, index=True)

    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Datos del comercio
    name = Column(String(255), nullable=False)
    cuit = Column(String(11), nullable=True, index=True)
    address = Column(String, nullable=True)
    phone = Column(String(50), nullable=True)

    status = Column(String(20), nullable=False, default=MERCHANT_PENDING, index=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    client = relationship("Client")

    @property
    def is_approved(self) -> bool:
        return self.status == MERCHANT_APPROVED
