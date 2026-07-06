"""
AI Insights endpoint - Genera análisis inteligente usando Claude AI
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from anthropic import Anthropic
import json
import os
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from decimal import Decimal

logger = logging.getLogger(__name__)

from app.db.base import get_db
from app.api.dependencies import get_current_user
from app.services.survey_service import SurveyService
from app.core.config import settings
from uuid import UUID
from typing import Union
from app.models.admin import Admin
from app.models.client import Client
from app.models.survey import Survey
from app.models.user import User
from app.models.ai_insight import AIInsight
import hashlib

router = APIRouter()


class _DecimalEncoder(json.JSONEncoder):
    """JSON encoder que convierte Decimal (resultado de AVG en PostgreSQL) a float."""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def _json_dumps(obj) -> str:
    return json.dumps(obj, cls=_DecimalEncoder, ensure_ascii=False)


def _ensure_can_view_survey(db: Session, survey_id: str, account: Union[User, Admin, Client]) -> None:
    """Valida que la encuesta exista y que la cuenta pueda ver sus datos (admin o cliente dueño)."""
    from app.api.endpoints.surveys import ensure_can_view_survey_results
    survey = db.query(Survey).filter(Survey.id == UUID(survey_id)).first()
    if not survey:
        raise HTTPException(status_code=404, detail="Encuesta no encontrada")
    ensure_can_view_survey_results(survey, account)


def _get_client_context(db: Session, survey_id: str) -> Dict[str, str]:
    """
    Devuelve contexto del cliente asociado a la encuesta para personalizar el prompt.
    Si no hay cliente, devuelve defaults genéricos.
    """
    survey = db.query(Survey).filter(Survey.id == UUID(survey_id)).first()
    if not survey or not survey.client:
        return {
            "org_name": "el organismo",
            "org_type": "municipio/organismo público",
            "geo_unit": "localidad",
            "geo_unit_plural": "localidades",
            "context_line": "",
        }

    client = survey.client
    name = client.name or "el organismo"
    city = client.city or ""
    description = client.description or ""

    # Determinar tipo de organismo y unidad geográfica
    name_lower = name.lower()
    desc_lower = description.lower()

    if any(w in name_lower or w in desc_lower for w in ["provincia", "provincial", "gobierno de la provincia"]):
        org_type = "gobierno provincial"
        geo_unit = "ciudad"
        geo_unit_plural = "ciudades"
    elif any(w in name_lower or w in desc_lower for w in ["municipio", "municipalidad", "intendencia"]):
        org_type = "municipio"
        geo_unit = "barrio"
        geo_unit_plural = "barrios"
    else:
        org_type = "organismo público"
        geo_unit = "localidad"
        geo_unit_plural = "localidades"

    context_parts = [f"El cliente es {name}"]
    if city:
        context_parts.append(f"con sede en {city}")
    if description:
        context_parts.append(f"({description[:200]})")

    return {
        "org_name": name,
        "org_type": org_type,
        "geo_unit": geo_unit,
        "geo_unit_plural": geo_unit_plural,
        "context_line": ". ".join(context_parts) + ".",
    }


@router.get("/surveys/{survey_id}/ai-insights")
async def get_ai_insights(
    survey_id: str,
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user)
):
    """
    Obtiene los insights de IA cacheados para una consulta.
    Retorna None si no hay insights generados aún.
    """
    _ensure_can_view_survey(db, survey_id, current_user)

    cached_insight = db.query(AIInsight).filter(
        AIInsight.survey_id == UUID(survey_id)
    ).order_by(AIInsight.created_at.desc()).first()

    if not cached_insight:
        return {
            "insights": None,
            "from_cache": False,
            "message": "No hay insights generados para esta consulta"
        }

    return {
        "insights": cached_insight.insights,
        "predictions": cached_insight.predictions if hasattr(cached_insight, 'predictions') else None,
        "generated_at": cached_insight.generated_at.isoformat(),
        "model": cached_insight.model,
        "total_responses_analyzed": cached_insight.total_responses,
        "from_cache": True
    }


@router.post("/surveys/{survey_id}/ai-insights")
async def generate_ai_insights(
    survey_id: str,
    force_regenerate: bool = False,  # Parámetro para forzar regeneración
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user)
):
    """
    Genera insights inteligentes usando Claude AI basándose en los datos de la consulta.
    Usa cache de la base de datos para evitar regenerar si los datos no cambiaron.

    - force_regenerate: Si es True, regenera los insights aunque exista cache
    """
    # 0. Autorización: solo admin o el cliente dueño (evita acceso cross-tenant
    #    y abuso de costo de la API de IA por parte de ciudadanos).
    _ensure_can_view_survey(db, survey_id, current_user)

    # 1. Verificar que existe la API key
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or api_key == "":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada en el servidor"
        )

    try:
        # 2. Obtener datos de la consulta
        results = SurveyService.get_survey_results(db, UUID(survey_id))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No se encontraron resultados para esta consulta"
            )

        # 3. Calcular hash liviano (solo total + resultados top-level, no desglose por ciudad)
        total_responses = results.get('total_responses', 0)
        hash_data = {
            "total": total_responses,
            "questions": [
                {"id": q.get("question_id"), "results": q.get("results")}
                for q in results.get("questions_summary", [])
            ]
        }
        responses_hash = hashlib.md5(_json_dumps(hash_data).encode()).hexdigest()

        # 4. Buscar insights en cache
        if not force_regenerate:
            cached_insight = db.query(AIInsight).filter(
                AIInsight.survey_id == UUID(survey_id),
                AIInsight.responses_hash == responses_hash
            ).first()

            if cached_insight:
                return {
                    "insights": cached_insight.insights,
                    "generated_at": cached_insight.generated_at.isoformat(),
                    "model": cached_insight.model,
                    "total_responses_analyzed": cached_insight.total_responses,
                    "from_cache": True
                }

        # 5. Preparar prompt — incluir todos los datos demográficos y por ciudad
        ctx = _get_client_context(db, survey_id)

        def summarize_questions(questions_summary):
            summary = []
            for q in questions_summary:
                summary.append({
                    "pregunta": q.get("question_text"),
                    "tipo": q.get("question_type"),
                    "resultados_generales": q.get("results"),
                    f"resultados_por_{ctx['geo_unit']}": q.get("results_by_city"),
                    "resultados_por_barrio": q.get("results_by_neighborhood"),
                    "resultados_por_edad": q.get("results_by_age"),
                    "resultados_por_genero": q.get("results_by_gender"),
                })
            return summary

        demographics = results.get('demographics', {})

        # Preparar el prompt para Claude
        prompt = f"""Analiza los datos de una consulta ciudadana.

