"""
Script para crear una encuesta de ejemplo en la base de datos.
Ejecutar: python -m scripts.create_sample_survey
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from app.db.base import SessionLocal
from app.models.survey import Survey, Question, QuestionOption, QuestionType


def create_sample_survey():
    db = SessionLocal()

    try:
        # Crear encuesta
        survey = Survey(
            title="Tú Decides - Encuesta Municipal",
            description="Tu opinión es importante para la gestión municipal",
            status="active",
            points_per_question=10,
            bonus_points=50,
            expires_at=datetime.now() + timedelta(days=90),
        )
        db.add(survey)
        db.flush()

        print(f"✓ Encuesta creada: {survey.title} (ID: {survey.id})")

        # Pregunta 1: Distribución Porcentual del Presupuesto
        q1 = Question(
            survey_id=survey.id,
            question_text="¿Dónde te gustaría invertir tu dinero?",
            question_type=QuestionType.PERCENTAGE_DISTRIBUTION,
            order_index=1,
            is_required=True,
            config={"must_sum_to": 100},
        )
        db.add(q1)
        db.flush()

        options_q1 = [
            ("INFRAESTRUCTURA MUNICIPAL", "infraestructura", 1),
            ("SERVICIOS PÚBLICOS MUNICIPALES", "servicios", 2),
            ("SEGURIDAD", "seguridad", 3),
            ("SALUD PÚBLICA MUNICIPAL", "salud", 4),
            ("AYUDA SOCIAL", "ayuda_social", 5),
            ("DEPORTES, CULTURA Y TURISMO", "deportes_cultura", 6),
            ("ESPACIOS PÚBLICOS", "espacios_publicos", 7),
        ]

        for text, value, order in options_q1:
            option = QuestionOption(
                question_id=q1.id,
                option_text=text,
                option_value=value,
                order_index=order,
            )
            db.add(option)

        print(f"✓ Pregunta 1 creada: {q1.question_text} ({len(options_q1)} opciones)")

        # Pregunta 2: Selección de Obra Pública
        q2 = Question(
            survey_id=survey.id,
            question_text="¿Qué obra pública elegirías ejecutar con prioridad?",
            question_type=QuestionType.SINGLE_CHOICE,
            order_index=2,
            is_required=True,
        )
        db.add(q2)
        db.flush()

        options_q2 = [
            ("CENTRO CÍVICO MUNICIPAL (Colonia Santa Fe)", "centro_civico", 1),
            ("PARQUE PÚBLICO (Potrero de Loyola)", "parque_publico", 2),
            ("CENTRO DE CONVENCIONES (Ex Casino Sierras Hotel)", "centro_convenciones", 3),
        ]

        for text, value, order in options_q2:
            option = QuestionOption(
                question_id=q2.id,
                option_text=text,
                option_value=value,
                order_index=order,
            )
            db.add(option)

        print(f"✓ Pregunta 2 creada: {q2.question_text} ({len(options_q2)} opciones)")

        # Pregunta 3: Calificación de Gestión
        q3 = Question(
            survey_id=survey.id,
            question_text="¿Cómo calificarías la gestión municipal?",
            question_type=QuestionType.RATING,
            order_index=3,
            is_required=True,
            config={"min": 1, "max": 5},
        )
        db.add(q3)

        print(f"✓ Pregunta 3 creada: {q3.question_text} (Rating 1-5)")

        db.commit()

        print("\n✅ Encuesta de ejemplo creada exitosamente!")
        print(f"ID de la encuesta: {survey.id}")
        print(f"Total de preguntas: {len(survey.questions)}")
        print(f"Puntos totales posibles: {survey.points_per_question * 3 + survey.bonus_points}")

    except Exception as e:
        db.rollback()
        print(f"❌ Error al crear encuesta: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    create_sample_survey()
