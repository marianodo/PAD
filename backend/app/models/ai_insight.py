from sqlalchemy import Column, String, DateTime, Integer, Text, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
import uuid

from app.db.base import Base


class AIInsight(Base):
    __tablename__ = "ai_insights"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)

    # Hash de las respuestas para detectar cambios
    responses_hash = Column(String, nullable=False, index=True)
    total_responses = Column(Integer, nullable=False)

    # Insights generados (JSON array)
    insights = Column(JSON, nullable=False)

    # Predicciones generadas (JSON array) - opcional
    predictions = Column(JSON, nullable=True)

    # Metadata
    model = Column(String, nullable=False)  # ej: "claude-3-haiku-20240307"
    generated_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationships
    survey = relationship("Survey", back_populates="ai_insights")
