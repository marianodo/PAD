"""
AI Insights endpoint - Genera análisis inteligente usando Claude AI
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from anthropic import Anthropic
import json
import os
from typing import List, Dict, Any
from datetime import datetime

from app.db.base import get_db
from app.api.dependencies import get_current_user
from app.services.survey_service import SurveyService
from app.core.config import settings
from uuid import UUID
from typing import Union
from app.models.admin import Admin
from app.models.client import Client
from app.models.user import User
from app.models.ai_insight import AIInsight
import hashlib

router = APIRouter()


@router.get("/surveys/{survey_id}/ai-insights")
async def get_ai_insights(
    survey_id: str,
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user)
):
    """
    Obtiene los insights de IA cacheados para una encuesta.
    Retorna None si no hay insights generados aún.
    """
    cached_insight = db.query(AIInsight).filter(
        AIInsight.survey_id == UUID(survey_id)
    ).order_by(AIInsight.created_at.desc()).first()

    if not cached_insight:
        return {
            "insights": None,
            "from_cache": False,
            "message": "No hay insights generados para esta encuesta"
        }

    return {
        "insights": cached_insight.insights,
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
    Genera insights inteligentes usando Claude AI basándose en los datos de la encuesta.
    Usa cache de la base de datos para evitar regenerar si los datos no cambiaron.

    - force_regenerate: Si es True, regenera los insights aunque exista cache
    """

    # 1. Verificar que existe la API key
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or api_key == "":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada en el servidor"
        )

    try:
        # 2. Obtener datos de la encuesta
        results = SurveyService.get_survey_results(db, UUID(survey_id))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No se encontraron resultados para esta encuesta"
            )

        # 3. Calcular hash de las respuestas para detectar cambios
        total_responses = results.get('total_responses', 0)
        responses_data = json.dumps(results, sort_keys=True)
        responses_hash = hashlib.md5(responses_data.encode()).hexdigest()

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

        # 5. Si no hay cache o se forzó regeneración, generar nuevos insights
        results = SurveyService.get_survey_results(db, UUID(survey_id))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No se encontraron resultados para esta encuesta"
            )

        # 3. Preparar el prompt para Claude
        prompt = f"""Analiza estos datos de una encuesta ciudadana de Alta Gracia, Córdoba, Argentina:

📊 DATOS GENERALES:
- Total de respuestas: {results.get('total_responses', 0)}
- Respuestas este mes: {results.get('total_responses', 0)}

👥 DEMOGRAFÍA:
- Por edad: {json.dumps(results.get('demographics', {}).get('by_age_group', {}), ensure_ascii=False)}
- Por barrio: {json.dumps(results.get('demographics', {}).get('by_neighborhood', {}), ensure_ascii=False)}
- Por ciudad: {json.dumps(results.get('demographics', {}).get('by_city', {}), ensure_ascii=False)}

📈 PREGUNTAS Y RESPUESTAS:
{json.dumps(results.get('questions_summary', []), indent=2, ensure_ascii=False)}

⏰ EVOLUCIÓN TEMPORAL:
{json.dumps(results.get('evolution_data', {}), indent=2, ensure_ascii=False)}

---

Tu tarea es generar EXACTAMENTE 5 insights profundos y accionables en formato JSON.

Cada insight debe tener:
1. **title**: Título corto y llamativo (max 60 caracteres)
2. **description**: Descripción detallada con datos específicos y porcentajes concretos (2-3 oraciones)
3. **recommendation**: Recomendación accionable y específica para el municipio (1-2 oraciones)
4. **impact**: "Alta", "Media" o "Baja"
5. **category**: Una de estas categorías exactas: "participation", "satisfaction", "demographics", "infrastructure", "consensus"

REQUISITOS IMPORTANTES:
- Usa datos REALES y específicos de la encuesta
- Incluye números, porcentajes y nombres concretos
- NO inventes datos que no estén en el contexto
- Detecta patrones, tendencias, brechas, oportunidades
- Sé crítico: menciona tanto fortalezas como áreas de mejora
- Prioriza insights NO OBVIOS que un humano podría pasar por alto
- Usa un tono profesional pero accesible, en español neutro
- Las recomendaciones deben ser directas y accionables, sin muletillas informales

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
            model="claude-3-haiku-20240307",  # Usando Haiku porque es el único disponible con esta API key
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
            print(f"Error parsing JSON: {e}")
            print(f"Response text: {response_text}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al parsear la respuesta de Claude AI: {str(e)}"
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
                "color": "text-green-600",
                "bgColor": "bg-green-50",
                "borderColor": "border-green-100"
            },
            "satisfaction": {
                "icon": "thumbs-up",
                "color": "text-emerald-600",
                "bgColor": "bg-emerald-50",
                "borderColor": "border-emerald-100"
            },
            "demographics": {
                "icon": "users",
                "color": "text-amber-600",
                "bgColor": "bg-amber-50",
                "borderColor": "border-amber-100"
            },
            "infrastructure": {
                "icon": "building",
                "color": "text-indigo-600",
                "bgColor": "bg-indigo-50",
                "borderColor": "border-indigo-100"
            },
            "consensus": {
                "icon": "target",
                "color": "text-red-600",
                "bgColor": "bg-red-50",
                "borderColor": "border-red-100"
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
        model_used = "claude-3-haiku-20240307"
        generated_at = datetime.utcnow()

        # Eliminar insights anteriores de esta encuesta
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
    except Exception as e:
        print(f"Error generando AI insights: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar insights con Claude AI: {str(e)}"
        )


@router.post("/surveys/{survey_id}/ai-predictions")
async def generate_ai_predictions(
    survey_id: str,
    db: Session = Depends(get_db),
    current_user: Union[User, Admin, Client] = Depends(get_current_user)
):
    """
    Genera predicciones y proyecciones usando Claude AI basándose en los datos de la encuesta.
    """

    # 1. Verificar que existe la API key
    api_key = settings.ANTHROPIC_API_KEY
    if not api_key or api_key == "":
        raise HTTPException(
            status_code=500,
            detail="ANTHROPIC_API_KEY no configurada en el servidor"
        )

    try:
        # 2. Obtener datos de la encuesta
        results = SurveyService.get_survey_results(db, UUID(survey_id))

        if not results:
            raise HTTPException(
                status_code=404,
                detail="No se encontraron resultados para esta encuesta"
            )

        # 3. Preparar el prompt para predicciones
        total_responses = results.get('total_responses', 0)

        prompt = f"""Eres un analista de datos experto en proyecciones estadísticas para gobiernos municipales.