CONTEXTO DEL CLIENTE:
{ctx['context_line']}
Tipo de organismo: {ctx['org_type']}
Unidad geográfica relevante: {ctx['geo_unit_plural']} (usar este término, no "barrios" ni "localidades" si no corresponde)

📊 DATOS GENERALES:
- Total de respuestas: {total_responses}

👥 DEMOGRAFÍA:
- Por edad: {_json_dumps(demographics.get('by_age_group', {}))}
- Por género: {_json_dumps(demographics.get('by_gender', {}))}
- Por {ctx['geo_unit']}: {_json_dumps(demographics.get('by_city', {}))}
- Por barrio: {_json_dumps(demographics.get('by_neighborhood', {}))}

📈 PREGUNTAS Y RESPUESTAS (con desglose por edad, género, {ctx['geo_unit']} y barrio):
{_json_dumps(summarize_questions(results.get('questions_summary', [])))}

⏰ EVOLUCIÓN TEMPORAL (últimos meses):
{_json_dumps(results.get('evolution_data', {}))}

---

Tu tarea es generar EXACTAMENTE 5 insights profundos y accionables en formato JSON.

Cada insight debe tener:
1. **title**: Título corto y llamativo (max 60 caracteres)
2. **description**: Descripción detallada con datos específicos y porcentajes concretos (2-3 oraciones)
3. **recommendation**: Recomendación accionable y específica para {ctx['org_name']} (1-2 oraciones)
4. **impact**: "Alta", "Media" o "Baja"
5. **category**: Una de estas categorías exactas: "participation", "satisfaction", "demographics", "infrastructure", "consensus"

REQUISITOS IMPORTANTES:
- Usa datos REALES y específicos de la consulta
- Incluye números, porcentajes y nombres concretos de {ctx['geo_unit_plural']}
- NO inventes datos que no estén en el contexto
- Detecta patrones, tendencias, brechas, oportunidades entre {ctx['geo_unit_plural']}
- Sé crítico: menciona tanto fortalezas como áreas de mejora
- Prioriza insights NO OBVIOS que un humano podría pasar por alto
- Usa un tono profesional pero accesible, en español neutro
- Las recomendaciones deben ser directas y accionables, dirigidas a {ctx['org_name']}

