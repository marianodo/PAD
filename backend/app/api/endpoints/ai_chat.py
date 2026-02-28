"""
AI Chat endpoint - Chat conversacional sobre datos de encuestas usando Claude AI
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from anthropic import Anthropic
from pydantic import BaseModel
import json
from typing import List, Union
from uuid import UUID

from app.db.base import get_db
from app.api.dependencies import get_current_user
from app.services.survey_service import SurveyService
from app.core.config import settings
from app.models.admin import Admin
from app.models.client import Client
from app.models.user import User

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []


@router.post("/surveys/{survey_id}/chat")
async def chat_with_survey(
    survey_id: str,
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user),
):
    try:
        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="ANTHROPIC_API_KEY no está configurada"
            )

        results = SurveyService.get_survey_results(db, UUID(survey_id))

        system_prompt = f"""Eres un asistente de IA especializado en analizar datos de encuestas ciudadanas.
Tu UNICA funcion es responder preguntas sobre los datos de esta encuesta especifica.

DATOS DE LA ENCUESTA:

Total de respuestas: {results.get('total_responses', 0)}
Respuestas mensuales: {results.get('monthly_responses', 0)}

DEMOGRAFIA:
- Por edad: {json.dumps(results.get('demographics', {}).get('by_age_group', {}), ensure_ascii=False)}
- Por barrio: {json.dumps(results.get('demographics', {}).get('by_neighborhood', {}), ensure_ascii=False)}
- Por ciudad: {json.dumps(results.get('demographics', {}).get('by_city', {}), ensure_ascii=False)}
- Por genero: {json.dumps(results.get('demographics', {}).get('by_gender', {}), ensure_ascii=False)}

PREGUNTAS Y RESPUESTAS (con desglose por edad, genero y barrio):
{json.dumps(results.get('questions_summary', []), indent=2, ensure_ascii=False)}

EVOLUCION TEMPORAL:
{json.dumps(results.get('evolution_data', {}), indent=2, ensure_ascii=False)}

REGLAS ESTRICTAS:
1. SOLO responde preguntas relacionadas con estos datos de la encuesta.
2. Si te preguntan algo no relacionado con la encuesta, responde: "Solo puedo responder preguntas relacionadas con los datos de esta encuesta. ¿Qué te gustaría saber sobre los resultados?"
3. Siempre responde en español.
4. Usa datos concretos (números, porcentajes, nombres de barrios) en tus respuestas.
5. Sé conciso pero informativo.
6. NO inventes datos que no estén en el contexto proporcionado.
7. Cuando hables de porcentajes o votos, cita los números exactos del contexto."""

        # Build messages array from history + new message
        messages = []
        for msg in request.history[-20:]:  # Limit to last 20 messages
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": request.message})

        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=1500,
            temperature=0.4,
            system=system_prompt,
            messages=messages,
        )

        return {"response": response.content[0].text}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el mensaje: {str(e)}"
        )
