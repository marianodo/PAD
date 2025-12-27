from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.db.base import get_db
from app.models.user import User
from app.models.response import SurveyResponse, Answer
from app.models.survey import Survey, Question, QuestionOption
from app.api.dependencies import get_current_user
from app.schemas.response import UserResponseListItem, UserResponseDetail

router = APIRouter()


@router.get("/my-responses", response_model=List[UserResponseListItem])
def get_my_responses(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get all survey responses for the current user."""

    responses = db.query(SurveyResponse)\
        .filter(SurveyResponse.user_id == current_user.id)\
        .order_by(SurveyResponse.started_at.desc())\
        .all()

    # Manually convert to schema
    return [UserResponseListItem.model_validate(r) for r in responses]


@router.get("/my-responses/{response_id}", response_model=UserResponseDetail)
def get_response_detail(
    response_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get detailed information about a specific response."""

    response = db.query(SurveyResponse)\
        .filter(
            SurveyResponse.id == response_id,
            SurveyResponse.user_id == current_user.id
        )\
        .first()

    if not response:
        from fastapi import HTTPException, status
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Respuesta no encontrada"
        )

    # Manually convert to schema
    return UserResponseDetail.model_validate(response)