Responde SOLO con el JSON, sin texto adicional:

[
  {{
    "title": "Título del insight",
    "description": "Descripción detallada con datos específicos...",
    "recommendation": "Recomendación concreta y accionable...",
    "impact": "Alta",
    "category": "participation"
  }}
]"""

        # 4. Llamar a Claude AI
        client = Anthropic(api_key=api_key)

        message = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=2500,
            temperature=0.3,  # Más determinístico para análisis
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # 5. Extraer y parsear la respuesta
        response_text = message.content[0].text

        # Intentar extraer el JSON si viene con texto adicional
        try:
            # Buscar el array JSON en la respuesta
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start != -1 and end > start:
                json_text = response_text[start:end]
                insights = json.loads(json_text)
            else:
                insights = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error("Error parsing insights JSON from Claude: %s", e)
            raise HTTPException(
                status_code=500,
                detail="Error al procesar la respuesta de IA"
            )

        # 6. Validar estructura de los insights
        required_fields = ["title", "description", "recommendation", "impact", "category"]
        for insight in insights:
            for field in required_fields:
                if field not in insight:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Insight inválido: falta el campo '{field}'"
                    )

        # 7. Mapear categorías a iconos y colores
        category_config = {
            "participation": {
                "icon": "trending-up",
                "color": "text-[#00CCBA]",
                "bgColor": "bg-[#00CCBA]/10",
                "borderColor": "border-[#00CCBA]/20"
            },
            "satisfaction": {
                "icon": "thumbs-up",
                "color": "text-emerald-400",
                "bgColor": "bg-emerald-500/10",
                "borderColor": "border-emerald-500/20"
            },
            "demographics": {
                "icon": "users",
                "color": "text-amber-400",
                "bgColor": "bg-amber-500/10",
                "borderColor": "border-amber-500/20"
            },
            "infrastructure": {
                "icon": "building",
                "color": "text-[#7B6FD4]",
                "bgColor": "bg-[#5941CE]/10",
                "borderColor": "border-[#5941CE]/20"
            },
            "consensus": {
                "icon": "target",
                "color": "text-red-400",
                "bgColor": "bg-red-500/10",
                "borderColor": "border-red-500/20"
            }
        }

        # Agregar configuración visual a cada insight
        for insight in insights:
            category = insight.get("category", "participation")
            config = category_config.get(category, category_config["participation"])
            insight.update({
                "id": f"ai-{category}-{datetime.utcnow().timestamp()}",
                "icon": config["icon"],
                "color": config["color"],
                "bgColor": config["bgColor"],
                "borderColor": config["borderColor"]
            })

        # 8. Guardar insights en cache (base de datos)
        model_used = settings.CLAUDE_MODEL
        generated_at = datetime.utcnow()

        # Eliminar insights anteriores de esta consulta
        db.query(AIInsight).filter(AIInsight.survey_id == UUID(survey_id)).delete()

        # Crear nuevo registro
        new_insight = AIInsight(
            survey_id=UUID(survey_id),
            responses_hash=responses_hash,
            total_responses=total_responses,
            insights=insights,
            model=model_used,
            generated_at=generated_at
        )
        db.add(new_insight)
        db.commit()

        return {
            "insights": insights,
            "generated_at": generated_at.isoformat(),
            "model": model_used,
            "total_responses_analyzed": total_responses,
            "from_cache": False
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generando AI insights")
        raise HTTPException(
            status_code=500,
            detail="Error al generar insights con IA"
        )


@router.post("/surveys/{survey_id}/ai-predictions")
async def generate_ai_predictions(
    survey_id: str,
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user)
):
    """
    Genera predicciones y proyecciones usando Claude AI basándose en los datos de la consulta.
    """
    # 0. Autorización: solo admin o el cliente dueño (evita acceso cross-tenant
    #    y abuso de costo de la API de IA por parte de ciudadanos).
    _ensure_can_view_survey(db, survey_id, current_user)

    # 1. Verificar que existe la API key
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or api_key == "":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada en el servidor"
        )

    try:
        # 2. Obtener datos de la consulta
        results = SurveyService.get_survey_results(db, UUID(survey_id))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No se encontraron resultados para esta consulta"
            )

        # 3. Preparar el prompt para predicciones
        total_responses = results.get('total_responses', 0)
        demographics = results.get('demographics', {})
        ctx = _get_client_context(db, survey_id)
        questions_pred = [
            {
                "pregunta": q.get("question_text"),
                "tipo": q.get("question_type"),
                "resultados_generales": q.get("results"),
                f"resultados_por_{ctx['geo_unit']}": q.get("results_by_city"),
                "resultados_por_barrio": q.get("results_by_neighborhood"),
            }
            for q in results.get("questions_summary", [])
        ]

        prompt = f"""Eres un analista de datos experto en proyecciones estadísticas para {ctx['org_type']}s.

