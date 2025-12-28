from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID
from app.models.survey import QuestionType


class QuestionOptionResponse(BaseModel):
    """Schema de respuesta para opciones de pregunta"""
    id: UUID
    option_text: str
    option_value: Optional[str] = None
    order_index: Optional[int] = None

    class Config:
        from_attributes = True


class QuestionResponse(BaseModel):
    """Schema de respuesta para pregunta"""
    id: UUID
    question_text: str
    question_type: QuestionType
    order_index: int
    is_required: bool
    config: Dict[str, Any] = {}
    options: List[QuestionOptionResponse] = []

    class Config:
        from_attributes = True


class SurveyResponse(BaseModel):
    """Schema de respuesta para encuesta"""
    id: UUID
    title: str
    description: Optional[str] = None
    status: str
    points_per_question: int
    bonus_points: int
    max_responses_per_user: int = 0
    created_at: datetime
    expires_at: Optional[datetime] = None
    questions: List[QuestionResponse] = []

    class Config:
        from_attributes = True


# Schemas para crear encuestas (Admin)
class QuestionOptionCreate(BaseModel):
    option_text: str
    option_value: Optional[str] = None
    order_index: Optional[int] = None


class QuestionCreate(BaseModel):
    question_text: str
    question_type: QuestionType
    order_index: int
    is_required: bool = True
    config: Dict[str, Any] = {}
    options: List[QuestionOptionCreate] = []


class SurveyCreate(BaseModel):
    title: str
    description: Optional[str] = None
    points_per_question: int = 10
    bonus_points: int = 50
    max_responses_per_user: int = 0
    expires_at: Optional[datetime] = None
    questions: List[QuestionCreate] = []
