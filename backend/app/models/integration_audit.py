from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class IntegrationAuditLog(Base):
    """Log de auditoría para accesos a la API de integración"""
    __tablename__ = "integration_audit_log"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    provider_id = Column(UUID(as_uuid=True), ForeignKey("providers.id"), nullable=False)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)
    endpoint = Column(String(100), nullable=False)
    cuil = Column(String(11), nullable=True)
    request_body = Column(JSONB, nullable=True)
    response_status = Column(Integer, nullable=False)
    response_body = Column(JSONB, nullable=True)
    ip_address = Column(String(45), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    provider = relationship("Provider", back_populates="audit_logs")
