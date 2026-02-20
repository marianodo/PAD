from sqlalchemy import Column, String, DateTime, ForeignKey, func, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class ElectoralRoll(Base):
    """Padrón electoral: CUILs habilitados por municipio"""
    __tablename__ = "electoral_roll"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False)
    cuil = Column(String(11), nullable=False, index=True)
    name = Column(String(255), nullable=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    client = relationship("Client", back_populates="electoral_roll_entries")

    __table_args__ = (
        UniqueConstraint("client_id", "cuil", name="uq_electoral_roll_client_cuil"),
    )