Analiza estos datos de una encuesta ciudadana de Alta Gracia, Córdoba, Argentina:

📊 DATOS GENERALES:
- Total de respuestas: {total_responses}

📈 EVOLUCIÓN TEMPORAL:
{json.dumps(results.get('evolution_data', {}), indent=2, ensure_ascii=False)}

👥 DEMOGRAFÍA:
{json.dumps(results.get('demographics', {}), indent=2, ensure_ascii=False)}

📊 RESPUESTAS:
{json.dumps(results.get('questions_summary', []), indent=2, ensure_ascii=False)}

---

Genera EXACTAMENTE 3 predicciones en formato JSON.

Cada predicción debe tener:
1. **icon**: Un emoji representativo (ej: "👥", "📈", "🏗️")
2. **title**: Título corto (max 50 caracteres)
3. **description**: Proyección específica con números concretos (2-3 oraciones)
4. **confidence**: Número entre 70-95 representando % de confianza

REQUISITOS:
- Usa SOLO datos reales de la encuesta para calcular proyecciones
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
            model="claude-3-haiku-20240307",
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
            print(f"Error parsing predictions JSON: {e}")
            print(f"Response: {response_text}")
            raise HTTPException(
                status_code=500,
                detail=f"Error al parsear predicciones de Claude AI: {str(e)}"
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
                responses_hash=hashlib.md5(json.dumps(results, sort_keys=True).encode()).hexdigest(),
                total_responses=total_responses,
                insights=[],  # Vacío por ahora
                predictions=predictions,
                model="claude-3-haiku-20240307",
                generated_at=datetime.utcnow()
            )
            db.add(new_insight)
            db.commit()

        return {
            "predictions": predictions,
            "generated_at": datetime.utcnow().isoformat(),
            "model": "claude-3-haiku-20240307",
            "total_responses_analyzed": total_responses
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error generando AI predictions: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Error al generar predicciones con Claude AI: {str(e)}"
        )
