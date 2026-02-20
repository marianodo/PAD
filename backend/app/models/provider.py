from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class Provider(Base):
    """Proveedor de sistema de pagos que se integra con PAD"""
    __tablename__ = "providers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    api_key_hash = Column(String(255), nullable=False)
    api_key_prefix = Column(String(8), nullable=False, index=True)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    provider_clients = relationship("ProviderClient", back_populates="provider", cascade="all, delete-orphan")
    audit_logs = relationship("IntegrationAuditLog", back_populates="provider")


class ProviderClient(Base):
    """Relación many-to-many entre providers y clients"""
    __tablename__ = "provider_clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id", ondelete="CASCADE"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    provider = relationship("Provider", back_populates="provider_clients")
    client = relationship("Client", back_populates="provider_clients")

    __table_args__ = (
        UniqueConstraint("provider_id", "client_id", name="uq_provider_client"),
    )
