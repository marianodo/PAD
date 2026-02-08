"""
Script para generar datos de prueba: 1000 usuarios de Alta Gracia y sus respuestas.
Ejecutar: python -m scripts.generate_test_data
"""

import sys
import os
import random
from datetime import datetime, timedelta, date
from typing import List, Dict

# Agregar el directorio raíz al path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.base import SessionLocal
from app.models.user import User
from app.models.survey import Survey, Question, QuestionOption, QuestionType
from app.models.response import SurveyResponse, Answer
from app.models.points import PointTransaction, UserPoints
import bcrypt

# Barrios de Alta Gracia, Córdoba
BARRIOS_ALTA_GRACIA = [
    "Centro",
    "Barrio Norte",
    "Barrio Sur",
    "Barrio Córdoba",
    "Villa Oviedo",
    "Parque del Virrey",
    "El Golf",
    "Paravachasca",
    "Camara",
    "Sabattini",
    "Santa María",
    "Cafferata",
    "Pellegrini",
    "Don Bosco",
    "General Bustos",
    "Poluyan",
    "San Martín",
    "Villa del Prado",
    "Colinas del Sur",
    "Los Nogales",
    "La Perla",
    "Villa Parque",
    "Lomas del Golf",
    "Altos de Alta Gracia",
    "Residencial Alta Gracia",
    "Reserva Tajamar",
]

# Nombres argentinos comunes
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


def generate_cuil(birth_date: date, is_male: bool) -> str:
    """Genera un CUIL válido (estructura correcta, no verificado)"""
    # Prefijo: 20 para hombres, 27 para mujeres
    prefix = "20" if is_male else "27"
    # DNI aleatorio de 8 dígitos
    dni = str(random.randint(10000000, 45000000))
    # Dígito verificador aleatorio (simplificado)
    verificador = str(random.randint(0, 9))
    return f"{prefix}{dni}{verificador}"


def generate_birth_date(min_age: int = 18, max_age: int = 80) -> date:
    """Genera una fecha de nacimiento para una edad entre min_age y max_age"""
    today = date.today()
    age = random.randint(min_age, max_age)
    year = today.year - age
    month = random.randint(1, 12)
    day = random.randint(1, 28)  # Evitar problemas con días inválidos
    return date(year, month, day)


def generate_users(db, num_users: int = 1000) -> List[User]:
    """Genera usuarios de prueba de Alta Gracia"""
    print(f"Generando {num_users} usuarios...")

    users = []
    used_cuils = set()
    used_emails = set()

    # Distribución de edades más realista
    age_weights = {
        (18, 30): 0.25,   # 25% jóvenes
        (31, 45): 0.30,   # 30% adultos jóvenes
        (46, 60): 0.25,   # 25% adultos
        (61, 80): 0.20,   # 20% mayores
    }

    default_password = bcrypt.hashpw("Test1234!".encode(), bcrypt.gensalt()).decode()

    for i in range(num_users):
        # Seleccionar rango de edad según pesos
        age_range = random.choices(
            list(age_weights.keys()),
            weights=list(age_weights.values())
        )[0]

        is_male = random.choice([True, False])
        nombre = random.choice(NOMBRES_MASCULINOS if is_male else NOMBRES_FEMENINOS)
        apellido = random.choice(APELLIDOS)

        birth_date = generate_birth_date(age_range[0], age_range[1])

        # Generar CUIL único
        cuil = generate_cuil(birth_date, is_male)
        while cuil in used_cuils:
            cuil = generate_cuil(birth_date, is_male)
        used_cuils.add(cuil)

        # Generar email único
        email_base = f"{nombre.lower()}.{apellido.lower()}{random.randint(1, 9999)}"
        email = f"{email_base}@email.com".replace(" ", "").replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u").replace("ñ", "n")
        while email in used_emails:
            email = f"{email_base}{random.randint(1, 9999)}@email.com"
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
            neighborhood=random.choice(BARRIOS_ALTA_GRACIA),
            city="Alta Gracia",
            postal_code="5186",
        )
        users.append(user)

        if (i + 1) % 100 == 0:
            print(f"  Creados {i + 1} usuarios...")

    db.add_all(users)
    db.flush()
    print(f"  {len(users)} usuarios creados")
    return users


