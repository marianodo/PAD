"""
Script para agregar 1000 respuestas diversas a una encuesta existente.
Genera usuarios nuevos con barrios variados y respuestas con alta diversidad
en distribución de presupuesto y calificación de gestión.

Ejecutar: cd backend && python -m scripts.add_diverse_responses
"""

import sys
import os
import random
from datetime import datetime, timedelta, date
from typing import List, Dict

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.user import User
from app.models.survey import Survey, Question, QuestionOption, QuestionType
from app.models.response import SurveyResponse, Answer
import bcrypt

SURVEY_ID = "5a986dda-437e-40ae-a43e-3ad72ec54fb9"

# Todos los barrios incluyendo los nuevos
BARRIOS = [
    "Centro", "San Martín", "Villa Parque", "La Perla", "Parque del Virrey",
    "Barrio Córdoba", "Barrio Norte", "Pellegrini", "El Golf", "Sabattini",
    "Paravachasca", "Los Nogales", "Villa del Prado", "General Bustos",
    "Poluyan", "Altos de Alta Gracia", "Camara", "Los Molles", "Santa María",
    "Don Bosco", "Cafferata", "Barrio Sur", "Villa Oviedo", "Barrio Obrero",
    "Residencial Alta Gracia", "Reserva Tajamar", "Lomas del Golf",
    "Colinas del Sur", "Crucero Sur", "Liniers II de Horizonte", "Lalahenes",
    "Serralta", "Liniers", "Alta Gracia Country Golf", "Prohas II",
    "Touring Club", "Villa Juana", "Asociación la Esperanza",
    "Bª Parque San Juan", "Prohas I Jardín Estancia", "Valerio",
    "Portales del Tala", "Plano Viejo", "Santa Teresa de Jesús",
    "Buena Esperanza", "El Cañito", "La Verde", "Sur", "Villa Camiares",
    "1° de Mayo", "Tiro Federal", "Alta Gracia Norte",
    "Liniers III de Horizonte", "La Hornilla", "25 de Mayo",
    "Piedra del Sapo", "Parque Casino", "Crucero de Horizonte",
    "Ala Industrial", "Córdoba", "B° El Mirador", "El Crucero",
    "Terrazas del Cielo", "Tres Gracias", "B° Lomas de la Estancia",
    "Portales del Sol", "Norte", "La Rinconada", "El Potrerillo", "Prohas III",
]

NOMBRES_MASCULINOS = [
    "Juan", "Carlos", "José", "Luis", "Miguel", "Francisco", "Pedro",
    "Diego", "Pablo", "Alejandro", "Martín", "Sebastián", "Nicolás",
    "Matías", "Lucas", "Tomás", "Santiago", "Federico", "Andrés", "Gabriel",
    "Fernando", "Ricardo", "Roberto", "Eduardo", "Sergio", "Daniel",
]

NOMBRES_FEMENINOS = [
    "María", "Ana", "Laura", "Claudia", "Silvia", "Patricia", "Mónica",
    "Sandra", "Gabriela", "Verónica", "Alejandra", "Carolina", "Valeria",
    "Florencia", "Luciana", "Mariana", "Soledad", "Agustina", "Camila",
    "Julieta", "Sofía", "Victoria", "Paula", "Daniela", "Andrea",
]

APELLIDOS = [
    "González", "Rodríguez", "Martínez", "López", "García", "Fernández",
    "Pérez", "Sánchez", "Romero", "Díaz", "Torres", "Álvarez", "Ruiz",
    "Ramírez", "Flores", "Acosta", "Medina", "Herrera", "Castro", "Vargas",
    "Ríos", "Córdoba", "Molina", "Silva", "Moreno", "Ortiz", "Gutiérrez",
]


