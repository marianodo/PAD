from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from uuid import UUID
from typing import Optional, List, Union
from datetime import date
import io

from app.db.base import get_db
from app.services.survey_service import SurveyService
from app.schemas.survey import SurveyResponse, SurveyCreate
from app.schemas.response import SurveyResponseCreate, SurveyResponseResponse
from app.api.dependencies import get_current_user, get_current_admin, get_current_account
from app.models.user import User
from app.models.admin import Admin
from app.models.client import Client
from pydantic import BaseModel

router = APIRouter()


class ToggleSurveyRequest(BaseModel):
    is_active: bool


@router.get("/", response_model=List[SurveyResponse])
def get_surveys(
    current_user: Union[User, Admin, Client] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene las encuestas según el tipo de cuenta:
    - Admin: ve todas las encuestas
    - Client: ve solo sus encuestas
    - User: no tiene acceso a esta ruta
    """
    if isinstance(current_user, Admin):
        # Admin ve todas las encuestas
        surveys = SurveyService.get_all_surveys(db)
    elif isinstance(current_user, Client):
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
        # Verificar que la encuesta esté activa
        survey = SurveyService.get_survey_by_id(db, response_data.survey_id)
        if not survey:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Encuesta no encontrada"
            )
        if not survey.is_active:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Esta encuesta no está disponible actualmente"
            )

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


@router.get("/{survey_id}/results")
def get_survey_results(
    survey_id: UUID,
    date_from: Optional[date] = Query(None, description="Fecha inicio del período (YYYY-MM-DD)"),
    date_to: Optional[date] = Query(None, description="Fecha fin del período (YYYY-MM-DD)"),
    current_user: Union[User, Admin, Client] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene los resultados y estadísticas de una encuesta.
    Solo accesible para admin y cliente dueño de la encuesta.
    Opcionalmente filtra por período con date_from y date_to.
    """
    # Verificar que la encuesta existe
    survey = SurveyService.get_survey_by_id(db, survey_id)
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encuesta no encontrada"
        )

    # Verificar permisos
    if isinstance(current_user, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver resultados"
        )

    if isinstance(current_user, Client) and survey.client_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para ver esta encuesta"
        )

    # Obtener resultados
    results = SurveyService.get_survey_results(db, survey_id, date_from=date_from, date_to=date_to)
    return results


@router.patch("/{survey_id}/toggle")
def toggle_survey_status(
    survey_id: UUID,
    toggle_data: ToggleSurveyRequest,
    current_account: Union[Admin, Client] = Depends(get_current_account),
    db: Session = Depends(get_db)
):
    """
    Activa o desactiva una encuesta.
    Accesible para admin y client.
    """
    if not isinstance(current_account, (Admin, Client)):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos para esta acción"
        )

    # Verificar que la encuesta existe
    survey = SurveyService.get_survey_by_id(db, survey_id)
    if not survey:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Encuesta no encontrada"
        )

    # Actualizar estado
    survey.is_active = toggle_data.is_active
    survey.status = "active" if toggle_data.is_active else "inactive"
    db.commit()
    db.refresh(survey)

    return {
        "id": str(survey.id),
        "is_active": survey.is_active,
        "message": f"Encuesta {'activada' if toggle_data.is_active else 'desactivada'} exitosamente"
    }


@router.get("/{survey_id}/segments")
def get_survey_segments(
    survey_id: UUID,
    threshold: int = Query(20, ge=1, le=100, description="Umbral mínimo de % para incluir en segmento"),
    current_user: Union[User, Admin, Client] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Obtiene la segmentación de votantes por preferencias.
    Agrupa usuarios que asignaron >= threshold% a cada área.
    """
    survey = SurveyService.get_survey_by_id(db, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    if isinstance(current_user, User):
        raise HTTPException(status_code=403, detail="No tienes permisos")

    if isinstance(current_user, Client) and survey.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta encuesta")

    return SurveyService.get_survey_segments(db, survey_id, threshold=threshold)


@router.get("/{survey_id}/segments/export")
def export_survey_segments(
    survey_id: UUID,
    threshold: int = Query(20, ge=1, le=100, description="Umbral mínimo de % para incluir en segmento"),
    current_user: Union[User, Admin, Client] = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exporta los segmentos a un archivo XLSX con un tab por segmento.
    """
    survey = SurveyService.get_survey_by_id(db, survey_id)
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")

    if isinstance(current_user, User):
        raise HTTPException(status_code=403, detail="No tienes permisos")

    if isinstance(current_user, Client) and survey.client_id != current_user.id:
        raise HTTPException(status_code=403, detail="No tienes permisos para ver esta encuesta")

    data = SurveyService.get_survey_segments(db, survey_id, threshold=threshold)

    try:
        from openpyxl import Workbook
        from openpyxl.styles import Font, PatternFill, Alignment
    except ImportError:
        raise HTTPException(status_code=500, detail="openpyxl no está instalado")

    wb = Workbook()
    # Eliminar la hoja por defecto
    wb.remove(wb.active)

    header_font = Font(bold=True, color="FFFFFF", size=11)
    header_fill = PatternFill(start_color="2563EB", end_color="2563EB", fill_type="solid")

    for segment in data["segments"]:
        # Nombre de hoja (max 31 chars para Excel)
        sheet_name = segment["area"][:31]
        ws = wb.create_sheet(title=sheet_name)

        # Headers
        headers = ["Nombre", "Email", "Barrio", "Ciudad", "% Asignado"]
        for col, header in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = Alignment(horizontal="center")

        # Datos
        for row_idx, user in enumerate(segment["users"], 2):
            ws.cell(row=row_idx, column=1, value=user["name"])
            ws.cell(row=row_idx, column=2, value=user["email"])
            ws.cell(row=row_idx, column=3, value=user["neighborhood"])
            ws.cell(row=row_idx, column=4, value=user["city"])
            ws.cell(row=row_idx, column=5, value=f"{user['percentage']}%")

        # Auto-ajustar ancho de columnas
        for col in ws.columns:
            max_length = 0
            for cell in col:
                if cell.value:
                    max_length = max(max_length, len(str(cell.value)))
            ws.column_dimensions[col[0].column_letter].width = min(max_length + 4, 40)

    # Si no hay segmentos, crear hoja vacía
    if not data["segments"]:
        ws = wb.create_sheet(title="Sin segmentos")
        ws.cell(row=1, column=1, value="No se encontraron segmentos con el umbral seleccionado")

    # Guardar en buffer
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    filename = f"segmentos_{survey.title[:30].replace(' ', '_')}.xlsx"

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
