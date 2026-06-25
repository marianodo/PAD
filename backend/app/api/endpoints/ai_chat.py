"""
AI Chat endpoint - Chat conversacional sobre datos de consultas usando Claude AI
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from anthropic import Anthropic
from pydantic import BaseModel
import json
import re
from decimal import Decimal
from typing import List, Union
from uuid import UUID

from app.db.base import get_db
from app.api.dependencies import get_current_user
from app.services.survey_service import SurveyService
from app.core.config import settings
from app.models.admin import Admin
from app.models.client import Client
from app.models.user import User
from app.api.endpoints.ai_insights import _json_dumps, _get_client_context
from app.api.endpoints.surveys import ensure_can_view_survey_results

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
        # Autorización: solo admin o el cliente dueño pueden ver datos de esta encuesta
        survey = SurveyService.get_survey_by_id(db, UUID(survey_id))
        if not survey:
            raise HTTPException(status_code=404, detail="Encuesta no encontrada")
        ensure_can_view_survey_results(survey, current_user)

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="ANTHROPIC_API_KEY no está configurada"
            )

        results = SurveyService.get_survey_results(db, UUID(survey_id))
        ctx = _get_client_context(db, survey_id)

        demographics = results.get('demographics', {})
        questions_for_prompt = [
            {
                "pregunta": q.get("question_text"),
                "tipo": q.get("question_type"),
                "resultados_generales": q.get("results"),
                f"resultados_por_{ctx['geo_unit']}": q.get("results_by_city"),
                "resultados_por_barrio": q.get("results_by_neighborhood"),
                "resultados_por_edad": q.get("results_by_age"),
                "resultados_por_genero": q.get("results_by_gender"),
            }
            for q in results.get("questions_summary", [])
        ]

        system_prompt = f"""Eres un asistente de IA especializado en analizar datos de consultas ciudadanas.
Tu UNICA funcion es responder preguntas sobre los datos de esta consulta especifica.

CONTEXTO DEL CLIENTE:
{ctx['context_line']}
Tipo de organismo: {ctx['org_type']}
Unidad geografica: {ctx['geo_unit_plural']} (usa siempre este termino)

DATOS DE LA CONSULTA:

Total de respuestas: {results.get('total_responses', 0)}

DEMOGRAFIA:
- Por edad: {_json_dumps(demographics.get('by_age_group', {}))}
- Por genero: {_json_dumps(demographics.get('by_gender', {}))}
- Por {ctx['geo_unit']}: {_json_dumps(demographics.get('by_city', {}))}
- Por barrio: {_json_dumps(demographics.get('by_neighborhood', {}))}

PREGUNTAS Y RESPUESTAS (con desglose por edad, genero, {ctx['geo_unit']} y barrio):
{_json_dumps(questions_for_prompt)}

EVOLUCION TEMPORAL:
{_json_dumps(results.get('evolution_data', {}))}

REGLAS ESTRICTAS:
1. SOLO responde preguntas relacionadas con estos datos de la consulta.
2. Si te preguntan algo no relacionado con la consulta, responde: "Solo puedo responder preguntas relacionadas con los datos de esta consulta. ¿Qué te gustaría saber sobre los resultados?"
3. Siempre responde en español.
4. Usa datos concretos (números, porcentajes, nombres de {ctx['geo_unit_plural']}) en tus respuestas.
5. Sé conciso pero informativo.
6. NO inventes datos que no estén en el contexto proporcionado.
7. Cuando hables de porcentajes o votos, cita los números exactos del contexto.
8. INSIGHTS: Al final de tu respuesta (despues del grafico si lo hay), agrega un breve insight analitico marcado con "💡 **Insight:**". Puede ser una tendencia, un dato destacado, una comparacion interesante, o una conclusion accionable derivada de los datos. Debe ser util para la toma de decisiones. Ejemplo: "💡 **Insight:** La {ctx['geo_unit']} Centro concentra el 35% de la participacion, lo que sugiere mayor engagement civico en zonas centricas."
9. GRAFICOS: Cuando una pregunta se beneficie de una representacion visual (comparaciones, distribuciones, rankings), incluye UN bloque de grafico en tu respuesta usando este formato exacto:

~~~chart
{{"type": "bar", "title": "Titulo del grafico", "data": [{{"label": "Cat A", "value": 45}}, {{"label": "Cat B", "value": 30}}]}}
~~~

o para pie charts:

~~~chart
{{"type": "pie", "title": "Titulo del grafico", "data": [{{"label": "Cat A", "value": 45}}, {{"label": "Cat B", "value": 30}}]}}
~~~

REGLAS PARA GRAFICOS:
- Solo usa "bar" o "pie" como type.
- Usa "bar" para comparaciones y rankings (ej: votos por proyecto, participacion por {ctx['geo_unit']}).
- Usa "pie" para distribuciones porcentuales (ej: distribucion de presupuesto, genero).
- Los valores deben ser numeros exactos del contexto, NO inventados.
- Maximo 8 categorias. Si hay mas, agrupa las menores en "Otros".
- Titulo descriptivo en español.
- Solo UN grafico por respuesta.
- El bloque ~~~chart debe estar DESPUES del texto explicativo.
- No todos los mensajes necesitan grafico. Solo inclui uno cuando realmente aporte valor visual."""

        # Build messages array from history + new message
        messages = []
        for msg in request.history[-20:]:  # Limit to last 20 messages
            messages.append({"role": msg.role, "content": msg.content})
        messages.append({"role": "user", "content": request.message})

        client = Anthropic(api_key=api_key)
        response = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=1500,
            temperature=0.4,
            system=system_prompt,
            messages=messages,
        )

        raw_text = response.content[0].text

        # Extract chart blocks from the response (handles ~~~chart, ```chart, variations)
        chart_pattern = r'(?:~~~|```)\s*chart\s*\n(.*?)\n\s*(?:~~~|```)'
        chart_matches = re.findall(chart_pattern, raw_text, re.DOTALL)

        charts = []
        for match in chart_matches:
            try:
                chart_data = json.loads(match.strip())
                if chart_data.get("type") in ("bar", "pie") and "data" in chart_data:
                    charts.append(chart_data)
            except json.JSONDecodeError:
                pass

        # Fallback: detect loose JSON chart objects in text
        if not charts:
            json_pattern = r'\{[^{}]*"type"\s*:\s*"(?:bar|pie)"[^{}]*"data"\s*:\s*\[.*?\]\s*\}'
            json_matches = re.findall(json_pattern, raw_text, re.DOTALL)
            for match in json_matches:
                try:
                    chart_data = json.loads(match.strip())
                    if chart_data.get("type") in ("bar", "pie") and "data" in chart_data:
                        charts.append(chart_data)
                except json.JSONDecodeError:
                    pass

        # Remove chart blocks and loose JSON charts from text
        clean_text = re.sub(r'(?:~~~|```)\s*chart\s*\n.*?\n\s*(?:~~~|```)', '', raw_text, flags=re.DOTALL)
        if charts:
            for chart in charts:
                # Remove the JSON string from text
                chart_str = json.dumps(chart, ensure_ascii=False)
                clean_text = clean_text.replace(chart_str, '')
            # Also remove any remaining raw JSON chart patterns
            clean_text = re.sub(r'\{[^{}]*"type"\s*:\s*"(?:bar|pie)"[^{}]*"data"\s*:\s*\[.*?\]\s*\}', '', clean_text, flags=re.DOTALL)
        clean_text = clean_text.strip()

        return {"response": clean_text, "charts": charts}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Error al procesar el mensaje: {str(e)}"
        )
