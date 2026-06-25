from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class Report(Base):
    """Reporte de gestión/transparencia que el municipio publica para el ciudadano.

    El contenido (config + segmentos/proyectos) se guarda en `document` (JSONB) y lo
    renderiza un componente genérico en el frontend. Así actualizar el reporte cada
    período es cargar datos, sin deploy. Identificado por `slug` (ej: "alta-gracia-2026").
    """
    __tablename__ = "reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug = Column(String(255), unique=True, nullable=False, index=True)
    period = Column(String(50), nullable=True)  # ej: "2026"
    title = Column(String(255), nullable=True)  # nombre mostrado (ej: nombre del municipio)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="SET NULL"), nullable=True)

    # { "config": {...}, "segments": [...] }
    document = Column(JSONB, nullable=False, default=dict)

    is_published = Column(Boolean, nullable=False, server_default="true", default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    client = relationship("Client")
