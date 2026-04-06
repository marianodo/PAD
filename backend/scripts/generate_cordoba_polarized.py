"""
Script para agregar 1000 usuarios con respuestas polarizadas en ciudades nuevas de Córdoba.
Ejecutar desde el directorio backend: python -m scripts.generate_cordoba_polarized

Ciudades "críticas" (gestión pésima, 1 estrella):
  - Villa Dolores, Deán Funes

Ciudades "satisfechas" (gestión excelente, 5 estrellas):
  - Oliva, Leones

Ciudades neutras (distribución normal):
  - Morteros, Marcos Juárez, Río Tercero
"""

import sys
import os
import random
from datetime import datetime, timedelta, date
from typing import List, Dict
from uuid import UUID

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.user import User
from app.models.survey import Survey, Question, QuestionOption, QuestionType
from app.models.response import SurveyResponse, Answer
from app.models.points import PointTransaction, UserPoints
import bcrypt

SURVEY_ID = "ccc73cdb-c0e2-4d99-9a88-e383c5505ceb"
CLIENT_ID = "5c1c7c8f-ce11-4329-aad7-1939bb522b9b"

# Ciudades nuevas — ninguna aparece en el script original
LOCALIDADES = {
    # ============================================================
    # CRITICAS: gestión pésima → rating siempre 1, SI/NO muy en contra
    # ============================================================
    "Villa Dolores": {
        "barrios": ["Centro", "La Pampa", "Norte", "Los Aromos", "El Quebracho", "San Roque"],
        "postal": "5870",
        "peso": 20,
        "perfil": "critica",
    },
    "Deán Funes": {
        "barrios": ["Centro", "Barrio Sur", "El Molino", "Los Pinos", "La Cañada"],
        "postal": "5200",
        "peso": 15,
        "perfil": "critica",
    },
    # ============================================================
    # SATISFECHAS: gestión excelente → rating siempre 5, SI/NO muy a favor
    # ============================================================
    "Oliva": {
        "barrios": ["Centro", "Norte", "Barrio Industrial", "Villa Deportiva", "Los Girasoles"],
        "postal": "5720",
        "peso": 20,
        "perfil": "satisfecha",
    },
    "Leones": {
        "barrios": ["Centro", "Barrio Belgrano", "Norte", "Los Talas", "Agronomía"],
        "postal": "2594",
        "peso": 15,
        "perfil": "satisfecha",
    },
    # ============================================================
    # NEUTRAS: distribución normal (similar a ciudades del script original)
    # ============================================================
    "Morteros": {
        "barrios": ["Centro", "Norte", "Barrio Obrero", "Los Almendros", "Industrial"],
        "postal": "2421",
        "peso": 12,
        "perfil": "neutra",
    },
    "Marcos Juárez": {
        "barrios": ["Centro", "Sur", "Villa Belgrano", "Los Ceibos", "Industrial"],
        "postal": "2580",
        "peso": 10,
        "perfil": "neutra",
    },
    "Río Tercero": {
        "barrios": ["Centro", "Norte", "Villa Saenz Peña", "Barrio Nuevo", "Los Algarrobos"],
        "postal": "5850",
        "peso": 8,
        "perfil": "neutra",
    },
}

NOMBRES_MASCULINOS = [
    "Juan", "Carlos", "José", "Luis", "Miguel", "Francisco", "Pedro", "Antonio",
    "Manuel", "Diego", "Pablo", "Alejandro", "Martín", "Sebastián", "Nicolás",
    "Matías", "Lucas", "Tomás", "Santiago", "Federico", "Andrés", "Gabriel",
    "Fernando", "Ricardo", "Roberto", "Eduardo", "Sergio", "Daniel", "Gustavo",
    "Marcelo", "Raúl", "Oscar", "Alberto", "Héctor", "Hugo", "Jorge", "Mario",
]

NOMBRES_FEMENINOS = [
    "María", "Ana", "Laura", "Claudia", "Silvia", "Patricia", "Mónica", "Graciela",
    "Sandra", "Gabriela", "Verónica", "Alejandra", "Carolina", "Valeria", "Romina",
    "Florencia", "Luciana", "Mariana", "Soledad", "Agustina", "Camila", "Martina",
    "Julieta", "Sofía", "Victoria", "Paula", "Daniela", "Andrea", "Cecilia",
    "Natalia", "Lorena", "Paola", "Fernanda", "Eugenia", "Mercedes", "Rosa",
]

