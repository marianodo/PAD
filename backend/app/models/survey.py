from sqlalchemy import Column, String, Integer, Boolean, DateTime, ForeignKey, func, Text, Enum as SQLEnum
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.base import Base


class QuestionType(str, enum.Enum):
    """Tipos de preguntas soportados"""
    MULTIPLE_CHOICE = "multiple_choice"  # Selección múltiple
    SINGLE_CHOICE = "single_choice"      # Selección única
    PERCENTAGE_DISTRIBUTION = "percentage_distribution"  # Distribución porcentual (suma 100%)
    RATING = "rating"                     # Calificación (estrellas)
    OPEN_TEXT = "open_text"              # Texto abierto


class Survey(Base):
    __tablename__ = "surveys"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="active")  # active, inactive, archived
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)  # Cliente owner de la encuesta
    points_per_question = Column(Integer, default=10)  # Puntos por pregunta respondida
    bonus_points = Column(Integer, default=50)  # Puntos bonus por completar todo
    max_responses_per_user = Column(Integer, default=0)  # 0 = ilimitado, >0 = límite de respuestas
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    expires_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    client = relationship("User", foreign_keys=[client_id])
    questions = relationship("Question", back_populates="survey", cascade="all, delete-orphan")
    responses = relationship("SurveyResponse", back_populates="survey")


class Question(Base):
    __tablename__ = "questions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    survey_id = Column(UUID(as_uuid=True), ForeignKey("surveys.id", ondelete="CASCADE"), nullable=False)
    question_text = Column(Text, nullable=False)
    question_type = Column(SQLEnum(QuestionType), nullable=False)
    order_index = Column(Integer, nullable=False)
    is_required = Column(Boolean, default=True)

    # Configuraciones adicionales por tipo de pregunta
    # Para RATING: {"min": 1, "max": 5}
    # Para PERCENTAGE_DISTRIBUTION: {"must_sum_to": 100}
    config = Column(JSONB, default={})

    # Relationships
    survey = relationship("Survey", back_populates="questions")
    options = relationship("QuestionOption", back_populates="question", cascade="all, delete-orphan")
    answers = relationship("Answer", back_populates="question")


class QuestionOption(Base):
    __tablename__ = "question_options"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    question_id = Column(UUID(as_uuid=True), ForeignKey("questions.id", ondelete="CASCADE"), nullable=False)
    option_text = Column(Text, nullable=False)
    option_value = Column(String(255))  # Valor interno (ej: "infraestructura")
    order_index = Column(Integer)

    # Relationships
    question = relationship("Question", back_populates="options")
    answers = relationship("Answer", back_populates="option")