# --- Perfiles de distribución de presupuesto ---
# Cada perfil define una tendencia diferente para generar diversidad
BUDGET_PROFILES = [
    # Perfil 1: Prioriza seguridad
    {"infraestructura": 10, "servicios": 10, "seguridad": 35, "salud": 15, "ayuda_social": 10, "deportes_cultura": 10, "espacios_publicos": 10},
    # Perfil 2: Prioriza salud
    {"infraestructura": 10, "servicios": 15, "seguridad": 10, "salud": 35, "ayuda_social": 15, "deportes_cultura": 5, "espacios_publicos": 10},
    # Perfil 3: Prioriza deportes y cultura
    {"infraestructura": 5, "servicios": 10, "seguridad": 10, "salud": 5, "ayuda_social": 5, "deportes_cultura": 40, "espacios_publicos": 25},
    # Perfil 4: Prioriza espacios públicos
    {"infraestructura": 10, "servicios": 10, "seguridad": 10, "salud": 10, "ayuda_social": 5, "deportes_cultura": 15, "espacios_publicos": 40},
    # Perfil 5: Prioriza ayuda social
    {"infraestructura": 5, "servicios": 15, "seguridad": 10, "salud": 15, "ayuda_social": 40, "deportes_cultura": 5, "espacios_publicos": 10},
    # Perfil 6: Prioriza servicios
    {"infraestructura": 10, "servicios": 40, "seguridad": 15, "salud": 10, "ayuda_social": 10, "deportes_cultura": 5, "espacios_publicos": 10},
    # Perfil 7: Equilibrado
    {"infraestructura": 15, "servicios": 15, "seguridad": 15, "salud": 15, "ayuda_social": 13, "deportes_cultura": 13, "espacios_publicos": 14},
    # Perfil 8: Infraestructura moderada (no dominante)
    {"infraestructura": 25, "servicios": 15, "seguridad": 15, "salud": 15, "ayuda_social": 10, "deportes_cultura": 10, "espacios_publicos": 10},
]

# Peso de cada perfil (controla cuántos usuarios caen en cada perfil)
PROFILE_WEIGHTS = [15, 15, 12, 12, 12, 10, 14, 10]


def generate_cuil(birth_date: date, is_male: bool) -> str:
    prefix = "20" if is_male else "27"
    dni = str(random.randint(10000000, 45000000))
    verificador = str(random.randint(0, 9))
    return f"{prefix}{dni}{verificador}"


def generate_birth_date(min_age: int, max_age: int) -> date:
    today = date.today()
    age = random.randint(min_age, max_age)
    year = today.year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(year, month, day)


def generate_diverse_percentage(options: List[QuestionOption], profile: dict) -> Dict:
    """Genera distribución porcentual basada en un perfil con variación aleatoria."""
    option_map = {opt.option_value: opt for opt in options}
    percentages = {}

    for key, base_weight in profile.items():
        if key in option_map:
            opt = option_map[key]
            # Variación aleatoria de ±10% para mayor diversidad
            pct = base_weight + random.uniform(-10, 10)
            pct = max(1, pct)  # mínimo 1%
            percentages[str(opt.id)] = round(pct, 1)

    # Normalizar para que sume 100
    total_pct = sum(percentages.values())
    if total_pct > 0:
        factor = 100 / total_pct
        percentages = {k: round(v * factor, 1) for k, v in percentages.items()}
        diff = 100 - sum(percentages.values())
        first_key = list(percentages.keys())[0]
        percentages[first_key] = round(percentages[first_key] + diff, 1)

    return percentages


def generate_diverse_rating() -> int:
    """
    Genera rating con distribución amplia:
    ~15% Muy mala (1), ~20% Mala (2), ~25% Regular (3), ~20% Buena (4), ~20% Muy buena (5)
    """
    return random.choices([1, 2, 3, 4, 5], weights=[15, 20, 25, 20, 20])[0]


