from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, func, Text, CheckConstraint
from sqlalchemy.dialects.postgresql import UUID, JSONB, INET
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class SurveyResponse(Base):
    __tablename__ = "survey_responses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    completed = Column(Boolean, default=False)
    points_earned = Column(Integer, default=0)
    started_at = Column(DateTime(timezone=True), server_default=func.now())
    completed_at = Column(DateTime(timezone=True))
    ip_address = Column(INET)
    user_agent = Column(Text)

    # Relationships
    survey = relationship("Survey", back_populates="responses")
    user = relationship("User", back_populates="responses")
    answers = relationship("Answer", back_populates="response", cascade="all, delete-orphan")


class Answer(Base):
    __tablename__ = "answers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    response_id = Column(UUID(as_uuid=True), ForeignKey("survey_responses.id", ondelete="CASCADE"), nullable=False)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id"), nullable=False)
    option_id = Column(UUID(as_uuid=True), ForeignKey("question_options.id"), nullable=True)  # NULL para open-ended

    # Para respuestas abiertas
    answer_text = Column(Text)

    # Para ratings
    rating = Column(Integer)

    # Para distribución porcentual: {"infraestructura": 40, "salud": 30, "limpieza": 30}
    # Para selección múltiple: array de option_ids se maneja por relaciones, pero podemos guardar aquí también
    percentage_data = Column(JSONB)

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    response = relationship("SurveyResponse", back_populates="answers")
    question = relationship("Question", back_populates="answers")
    option = relationship("QuestionOption", back_populates="answers")

    # Constraint: rating debe estar en rango válido si existe
    __table_args__ = (
        CheckConstraint('rating IS NULL OR (rating >= 1 AND rating <= 5)', name='valid_rating'),
    )