def generate_responses(db, users: List[User], survey: Survey, months: int = 4) -> int:
    """Genera respuestas de encuesta distribuidas en varios meses"""
    print(f"Generando respuestas para {len(users)} usuarios en {months} meses...")

    # Obtener preguntas y opciones
    questions = db.query(Question).filter(
        Question.survey_id == survey.id
    ).order_by(Question.order_index).all()

    if not questions:
        print("  ERROR: No se encontraron preguntas en la encuesta")
        return 0

    # Mapear preguntas por tipo
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

    # Calcular fechas para los últimos N meses
    today = datetime.now()
    month_dates = []
    for i in range(months - 1, -1, -1):
        month_date = today - timedelta(days=30 * i)
        month_dates.append(month_date)

    total_responses = 0

    # Distribuir usuarios en los meses (más respuestas en meses recientes)
    users_per_month = []
    remaining_users = list(users)
    random.shuffle(remaining_users)

    # Distribución: 15%, 20%, 30%, 35% para 4 meses (del más viejo al más nuevo)
    distribution = [0.15, 0.20, 0.30, 0.35]

    for i, pct in enumerate(distribution[:months]):
        count = int(len(users) * pct)
        month_users = remaining_users[:count]
        remaining_users = remaining_users[count:]
        users_per_month.append((month_dates[i], month_users))

    # Agregar usuarios restantes al último mes
    if remaining_users:
        users_per_month[-1] = (users_per_month[-1][0], users_per_month[-1][1] + remaining_users)

    for month_date, month_users in users_per_month:
        print(f"  Generando {len(month_users)} respuestas para {month_date.strftime('%B %Y')}...")

        for user in month_users:
            # Fecha aleatoria dentro del mes
            day_offset = random.randint(0, 28)
            response_date = month_date.replace(day=1) + timedelta(days=day_offset)

            # Crear SurveyResponse
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

            # Calcular edad del usuario para sesgar respuestas
            user_age = (date.today() - user.birth_date).days // 365

            # Generar respuestas para cada pregunta
            answers = []

            # 1. Respuesta de distribución porcentual
            if percentage_question:
                options = list(percentage_question.options)
                percentage_data = generate_percentage_distribution(options, user_age, month_date)

                answer = Answer(
                    response_id=survey_response.id,
                    question_id=percentage_question.id,
                    percentage_data=percentage_data,
                )
                answers.append(answer)

            # 2. Respuesta de selección única (obra pública)
            if single_choice_question:
                options = list(single_choice_question.options)
                selected_option = select_single_choice(options, user_age, month_date)

                answer = Answer(
                    response_id=survey_response.id,
                    question_id=single_choice_question.id,
                    option_id=selected_option.id,
                )
                answers.append(answer)

            # 3. Respuesta de rating
            if rating_question:
                rating = generate_rating(user_age)

                answer = Answer(
                    response_id=survey_response.id,
                    question_id=rating_question.id,
                    rating=rating,
                )
                answers.append(answer)

            db.add_all(answers)
            total_responses += 1

        # Commit por lotes
        db.flush()

    print(f"  {total_responses} respuestas generadas")
    return total_responses


def generate_percentage_distribution(options: List[QuestionOption], user_age: int, month_date: datetime) -> Dict:
    """
    Genera distribución porcentual basada en edad y tendencias temporales.
    Simula que jóvenes priorizan diferentes cosas que mayores.
    """
    # Mapear opciones por value
    option_map = {opt.option_value: opt for opt in options}

    # Definir tendencias base por categoría
    base_weights = {
        "infraestructura": 20,
        "servicios": 15,
        "seguridad": 15,
        "salud": 15,
        "ayuda_social": 10,
        "deportes_cultura": 15,
        "espacios_publicos": 10,
    }

    # Ajustar por edad
    if user_age < 30:
        # Jóvenes: más deportes, cultura, espacios públicos
        base_weights["deportes_cultura"] += 10
        base_weights["espacios_publicos"] += 8
        base_weights["infraestructura"] -= 8
        base_weights["salud"] -= 5
    elif user_age < 45:
        # Adultos jóvenes: equilibrado, algo más de infraestructura
        base_weights["infraestructura"] += 5
        base_weights["servicios"] += 3
    elif user_age < 60:
        # Adultos: seguridad y salud
        base_weights["seguridad"] += 8
        base_weights["salud"] += 5
        base_weights["deportes_cultura"] -= 8
    else:
        # Mayores: salud y ayuda social
        base_weights["salud"] += 12
        base_weights["ayuda_social"] += 8
        base_weights["deportes_cultura"] -= 10
        base_weights["espacios_publicos"] -= 5

    # Ajustar por tendencia temporal (infraestructura crece con el tiempo)
    months_ago = (datetime.now() - month_date).days // 30
    base_weights["infraestructura"] += (4 - months_ago) * 2  # Crece con el tiempo

    # Normalizar y agregar variación aleatoria
    total = sum(base_weights.values())
    percentages = {}

    for key, weight in base_weights.items():
        if key in option_map:
            opt = option_map[key]
            # Agregar variación aleatoria de ±5%
            pct = (weight / total) * 100 + random.uniform(-5, 5)
            pct = max(0, pct)
            percentages[str(opt.id)] = round(pct, 1)

    # Normalizar para que sume exactamente 100
    total_pct = sum(percentages.values())
    if total_pct > 0:
        factor = 100 / total_pct
        percentages = {k: round(v * factor, 1) for k, v in percentages.items()}

        # Ajustar el residuo en la primera opción
        diff = 100 - sum(percentages.values())
        first_key = list(percentages.keys())[0]
        percentages[first_key] = round(percentages[first_key] + diff, 1)

    return percentages


