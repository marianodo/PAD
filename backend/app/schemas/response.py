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


class AnswerDetail(BaseModel):
    """Detalle de una respuesta con información de la pregunta"""
    id: UUID
    question_id: UUID
    question_text: str
    question_type: str
    option_id: Optional[UUID] = None
    option_text: Optional[str] = None
    answer_text: Optional[str] = None
    rating: Optional[int] = None
    percentage_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class UserResponseListItem(BaseModel):
    """Item de lista de respuestas de usuario"""
    id: UUID
    survey_id: UUID
    survey_title: str
    completed: bool
    points_earned: int
    started_at: datetime
    completed_at: Optional[datetime] = None

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj: Any) -> "UserResponseListItem":
        """Custom validation to extract survey title from relationship."""
        if hasattr(obj, '__dict__'):
            data = {
                'id': obj.id,
                'survey_id': obj.survey_id,
                'survey_title': obj.survey.title if obj.survey else 'Sin título',
                'completed': obj.completed,
                'points_earned': obj.points_earned,
                'started_at': obj.started_at,
                'completed_at': obj.completed_at,
            }
            return cls(**data)
        return super().model_validate(obj)


class UserResponseDetail(BaseModel):
    """Detalle completo de una respuesta de usuario"""
    id: UUID
    survey_id: UUID
    survey_title: str
    survey_description: Optional[str] = None
    completed: bool
    points_earned: int
    started_at: datetime
    completed_at: Optional[datetime] = None
    answers: List[AnswerDetail] = []

    class Config:
        from_attributes = True

    @classmethod
    def model_validate(cls, obj: Any) -> "UserResponseDetail":
        """Custom validation to extract nested data from relationships."""
        if hasattr(obj, '__dict__'):
            # Process answers
            answers_list = []
            for answer in obj.answers:
                # Convert percentage_data UUIDs to option texts
                percentage_display = None
                if answer.percentage_data and answer.question:
                    percentage_display = {}
                    # Create a map of option IDs to option texts
                    option_map = {str(opt.id): opt.option_text for opt in answer.question.options}
                    for option_id, percentage in answer.percentage_data.items():
                        option_text = option_map.get(option_id, option_id)
                        percentage_display[option_text] = percentage

                answer_data = {
                    'id': answer.id,
                    'question_id': answer.question_id,
                    'question_text': answer.question.question_text if answer.question else '',
                    'question_type': answer.question.question_type if answer.question else '',
                    'option_id': answer.option_id,
                    'option_text': answer.option.option_text if answer.option else None,
                    'answer_text': answer.answer_text,
                    'rating': answer.rating,
                    'percentage_data': percentage_display,
                    'created_at': answer.created_at,
                }
                answers_list.append(AnswerDetail(**answer_data))

            data = {
                'id': obj.id,
                'survey_id': obj.survey_id,
                'survey_title': obj.survey.title if obj.survey else 'Sin título',
                'survey_description': obj.survey.description if obj.survey else None,
                'completed': obj.completed,
                'points_earned': obj.points_earned,
                'started_at': obj.started_at,
                'completed_at': obj.completed_at,
                'answers': answers_list,
            }
            return cls(**data)
        return super().model_validate(obj)
