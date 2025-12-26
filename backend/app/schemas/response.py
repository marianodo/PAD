from pydantic import BaseModel, field_validator
from typing import Optional, List, Dict, Any
from datetime import datetime
from uuid import UUID


class AnswerCreate(BaseModel):
    """Schema para crear una respuesta a una pregunta"""
    question_id: UUID
    option_id: Optional[UUID] = None  # Para single/multiple choice
    answer_text: Optional[str] = None  # Para open text
    rating: Optional[int] = None  # Para rating (1-5)
    percentage_data: Optional[Dict[str, float]] = None  # Para distribución porcentual

    @field_validator('rating')
    @classmethod
    def validate_rating(cls, v):
        if v is not None and (v < 1 or v > 5):
            raise ValueError('Rating must be between 1 and 5')
        return v

    @field_validator('percentage_data')
    @classmethod
    def validate_percentage(cls, v):
        if v is not None:
            total = sum(v.values())
            if abs(total - 100.0) > 0.01:  # Tolerancia para decimales
                raise ValueError(f'Percentages must sum to 100, got {total}')
            for key, value in v.items():
                if value < 0 or value > 100:
                    raise ValueError(f'Each percentage must be between 0 and 100, got {value} for {key}')
        return v


class AnswerResponse(AnswerCreate):
    """Schema de respuesta para una respuesta"""
    id: UUID
    response_id: UUID
    created_at: datetime

    class Config:
        from_attributes = True


class SurveyResponseCreate(BaseModel):
    """Schema para iniciar o completar una respuesta de encuesta"""
    survey_id: UUID
    user_id: UUID
    answers: List[AnswerCreate] = []
    completed: bool = False


class SurveyResponseResponse(BaseModel):
    """Schema de respuesta para respuesta de encuesta"""
    id: UUID
    survey_id: UUID
    user_id: UUID
    completed: bool
    points_earned: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    answers: List[AnswerResponse] = []

    class Config:
        from_attributes = True
