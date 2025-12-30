from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List

from app.db.base import get_db
from app.services.survey_service import SurveyService
from app.schemas.survey import SurveyResponse, SurveyCreate
from app.schemas.response import SurveyResponseCreate, SurveyResponseResponse
from app.api.dependencies import get_current_user
from app.models.user import User, UserRole

router = APIRouter()


@router.get("/", response_model=List[SurveyResponse])
def get_surveys(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene las encuestas según el rol del usuario:
    - Admin: ve todas las encuestas
    - Client: ve solo sus encuestas
    - User: no tiene acceso a esta ruta
    """
    if current_user.role == UserRole.ADMIN:
        # Admin ve todas las encuestas
        surveys = SurveyService.get_all_surveys(db)
    elif current_user.role == UserRole.CLIENT:
        # Cliente ve solo sus encuestas
        surveys = SurveyService.get_all_surveys(db, client_id=current_user.id)
    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para acceder a esta funcionalidad"
        )

    return surveys


@router.get("/active", response_model=SurveyResponse)
def get_active_survey(db: Session = Depends(get_db)):
    """Obtiene la encuesta activa actual"""
    survey = SurveyService.get_active_survey(db)
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No hay encuesta activa disponible"
        )
    return survey


@router.get("/{survey_id}", response_model=SurveyResponse)
def get_survey(survey_id: UUID, db: Session = Depends(get_db)):
    """Obtiene una encuesta por ID"""
    survey = SurveyService.get_survey_by_id(db, survey_id)
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encuesta no encontrada"
        )
    return survey


@router.post("/", response_model=SurveyResponse, status_code=status.HTTP_201_CREATED)
def create_survey(survey_data: SurveyCreate, db: Session = Depends(get_db)):
    """Crea una nueva encuesta (Admin)"""
    try:
        survey = SurveyService.create_survey(db, survey_data)
        return survey
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )


@router.post("/responses", response_model=SurveyResponseResponse, status_code=status.HTTP_201_CREATED)
def submit_survey_response(
    response_data: SurveyResponseCreate,
    request: Request,
    db: Session = Depends(get_db)
):
    """Envía una respuesta de encuesta"""
    try:
        # Capturar IP y User Agent
        ip_address = request.client.host if request.client else None
        user_agent = request.headers.get("user-agent")

        response = SurveyService.submit_response(
            db,
            response_data,
            ip_address=ip_address,
            user_agent=user_agent
        )
        return response
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error al procesar la respuesta: {str(e)}"
        )


@router.get("/can-respond/{survey_id}/{user_id}")
def check_can_respond(
    survey_id: UUID,
    user_id: UUID,
    db: Session = Depends(get_db)
):
    """Verifica si un usuario puede responder una encuesta"""
    can_respond = SurveyService.user_can_respond(db, user_id, survey_id)
    return {
        "can_respond": can_respond,
        "message": "Usuario puede responder" if can_respond else "Ya alcanzaste el límite de respuestas para esta encuesta"
    }