APELLIDOS = [
    "González", "Rodríguez", "Martínez", "López", "García", "Fernández", "Pérez",
    "Sánchez", "Romero", "Díaz", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores",
    "Acosta", "Medina", "Herrera", "Castro", "Vargas", "Ríos", "Córdoba", "Molina",
    "Silva", "Moreno", "Ortiz", "Gutiérrez", "Muñoz", "Rojas", "Jiménez", "Navarro",
    "Aguirre", "Domínguez", "Vega", "Sosa", "Luna", "Peralta", "Juárez", "Cabrera",
]


def generate_cuil(is_male: bool) -> str:
    prefix = "20" if is_male else "27"
    dni = str(random.randint(10000000, 45000000))
    verificador = str(random.randint(0, 9))
    return f"{prefix}{dni}{verificador}"


def generate_birth_date(min_age: int = 18, max_age: int = 80) -> date:
    today = date.today()
    age = random.randint(min_age, max_age)
    year = today.year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)
    return date(year, month, day)


def normalize_email(s: str) -> str:
    replacements = {"á": "a", "é": "e", "í": "i", "ó": "o", "ú": "u", "ü": "u", "ñ": "n",
                    "Á": "a", "É": "e", "Í": "i", "Ó": "o", "Ú": "u", "Ñ": "n", " ": ""}
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.lower()


def generate_users(db, num_users: int = 1000) -> List[tuple]:
    """Retorna lista de (User, perfil_ciudad)."""
    print(f"Generando {num_users} usuarios de ciudades nuevas de Córdoba...")

    result = []
    used_cuils = set()
    used_emails = set()

    # Cargar CUILs y emails existentes para evitar colisiones
    existing_cuils = {u.cuil for u in db.query(User.cuil).all()}
    existing_emails = {u.email for u in db.query(User.email).all()}
    used_cuils.update(existing_cuils)
    used_emails.update(existing_emails)

    age_weights = {
        (18, 30): 0.25,
        (31, 45): 0.30,
        (46, 60): 0.25,
        (61, 80): 0.20,
    }

    cities = list(LOCALIDADES.keys())
    weights = [LOCALIDADES[c]["peso"] for c in cities]

    default_password = bcrypt.hashpw("Test1234!".encode(), bcrypt.gensalt()).decode()

    for i in range(num_users):
        city = random.choices(cities, weights=weights)[0]
        loc = LOCALIDADES[city]
        barrio = random.choice(loc["barrios"])
        postal = loc["postal"]
        perfil = loc["perfil"]

        age_range = random.choices(list(age_weights.keys()), weights=list(age_weights.values()))[0]
        is_male = random.choice([True, True, False, False, False])
        nombre = random.choice(NOMBRES_MASCULINOS if is_male else NOMBRES_FEMENINOS)
        apellido = random.choice(APELLIDOS)
        birth_date = generate_birth_date(age_range[0], age_range[1])

        cuil = generate_cuil(is_male)
        attempts = 0
        while cuil in used_cuils and attempts < 100:
            cuil = generate_cuil(is_male)
            attempts += 1
        used_cuils.add(cuil)

        email_base = normalize_email(f"{nombre}.{apellido}{random.randint(1, 9999)}")
        email = f"{email_base}@email.com"
        attempts = 0
        while email in used_emails and attempts < 100:
            email = f"{normalize_email(nombre)}.{normalize_email(apellido)}{random.randint(1, 99999)}@email.com"
            attempts += 1
        used_emails.add(email)

        user = User(
            cuil=cuil,
            hashed_password=default_password,
            email=email,
            name=f"{nombre} {apellido}",
            phone=f"35{random.randint(10, 99)}{random.randint(1000000, 9999999)}",
            birth_date=birth_date,
            gender="masculino" if is_male else "femenino",
            address=f"Calle {random.randint(1, 300)} #{random.randint(100, 9999)}",
            neighborhood=barrio,
            city=city,
            postal_code=postal,
            client_id=UUID(CLIENT_ID),
        )
        result.append((user, perfil))

        if (i + 1) % 100 == 0:
            print(f"  Creados {i + 1} usuarios...")

    users = [u for u, _ in result]
    db.add_all(users)
    db.flush()
    print(f"  {len(users)} usuarios creados.")
    return result