def select_single_choice(options: List[QuestionOption], user_age: int, month_date: datetime) -> QuestionOption:
    """
    Selecciona una opción de obra pública basada en edad y tendencia temporal.
    """
    # Mapear opciones por value
    option_map = {opt.option_value: opt for opt in options}

    # Pesos base
    weights = {
        "centro_civico": 35,
        "parque_publico": 25,
        "centro_convenciones": 40,
    }

    # Ajustar por edad
    if user_age < 35:
        # Jóvenes prefieren parque y centro de convenciones
        weights["parque_publico"] += 15
        weights["centro_convenciones"] += 10
        weights["centro_civico"] -= 15
    elif user_age > 55:
        # Mayores prefieren centro cívico
        weights["centro_civico"] += 15
        weights["parque_publico"] -= 10

    # Tendencia temporal: centro de convenciones gana popularidad
    months_ago = (datetime.now() - month_date).days // 30
    weights["centro_convenciones"] += (4 - months_ago) * 5
    weights["centro_civico"] -= (4 - months_ago) * 3

    # Asegurar pesos positivos
    weights = {k: max(1, v) for k, v in weights.items()}

    # Seleccionar opción
    valid_options = [(option_map[k], v) for k, v in weights.items() if k in option_map]
    if not valid_options:
        return random.choice(options)

    options_list, weights_list = zip(*valid_options)
    return random.choices(options_list, weights=weights_list)[0]


def generate_rating(user_age: int) -> int:
    """
    Genera un rating basado en edad.
    Mayores tienden a ser más críticos, jóvenes más positivos.
    """
    if user_age < 30:
        # Jóvenes: más optimistas
        weights = [5, 10, 20, 35, 30]  # 1-5 estrellas
    elif user_age < 45:
        # Adultos jóvenes: moderados
        weights = [8, 15, 30, 30, 17]
    elif user_age < 60:
        # Adultos: algo más críticos
        weights = [10, 20, 35, 25, 10]
    else:
        # Mayores: más críticos
        weights = [15, 25, 30, 20, 10]

    return random.choices([1, 2, 3, 4, 5], weights=weights)[0]


def main(force: bool = False):
    print("=" * 60)
    print("GENERADOR DE DATOS DE PRUEBA - P.A.D.")
    print("=" * 60)

    db = SessionLocal()

    try:
        # Buscar la encuesta activa
        survey = db.query(Survey).filter(Survey.status == "active").first()

        if not survey:
            print("ERROR: No hay encuesta activa. Ejecuta primero create_sample_survey.py")
            return

        print(f"\nEncuesta encontrada: {survey.title} (ID: {survey.id})")

        # Verificar si ya hay usuarios de prueba
        existing_users = db.query(User).filter(User.city == "Alta Gracia").count()
        if existing_users > 0:
            print(f"\nYa existen {existing_users} usuarios de Alta Gracia.")
            if not force:
                confirm = input("¿Desea eliminarlos y crear nuevos? (s/n): ")
                if confirm.lower() != 's':
                    print("Operación cancelada.")
                    return
            else:
                print("Modo --force activado. Eliminando automáticamente...")

            # Eliminar respuestas y usuarios existentes
            print("Eliminando datos existentes...")
            users_to_delete = db.query(User).filter(User.city == "Alta Gracia").all()
            user_ids = [u.id for u in users_to_delete]

            # Eliminar transacciones de puntos asociadas a usuarios
            db.query(PointTransaction).filter(
                PointTransaction.user_id.in_(user_ids)
            ).delete(synchronize_session=False)

            # Eliminar saldos de puntos de usuarios
            db.query(UserPoints).filter(
                UserPoints.user_id.in_(user_ids)
            ).delete(synchronize_session=False)

            # Eliminar respuestas asociadas
            responses = db.query(SurveyResponse).filter(
                SurveyResponse.user_id.in_(user_ids)
            ).all()

            for response in responses:
                db.query(Answer).filter(Answer.response_id == response.id).delete()

            db.query(SurveyResponse).filter(
                SurveyResponse.user_id.in_(user_ids)
            ).delete(synchronize_session=False)

            db.query(User).filter(User.city == "Alta Gracia").delete(synchronize_session=False)
            db.commit()
            print("Datos anteriores eliminados.")

        # Generar usuarios
        print("\n" + "-" * 40)
        users = generate_users(db, num_users=1000)

        # Generar respuestas
        print("\n" + "-" * 40)
        total_responses = generate_responses(db, users, survey, months=4)

        # Commit final
        db.commit()

        print("\n" + "=" * 60)
        print("RESUMEN")
        print("=" * 60)
        print(f"Usuarios creados: {len(users)}")
        print(f"Respuestas generadas: {total_responses}")
        print(f"Ciudad: Alta Gracia, Córdoba")
        print(f"Barrios: {len(BARRIOS_ALTA_GRACIA)} diferentes")
        print(f"Período: últimos 4 meses")
        print("\n¡Datos de prueba generados exitosamente!")

    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}")
        import traceback
        traceback.print_exc()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generar datos de prueba para P.A.D.")
    parser.add_argument("--force", "-f", action="store_true", help="Eliminar datos existentes sin confirmación")
    args = parser.parse_args()
    main(force=args.force)