CONTEXTO DEL CLIENTE:
{ctx['context_line']}

Analiza los datos de una consulta ciudadana:

📊 DATOS GENERALES:
- Total de respuestas: {total_responses}

📈 EVOLUCIÓN TEMPORAL:
{_json_dumps(results.get('evolution_data', {}))}

👥 DEMOGRAFÍA:
- Por edad: {_json_dumps(demographics.get('by_age_group', {}))}
- Por género: {_json_dumps(demographics.get('by_gender', {}))}
- Por {ctx['geo_unit']}: {_json_dumps(demographics.get('by_city', {}))}

📊 RESPUESTAS:
{_json_dumps(questions_pred)}

---

Genera EXACTAMENTE 3 predicciones en formato JSON.

Cada predicción debe tener:
1. **icon**: Un emoji representativo (ej: "👥", "📈", "🏗️")
2. **title**: Título corto (max 50 caracteres)
3. **description**: Proyección específica con números concretos (2-3 oraciones)
4. **confidence**: Número entre 70-95 representando % de confianza

REQUISITOS:
- Usa SOLO datos reales de la consulta para calcular proyecciones
- Incluye números específicos en las proyecciones (ej: "alcanzar X respuestas")
- Proyecciones deben ser realizables en 3-6 meses
- Confidence basado en cantidad de datos disponibles
- Tono profesional y preciso

Responde SOLO con el JSON:

[
  {{
    "icon": "👥",
    "title": "Título corto",
    "description": "Proyección con datos específicos...",
    "confidence": 85
  }}
]"""

        # 4. Llamar a Claude AI
        client = Anthropic(api_key=api_key)

        message = client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=1500,
            temperature=0.3,
            messages=[{
                "role": "user",
                "content": prompt
            }]
        )

        # 5. Parsear respuesta
        response_text = message.content[0].text

        try:
            start = response_text.find('[')
            end = response_text.rfind(']') + 1
            if start != -1 and end > start:
                json_text = response_text[start:end]
                predictions = json.loads(json_text)
            else:
                predictions = json.loads(response_text)
        except json.JSONDecodeError as e:
            logger.error("Error parsing predictions JSON from Claude: %s", e)
            raise HTTPException(
                status_code=500,
                detail="Error al procesar la respuesta de IA"
            )

        # 6. Validar estructura
        required_fields = ["icon", "title", "description", "confidence"]
        for prediction in predictions:
            for field in required_fields:
                if field not in prediction:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Predicción inválida: falta el campo '{field}'"
                    )

        # 7. Guardar en cache junto con insights
        cached_insight = db.query(AIInsight).filter(
            AIInsight.survey_id == UUID(survey_id)
        ).order_by(AIInsight.created_at.desc()).first()

        if cached_insight:
            cached_insight.predictions = predictions
            db.commit()
        else:
            # Crear nuevo registro si no existe
            new_insight = AIInsight(
                survey_id=UUID(survey_id),
                responses_hash=hashlib.md5(_json_dumps(results).encode()).hexdigest(),
                total_responses=total_responses,
                insights=[],  # Vacío por ahora
                predictions=predictions,
                model=settings.CLAUDE_MODEL,
                generated_at=datetime.utcnow()
            )
            db.add(new_insight)
            db.commit()

        return {
            "predictions": predictions,
            "generated_at": datetime.utcnow().isoformat(),
            "model": settings.CLAUDE_MODEL,
            "total_responses_analyzed": total_responses
        }

    except HTTPException:
        raise
    except Exception:
        logger.exception("Error generando AI predictions")
        raise HTTPException(
            status_code=500,
            detail="Error al generar predicciones con IA"
        )