def main():
    print("=" * 60)
    print("AGREGAR 1000 RESPUESTAS DIVERSAS")
    print("=" * 60)

    db = SessionLocal()

    try:
        survey = db.query(Survey).filter(Survey.id == SURVEY_ID).first()
        if not survey:
            print(f"ERROR: No se encontró la encuesta {SURVEY_ID}")
            return

        print(f"Encuesta: {survey.title} (ID: {survey.id})")

        # Obtener preguntas
        questions = db.query(Question).filter(
            Question.survey_id == survey.id
        ).order_by(Question.order_index).all()

        percentage_question = None
        single_choice_question = None
        rating_question = None

        for q in questions:
            if q.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                percentage_question = q
            elif q.question_type == QuestionType.SINGLE_CHOICE:
                single_choice_question = q
            elif q.question_type == QuestionType.RATING:
                rating_question = q

        print(f"Preguntas encontradas:")
        print(f"  - Distribución porcentual: {'✓' if percentage_question else '✗'}")
        print(f"  - Selección única: {'✓' if single_choice_question else '✗'}")
        print(f"  - Rating: {'✓' if rating_question else '✗'}")

        if single_choice_question:
            print(f"  Opciones de obra pública:")
            for opt in single_choice_question.options:
                print(f"    - {opt.option_value}: {opt.option_text}")

        # Generar 1000 usuarios nuevos
        print(f"\nGenerando 1000 usuarios nuevos...")
        users = []
        used_cuils = set()
        used_emails = set()
        default_password = bcrypt.hashpw("Test1234!".encode(), bcrypt.gensalt()).decode()

        age_weights = {
            (18, 30): 0.25,
            (31, 45): 0.30,
            (46, 60): 0.25,
            (61, 80): 0.20,
        }

        for i in range(1000):
            age_range = random.choices(
                list(age_weights.keys()),
                weights=list(age_weights.values())
            )[0]

            is_male = random.choice([True, False])
            nombre = random.choice(NOMBRES_MASCULINOS if is_male else NOMBRES_FEMENINOS)
            apellido = random.choice(APELLIDOS)
            birth_date = generate_birth_date(age_range[0], age_range[1])

            cuil = generate_cuil(birth_date, is_male)
            while cuil in used_cuils:
                cuil = generate_cuil(birth_date, is_male)
            used_cuils.add(cuil)

            email_base = f"{nombre.lower()}.{apellido.lower()}{random.randint(1, 99999)}"
            email = f"{email_base}@test.com".replace(" ", "").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
            while email in used_emails:
                email = f"{email_base}{random.randint(1, 99999)}@test.com"
            used_emails.add(email)

            user = User(
                cuil=cuil,
                hashed_password=default_password,
                email=email,
                name=f"{nombre} {apellido}",
                phone=f"3547{random.randint(100000, 999999)}",
                birth_date=birth_date,
                gender="masculino" if is_male else "femenino",
                address=f"Calle {random.randint(1, 200)} #{random.randint(100, 9999)}",
                neighborhood=random.choice(BARRIOS),
                city="Alta Gracia",
                postal_code="5186",
            )
            users.append(user)

        db.add_all(users)
        db.flush()
        print(f"  {len(users)} usuarios creados")

        # Generar respuestas
        print(f"\nGenerando 1000 respuestas diversas...")

        # Distribuir en los últimos 4 meses
        today = datetime.now()
        total_responses = 0

        for user in users:
            # Fecha aleatoria en los últimos 4 meses
            days_ago = random.randint(0, 120)
            response_date = today - timedelta(days=days_ago)

            survey_response = SurveyResponse(
                survey_id=survey.id,
                user_id=user.id,
                completed=True,
                points_earned=survey.points_per_question * len(questions) + survey.bonus_points,
                started_at=response_date,
                completed_at=response_date + timedelta(minutes=random.randint(5, 30)),
            )
            db.add(survey_response)
            db.flush()

            answers = []

            # 1. Distribución porcentual — usar perfiles variados
            if percentage_question:
                profile = random.choices(BUDGET_PROFILES, weights=PROFILE_WEIGHTS)[0]
                percentage_data = generate_diverse_percentage(
                    list(percentage_question.options), profile
                )
                answers.append(Answer(
                    response_id=survey_response.id,
                    question_id=percentage_question.id,
                    percentage_data=percentage_data,
                ))

            # 2. Selección única — distribución más pareja entre opciones
            if single_choice_question:
                options = list(single_choice_question.options)
                # Pesos más equilibrados que el original
                option_weights = [30, 35, 35]  # Más parejo entre las 3 opciones
                if len(options) != 3:
                    option_weights = [1] * len(options)
                selected = random.choices(options, weights=option_weights[:len(options)])[0]
                answers.append(Answer(
                    response_id=survey_response.id,
                    question_id=single_choice_question.id,
                    option_id=selected.id,
                ))

            # 3. Rating — distribución amplia
            if rating_question:
                rating = generate_diverse_rating()
                answers.append(Answer(
                    response_id=survey_response.id,
                    question_id=rating_question.id,
                    rating=rating,
                ))

            db.add_all(answers)
            total_responses += 1

            if total_responses % 200 == 0:
                db.flush()
                print(f"  {total_responses} respuestas generadas...")

        db.commit()
        print(f"\n✓ {total_responses} respuestas generadas exitosamente")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
