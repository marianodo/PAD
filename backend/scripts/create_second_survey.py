"""
Script para crear una segunda encuesta de ejemplo en la base de datos.
Ejecutar: python -m scripts.create_second_survey
"""

import sys
import os

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from app.db.base import SessionLocal
from app.models.survey import Survey, Question, QuestionOption, QuestionType


def create_second_survey():
    db = SessionLocal()

    try:
        # Crear encuesta
        survey = Survey(
            title="Mejoremos Juntos - Plan de Desarrollo Local",
            description="Ayúdanos a definir las prioridades para el desarrollo de nuestra comunidad",
            status="active",
            points_per_question=10,
            bonus_points=50,
            max_responses_per_user=0,  # Ilimitado
            expires_at=datetime.now() + timedelta(days=90),
        )
        db.add(survey)
        db.flush()

        print(f"✓ Encuesta creada: {survey.title} (ID: {survey.id})")

        # Pregunta 1: Prioridades de mejora en el barrio
        q1 = Question(
            survey_id=survey.id,
            question_text="¿Cuáles son tus prioridades para mejorar el barrio?",
            question_type=QuestionType.SINGLE_CHOICE,
            order_index=1,
            is_required=True,
        )
        db.add(q1)
        db.flush()

        options_q1 = [
            ("Iluminación en calles y espacios públicos", "iluminacion", 1),
            ("Mantenimiento de calles y veredas", "calles_veredas", 2),
            ("Espacios verdes y plazas", "espacios_verdes", 3),
            ("Transporte público", "transporte", 4),
            ("Seguridad ciudadana", "seguridad", 5),
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

        # Pregunta 2: Distribución de presupuesto en áreas prioritarias
        q2 = Question(
            survey_id=survey.id,
            question_text="¿Cómo distribuirías el presupuesto en estas áreas prioritarias?",
            question_type=QuestionType.PERCENTAGE_DISTRIBUTION,
            order_index=2,
            is_required=True,
            config={"must_sum_to": 100},
        )
        db.add(q2)
        db.flush()

        options_q2 = [
            ("EDUCACIÓN Y CAPACITACIÓN", "educacion", 1),
            ("MEDIO AMBIENTE Y SUSTENTABILIDAD", "medio_ambiente", 2),
            ("ECONOMÍA LOCAL Y EMPLEO", "economia", 3),
            ("CULTURA Y RECREACIÓN", "cultura", 4),
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

        # Pregunta 3: Calificación de satisfacción con servicios municipales
        q3 = Question(
            survey_id=survey.id,
            question_text="¿Qué tan satisfecho estás con los servicios municipales actuales?",
            question_type=QuestionType.RATING,
            order_index=3,
            is_required=True,
            config={"min": 1, "max": 5},
        )
        db.add(q3)

        print(f"✓ Pregunta 3 creada: {q3.question_text} (Rating 1-5)")

        db.commit()

        print("\n✅ Segunda encuesta creada exitosamente!")
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
    create_second_survey()