def generate_rating_by_perfil(perfil: str, user_age: int) -> int:
    if perfil == "critica":
        # Casi todos 1, algún 2 muy raramente
        return random.choices([1, 2], weights=[95, 5])[0]
    elif perfil == "satisfecha":
        # Casi todos 5, algún 4 muy raramente
        return random.choices([4, 5], weights=[5, 95])[0]
    else:
        # Distribución normal/crítica moderada
        if user_age < 30:
            weights = [10, 20, 30, 25, 15]
        elif user_age < 45:
            weights = [12, 22, 32, 22, 12]
        elif user_age < 60:
            weights = [15, 25, 30, 20, 10]
        else:
            weights = [12, 20, 32, 25, 11]
        return random.choices([1, 2, 3, 4, 5], weights=weights)[0]


def generate_single_choice_by_perfil(options: List[QuestionOption], perfil: str, user_age: int) -> QuestionOption:
    si_opt = next((o for o in options if o.option_value in ("si", "sí")), None)
    no_opt = next((o for o in options if o.option_value == "no"), None)

    if not si_opt or not no_opt:
        return random.choice(options)

    if perfil == "critica":
        # Rechazan masivamente
        return random.choices([si_opt, no_opt], weights=[3, 97])[0]
    elif perfil == "satisfecha":
        # Apoyan masivamente
        return random.choices([si_opt, no_opt], weights=[92, 8])[0]
    else:
        # Distribución por edad (igual que script original)
        if user_age < 35:
            weights = [15, 85]
        elif user_age < 50:
            weights = [25, 75]
        elif user_age < 65:
            weights = [35, 65]
        else:
            weights = [50, 50]
        return random.choices([si_opt, no_opt], weights=weights)[0]


def generate_percentage_distribution(options: List[QuestionOption], perfil: str, user_age: int) -> Dict[str, float]:
    option_weights = {
        "infraestructura_economica": 60,
        "infraestructura_social":    70,
        "seguridad_justicia":        65,
        "salud_publica":             75,
        "educacion_publica":         70,
        "jubilaciones":              40,
        "empleo":                    55,
        "medio_ambiente":            45,
        "ayuda_social":              50,
        "otro":                      5,
    }

    # Sesgo por perfil
    if perfil == "critica":
        # Priorizan seguridad y empleo — lo que les falta
        option_weights["seguridad_justicia"] += 30
        option_weights["empleo"]             += 30
        option_weights["salud_publica"]      += 15
        option_weights["ayuda_social"]       += 20
        option_weights["infraestructura_economica"] -= 10
    elif perfil == "satisfecha":
        # Distribuyen más equitativamente, más foco en infraestructura
        option_weights["infraestructura_economica"] += 25
        option_weights["infraestructura_social"]    += 20
        option_weights["educacion_publica"]         += 15

    # Sesgo por edad
    if user_age < 30:
        option_weights["educacion_publica"] += 20
        option_weights["empleo"]            += 20
        option_weights["jubilaciones"]      -= 20
    elif user_age < 45:
        option_weights["infraestructura_social"] += 15
        option_weights["educacion_publica"]      += 10
    elif user_age < 60:
        option_weights["salud_publica"]      += 20
        option_weights["seguridad_justicia"] += 15
    else:
        option_weights["salud_publica"]     += 25
        option_weights["jubilaciones"]      += 25
        option_weights["ayuda_social"]      += 15
        option_weights["educacion_publica"] -= 10

    weights = []
    for opt in options:
        w = option_weights.get(opt.option_value or "", 20)
        weights.append(max(1, w))

    weights = [w * random.uniform(0.7, 1.3) for w in weights]
    total = sum(weights)
    raw_pcts = [w / total * 100 for w in weights]
    rounded = [round(p) for p in raw_pcts]
    diff = 100 - sum(rounded)
    if diff != 0:
        max_idx = rounded.index(max(rounded))
        rounded[max_idx] += diff

    return {str(opt.id): float(pct) for opt, pct in zip(options, rounded)}


