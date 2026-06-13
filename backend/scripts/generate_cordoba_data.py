"""
Script para generar 1000 usuarios y respuestas para la encuesta del Gobierno de Córdoba.
Ejecutar desde el directorio backend: python -m scripts.generate_cordoba_data
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

# Localidades de la Provincia de Córdoba con sus barrios/zonas
LOCALIDADES = {
    "Córdoba Capital": {
        "barrios": ["Nueva Córdoba", "General Paz", "Cerro de las Rosas", "Güemes", "Alberdi",
                    "Villa Cabrera", "Jardín", "Arguello", "Villa El Libertador", "Bossa",
                    "Residencial América", "Cofico", "Nva. Italia", "Maipú", "Observatorio"],
        "postal": "5000",
        "peso": 35,
    },
    "Río Cuarto": {
        "barrios": ["Centro", "San Martín", "Banda Norte", "Banda Sur", "Alberdi",
                    "Villa del Parque", "Latinoamérica", "Cofico", "Fatima", "Las Delicias"],
        "postal": "5800",
        "peso": 15,
    },
    "Villa María": {
        "barrios": ["Centro", "Norte", "Sur", "Parque Norte", "Los Álamos",
                    "Hipódromo", "Villa Italiana", "Industrial", "La Floresta"],
        "postal": "5900",
        "peso": 10,
    },
    "San Francisco": {
        "barrios": ["Centro", "Belgrano", "Villa Mercedes", "Yapeyú", "Primavera",
                    "San Cayetano", "La Ribera", "Industrial"],
        "postal": "2400",
        "peso": 8,
    },
    "Alta Gracia": {
        "barrios": ["Centro", "Barrio Norte", "Barrio Sur", "Villa Oviedo", "El Golf",
                    "Parque del Virrey", "Camara", "Sabattini", "Santa María"],
        "postal": "5186",
        "peso": 7,
    },
    "Villa Carlos Paz": {
        "barrios": ["Centro", "Cuesta Blanca", "Playas de Oro", "Los Cocos",
                    "Mayu Sumaj", "La Cuesta", "El Sauce"],
        "postal": "5152",
        "peso": 6,
    },
    "Jesús María": {
        "barrios": ["Centro", "Los Olivos", "Villa del Dique", "Colinas", "El Parque"],
        "postal": "5220",
        "peso": 4,
    },
    "Laboulaye": {
        "barrios": ["Centro", "Norte", "Sur", "Industrial", "Los Pinos"],
        "postal": "6120",
        "peso": 3,
    },
    "Bell Ville": {
        "barrios": ["Centro", "Norte", "Sur", "Barrio Obrero", "Industrial"],
        "postal": "2550",
        "peso": 3,
    },
    "Cosquín": {
        "barrios": ["Centro", "Achiras", "El Jazmín", "El Condado", "Balneario"],
        "postal": "5166",
        "peso": 3,
    },
    "La Calera": {
        "barrios": ["Centro", "Los Algarrobos", "La Calera Norte", "Industrial"],
        "postal": "5151",
        "peso": 3,
    },
    "Cruz del Eje": {
        "barrios": ["Centro", "Norte", "Sur", "La Punilla", "El Huerto"],
        "postal": "5280",
        "peso": 3,
    },
}

NOMBRES_MASCULINOS = [
    "Juan", "Carlos", "José", "Luis", "Miguel", "Francisco", "Pedro", "Antonio",
    "Manuel", "Diego", "Pablo", "Alejandro", "Martín", "Sebastián", "Nicolás",
    "Matías", "Lucas", "Tomás", "Santiago", "Federico", "Andrés", "Gabriel",
    "Fernando", "Ricardo", "Roberto", "Eduardo", "Sergio", "Daniel", "Gustavo",
    "Marcelo", "Raúl", "Oscar", "Alberto", "Héctor", "Hugo", "Jorge", "Mario",
    "Ramón", "Rubén", "Julio", "César", "Esteban", "Facundo", "Ignacio", "Leandro"
]

NOMBRES_FEMENINOS = [
    "María", "Ana", "Laura", "Claudia", "Silvia", "Patricia", "Mónica", "Graciela",
    "Sandra", "Gabriela", "Verónica", "Alejandra", "Carolina", "Valeria", "Romina",
    "Florencia", "Luciana", "Mariana", "Soledad", "Agustina", "Camila", "Martina",
    "Julieta", "Sofía", "Victoria", "Paula", "Daniela", "Andrea", "Cecilia",
    "Natalia", "Lorena", "Paola", "Fernanda", "Eugenia", "Mercedes", "Rosa",
    "Teresa", "Carmen", "Susana", "Marta", "Alicia", "Elena", "Julia", "Beatriz"
]

APELLIDOS = [
    "González", "Rodríguez", "Martínez", "López", "García", "Fernández", "Pérez",
    "Sánchez", "Romero", "Díaz", "Torres", "Álvarez", "Ruiz", "Ramírez", "Flores",
    "Acosta", "Medina", "Herrera", "Castro", "Vargas", "Ríos", "Córdoba", "Molina",
    "Silva", "Moreno", "Ortiz", "Gutiérrez", "Muñoz", "Rojas", "Jiménez", "Navarro",
    "Aguirre", "Domínguez", "Vega", "Sosa", "Luna", "Peralta", "Juárez", "Cabrera",
    "Mendoza", "Suárez", "Núñez", "Campos", "Godoy", "Vera", "Arias", "Ledesma"
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


def pick_localidad() -> tuple[str, str, str]:
    """Elige localidad según pesos. Retorna (ciudad, barrio, postal)."""
    cities = list(LOCALIDADES.keys())
    weights = [LOCALIDADES[c]["peso"] for c in cities]
    city = random.choices(cities, weights=weights)[0]
    barrio = random.choice(LOCALIDADES[city]["barrios"])
    postal = LOCALIDADES[city]["postal"]
    return city, barrio, postal


def normalize_email(s: str) -> str:
    replacements = {"á":"a","é":"e","í":"i","ó":"o","ú":"u","ü":"u","ñ":"n",
                    "Á":"a","É":"e","Í":"i","Ó":"o","Ú":"u","Ñ":"n"," ":""}
    for k, v in replacements.items():
        s = s.replace(k, v)
    return s.lower()


def generate_users(db, num_users: int = 1000) -> List[User]:
    print(f"Generando {num_users} usuarios de la Provincia de Córdoba...")

    users = []
    used_cuils = set()
    used_emails = set()

    age_weights = {
        (18, 30): 0.25,
        (31, 45): 0.30,
        (46, 60): 0.25,
        (61, 80): 0.20,
    }

    default_password = bcrypt.hashpw("Test1234!".encode(), bcrypt.gensalt()).decode()

    for i in range(num_users):
        age_range = random.choices(list(age_weights.keys()), weights=list(age_weights.values()))[0]
        is_male = random.choice([True, True, False, False, False])  # ~40% M, 60% F
        nombre = random.choice(NOMBRES_MASCULINOS if is_male else NOMBRES_FEMENINOS)
        apellido = random.choice(APELLIDOS)
        birth_date = generate_birth_date(age_range[0], age_range[1])
        city, barrio, postal = pick_localidad()

        cuil = generate_cuil(is_male)
        while cuil in used_cuils:
            cuil = generate_cuil(is_male)
        used_cuils.add(cuil)

        email_base = normalize_email(f"{nombre}.{apellido}{random.randint(1, 9999)}")
        email = f"{email_base}@email.com"
        while email in used_emails:
            email = f"{normalize_email(nombre)}.{normalize_email(apellido)}{random.randint(1, 99999)}@email.com"
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
        users.append(user)

        if (i + 1) % 100 == 0:
            print(f"  Creados {i + 1} usuarios...")

    db.add_all(users)
    db.flush()
    print(f"  {len(users)} usuarios creados.")
    return users


def generate_responses(db, users: List[User], survey: Survey) -> int:
    """Genera respuestas entre diciembre 2025 y hoy."""
    print(f"Generando respuestas para {len(users)} usuarios...")

    questions = db.query(Question).filter(
        Question.survey_id == survey.id
    ).order_by(Question.order_index).all()

    if not questions:
        print("ERROR: No se encontraron preguntas.")
        return 0

    pct_q      = next((q for q in questions if q.question_type == QuestionType.PERCENTAGE_DISTRIBUTION), None)
    single_q   = next((q for q in questions if q.question_type == QuestionType.SINGLE_CHOICE), None)
    rating_q   = next((q for q in questions if q.question_type == QuestionType.RATING), None)

    # Cargar opciones
    pct_opts  = list(pct_q.options) if pct_q else []
    single_opts = list(single_q.options) if single_q else []

    # Rango de fechas: 1 dic 2025 → hoy
    date_start = datetime(2025, 12, 1)
    date_end   = datetime.now()
    date_range_days = (date_end - date_start).days

    total_responses = 0

    # Distribuir por mes: dic 15%, ene 20%, feb 25%, mar 30%, abr (si aplica) el resto
    # Usamos fechas aleatorias en el rango completo con mayor densidad reciente
    random.shuffle(users)

    for i, user in enumerate(users):
        # Fecha aleatoria con sesgo hacia meses recientes
        # Usamos una distribución exponencial invertida
        r = random.betavariate(2, 1)  # sesgo hacia el final del rango
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

        # Pregunta 1: PERCENTAGE_DISTRIBUTION — ¿Dónde invertir?
        if pct_q and pct_opts:
            pct_data = generate_percentage_distribution(pct_opts, user_age)
            answers.append(Answer(
                response_id=survey_response.id,
                question_id=pct_q.id,
                percentage_data=pct_data,
            ))

        # Pregunta 2: SINGLE_CHOICE — ¿Jubilaciones SI/NO?
        if single_q and single_opts:
            selected_opt = generate_single_choice_jubilaciones(single_opts, user_age)
            answers.append(Answer(
                response_id=survey_response.id,
                question_id=single_q.id,
                option_id=selected_opt.id,
            ))

        # Pregunta 3: RATING — Calificación de gestión
        if rating_q:
            rating = generate_rating(user_age)
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


def generate_percentage_distribution(options: List[QuestionOption], user_age: int) -> Dict[str, float]:
    """
    Genera una distribución porcentual que suma 100 entre las opciones.
    Keys = UUID string de la opción. Values = porcentaje asignado.
    Pesos sesgados por edad y realismo político.
    """
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

    # Sesgo por edad
    if user_age < 30:
        option_weights["educacion_publica"]  += 20
        option_weights["empleo"]             += 20
        option_weights["medio_ambiente"]     += 10
        option_weights["jubilaciones"]       -= 20
    elif user_age < 45:
        option_weights["infraestructura_social"] += 15
        option_weights["educacion_publica"]      += 10
        option_weights["empleo"]                 += 10
    elif user_age < 60:
        option_weights["salud_publica"]      += 20
        option_weights["seguridad_justicia"] += 15
        option_weights["jubilaciones"]       += 10
    else:
        option_weights["salud_publica"]      += 25
        option_weights["jubilaciones"]       += 25
        option_weights["ayuda_social"]       += 15
        option_weights["educacion_publica"]  -= 10

    # Obtener peso por opción
    weights = []
    for opt in options:
        w = option_weights.get(opt.option_value or "", 20)
        weights.append(max(1, w))

    # Agregar ruido aleatorio para variabilidad
    weights = [w * random.uniform(0.5, 1.5) for w in weights]

    # Normalizar a 100%
    total = sum(weights)
    raw_pcts = [w / total * 100 for w in weights]

    # Redondear a enteros y ajustar para que sumen exactamente 100
    rounded = [round(p) for p in raw_pcts]
    diff = 100 - sum(rounded)
    # Ajustar el mayor para compensar diferencia de redondeo
    if diff != 0:
        max_idx = rounded.index(max(rounded))
        rounded[max_idx] += diff

    return {str(opt.id): float(pct) for opt, pct in zip(options, rounded)}


def generate_single_choice_jubilaciones(options: List[QuestionOption], user_age: int) -> QuestionOption:
    """
    Pregunta: ¿Considera justo que sus impuestos financien jubilaciones más altas?
    La mayoría dice NO, especialmente los jóvenes.
    """
    si_opt  = next((o for o in options if o.option_value in ("si", "sí")), None)
    no_opt  = next((o for o in options if o.option_value == "no"), None)

    if not si_opt or not no_opt:
        return random.choice(options)

    # Pesos base: mayoría dice NO
    if user_age < 35:
        weights = [15, 85]   # SI, NO — jóvenes muy en contra
    elif user_age < 50:
        weights = [25, 75]
    elif user_age < 65:
        weights = [35, 65]
    else:
        weights = [50, 50]   # Mayores más divididos (algunos se benefician)

    return random.choices([si_opt, no_opt], weights=weights)[0]


def generate_rating(user_age: int) -> int:
    """Rating de gestión provincial. Tendencia moderadamente crítica."""
    if user_age < 30:
        weights = [10, 20, 30, 25, 15]  # Jóvenes: moderados/críticos
    elif user_age < 45:
        weights = [12, 22, 32, 22, 12]  # Adultos: bastante distribuido
    elif user_age < 60:
        weights = [15, 25, 30, 20, 10]  # Más críticos
    else:
        weights = [12, 20, 32, 25, 11]  # Mayores: variado
    return random.choices([1, 2, 3, 4, 5], weights=weights)[0]


def main():
    print("=" * 60)
    print("GENERADOR DE DATOS - GOBIERNO DE CÓRDOBA")
    print("=" * 60)

    db = SessionLocal()
    try:
        survey = db.query(Survey).filter(Survey.id == UUID(SURVEY_ID)).first()
        if not survey:
            print(f"ERROR: No se encontró la encuesta {SURVEY_ID}")
            return

        print(f"\nEncuesta: {survey.title}")

        # Verificar si ya hay usuarios de este cliente
        existing = db.query(User).filter(User.client_id == UUID(CLIENT_ID)).count()
        if existing > 0:
            print(f"\nYa existen {existing} usuarios para este cliente. Eliminando...")
            user_ids = [u.id for u in db.query(User).filter(User.client_id == UUID(CLIENT_ID)).all()]

            db.query(PointTransaction).filter(PointTransaction.user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(UserPoints).filter(UserPoints.user_id.in_(user_ids)).delete(synchronize_session=False)
            responses = db.query(SurveyResponse).filter(SurveyResponse.user_id.in_(user_ids)).all()
            for r in responses:
                db.query(Answer).filter(Answer.response_id == r.id).delete()
            db.query(SurveyResponse).filter(SurveyResponse.user_id.in_(user_ids)).delete(synchronize_session=False)
            db.query(User).filter(User.client_id == UUID(CLIENT_ID)).delete(synchronize_session=False)
            db.commit()
            print("Datos anteriores eliminados.")

        print("\n" + "-" * 40)
        users = generate_users(db, num_users=1000)

        print("\n" + "-" * 40)
        total = generate_responses(db, users, survey)

        db.commit()

        print("\n" + "=" * 60)
        print("RESUMEN")
        print("=" * 60)
        print(f"Usuarios creados:      {len(users)}")
        print(f"Respuestas generadas:  {total}")
        print(f"Período:               Dic 2025 → Hoy")
        print(f"Localidades:           {len(LOCALIDADES)} ciudades de Córdoba")
        print("\n¡Datos generados exitosamente!")

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