def generate_responses(db, user_profiles: List[tuple], survey: Survey) -> int:
    print(f"Generando respuestas para {len(user_profiles)} usuarios...")

    questions = db.query(Question).filter(
        Question.survey_id == survey.id
    ).order_by(Question.order_index).all()

    if not questions:
        print("ERROR: No se encontraron preguntas.")
        return 0

    pct_q    = next((q for q in questions if q.question_type == QuestionType.PERCENTAGE_DISTRIBUTION), None)
    single_q = next((q for q in questions if q.question_type == QuestionType.SINGLE_CHOICE), None)
    rating_q = next((q for q in questions if q.question_type == QuestionType.RATING), None)

    pct_opts    = list(pct_q.options) if pct_q else []
    single_opts = list(single_q.options) if single_q else []

    date_start = datetime(2025, 12, 1)
    date_end   = datetime.now()
    date_range_days = (date_end - date_start).days

    total_responses = 0
    random.shuffle(user_profiles)

    for i, (user, perfil) in enumerate(user_profiles):
        r = random.betavariate(2, 1)
        day_offset = int(r * date_range_days)
        response_date = date_start + timedelta(days=day_offset)
        if response_date > date_end:
            response_date = date_end

        user_age = (date.today() - user.birth_date).days // 365

        survey_response = SurveyResponse(
            survey_id=survey.id,
            user_id=user.id,
            completed=True,
            points_earned=(survey.points_per_question or 10) * len(questions) + (survey.bonus_points or 20),
            started_at=response_date,
            completed_at=response_date + timedelta(minutes=random.randint(3, 20)),
        )
        db.add(survey_response)
        db.flush()

        answers = []

        if pct_q and pct_opts:
            pct_data = generate_percentage_distribution(pct_opts, perfil, user_age)
            answers.append(Answer(
                response_id=survey_response.id,
                question_id=pct_q.id,
                percentage_data=pct_data,
            ))

        if single_q and single_opts:
            selected_opt = generate_single_choice_by_perfil(single_opts, perfil, user_age)
            answers.append(Answer(
                response_id=survey_response.id,
                question_id=single_q.id,
                option_id=selected_opt.id,
            ))

        if rating_q:
            rating = generate_rating_by_perfil(perfil, user_age)
            answers.append(Answer(
                response_id=survey_response.id,
                question_id=rating_q.id,
                rating=rating,
            ))

        db.add_all(answers)
        total_responses += 1

        if (i + 1) % 100 == 0:
            db.flush()
            print(f"  {i + 1} respuestas generadas...")

    db.flush()
    print(f"  {total_responses} respuestas generadas.")
    return total_responses


def main():
    print("=" * 60)
    print("GENERADOR POLARIZADO - GOBIERNO DE CÓRDOBA")
    print("=" * 60)
    print()
    print("Perfiles:")
    print("  CRÍTICAS (rating 1★):     Villa Dolores, Deán Funes")
    print("  SATISFECHAS (rating 5★):  Oliva, Leones")
    print("  NEUTRAS (distribución):   Morteros, Marcos Juárez, Río Tercero")
    print()

    db = SessionLocal()
    try:
        survey = db.query(Survey).filter(Survey.id == UUID(SURVEY_ID)).first()
        if not survey:
            print(f"ERROR: No se encontró la encuesta {SURVEY_ID}")
            return

        print(f"Consulta: {survey.title}")

        existing = db.query(User).filter(User.client_id == UUID(CLIENT_ID)).count()
        print(f"Usuarios existentes: {existing} (no se eliminarán)")

        print("\n" + "-" * 40)
        user_profiles = generate_users(db, num_users=1000)

        print("\n" + "-" * 40)
        total = generate_responses(db, user_profiles, survey)

        db.commit()

        print("\n" + "=" * 60)
        print("RESUMEN")
        print("=" * 60)
        print(f"Usuarios agregados:    {len(user_profiles)}")
        print(f"Respuestas generadas:  {total}")
        print(f"Período:               Dic 2025 → Hoy")
        print()
        criticas = sum(1 for _, p in user_profiles if p == "critica")
        satisfechas = sum(1 for _, p in user_profiles if p == "satisfecha")
        neutras = sum(1 for _, p in user_profiles if p == "neutra")
        print(f"  Críticas (1★):    {criticas} usuarios")
        print(f"  Satisfechas (5★): {satisfechas} usuarios")
        print(f"  Neutras:          {neutras} usuarios")
        print("\n¡Datos polarizados generados exitosamente!")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
