from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, date
from uuid import UUID

from app.models.survey import Survey, Question, QuestionOption, QuestionType
from app.models.response import SurveyResponse, Answer
from app.models.user import User
from app.models.client import Client
from app.models.points import UserPoints, PointTransaction
from app.schemas.survey import SurveyCreate
from app.schemas.response import SurveyResponseCreate, AnswerCreate
from anthropic import Anthropic
from app.core.config import settings
import json
import logging

logger = logging.getLogger(__name__)


class SurveyService:
    """Servicio para gestionar encuestas"""

    @staticmethod
    def get_active_survey(db: Session) -> Optional[Survey]:
        """Obtiene la encuesta activa actual"""
        return db.query(Survey).filter(
            Survey.status == "active",
            (Survey.expires_at.is_(None) | (Survey.expires_at > datetime.now()))
        ).first()

    @staticmethod
    def get_survey_by_id(db: Session, survey_id: UUID) -> Optional[Survey]:
        """Obtiene una encuesta por ID"""
        return db.query(Survey).filter(Survey.id == survey_id).first()

    @staticmethod
    def get_all_surveys(db: Session, client_id: Optional[UUID] = None) -> List[Survey]:
        """
        Obtiene todas las encuestas.
        Si se proporciona client_id, filtra por ese cliente.
        Si no, devuelve todas (para admin).
        """
        query = db.query(Survey).options(joinedload(Survey.client))

        if client_id:
            query = query.filter(Survey.client_id == client_id)

        surveys = query.order_by(Survey.created_at.desc()).all()

        # Agregar total_responses a cada encuesta
        for survey in surveys:
            total_responses = db.query(SurveyResponse).filter(
                SurveyResponse.survey_id == survey.id,
                SurveyResponse.completed == True
            ).count()
            survey.total_responses = total_responses

        return surveys

    @staticmethod
    def create_survey(db: Session, survey_data: SurveyCreate) -> Survey:
        """Crea una nueva encuesta con sus preguntas y opciones"""
        # Crear encuesta
        survey = Survey(
            title=survey_data.title,
            description=survey_data.description,
            points_per_question=survey_data.points_per_question,
            bonus_points=survey_data.bonus_points,
            max_responses_per_user=survey_data.max_responses_per_user,
            expires_at=survey_data.expires_at,
        )
        db.add(survey)
        db.flush()

        # Crear preguntas
        for question_data in survey_data.questions:
            question = Question(
                survey_id=survey.id,
                question_text=question_data.question_text,
                question_type=question_data.question_type,
                order_index=question_data.order_index,
                is_required=question_data.is_required,
                config=question_data.config,
            )
            db.add(question)
            db.flush()

            # Crear opciones
            for option_data in question_data.options:
                option = QuestionOption(
                    question_id=question.id,
                    option_text=option_data.option_text,
                    option_value=option_data.option_value,
                    description=option_data.description,
                    image_url=option_data.image_url,
                    order_index=option_data.order_index,
                )
                db.add(option)

        db.commit()
        db.refresh(survey)
        return survey

    @staticmethod
    def user_can_respond(db: Session, user_id: UUID, survey_id: UUID) -> bool:
        """
        Verifica si el usuario puede responder la encuesta.
        Regla: Si max_responses_per_user = 0, puede responder ilimitadamente.
               Si max_responses_per_user > 0, ese es el límite de respuestas.
        """
        # Obtener la encuesta
        survey = db.query(Survey).filter(Survey.id == survey_id).first()
        if not survey:
            return False

        # Si max_responses_per_user es 0, puede responder ilimitadamente
        if survey.max_responses_per_user == 0:
            return True

        # Contar respuestas completadas del usuario para esta encuesta
        response_count = db.query(SurveyResponse).filter(
            and_(
                SurveyResponse.user_id == user_id,
                SurveyResponse.survey_id == survey_id,
                SurveyResponse.completed == True
            )
        ).count()

        # Verificar si alcanzó el límite
        return response_count < survey.max_responses_per_user

    @staticmethod
    def submit_response(
        db: Session,
        response_data: SurveyResponseCreate,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> SurveyResponse:
        """
        Envía una respuesta de encuesta y calcula los puntos ganados
        """
        # Verificar que el usuario puede responder
        if not SurveyService.user_can_respond(db, response_data.user_id, response_data.survey_id):
            raise ValueError("Ya alcanzaste el límite de respuestas para esta encuesta")

        # Obtener encuesta
        survey = SurveyService.get_survey_by_id(db, response_data.survey_id)
        if not survey:
            raise ValueError("Encuesta no encontrada")

        # Calcular puntos
        questions_answered = len(response_data.answers)
        points_earned = questions_answered * survey.points_per_question

        # Si completó todas las preguntas requeridas, dar bonus
        total_required_questions = db.query(Question).filter(
            Question.survey_id == survey.id,
            Question.is_required == True
        ).count()

        if response_data.completed and questions_answered >= total_required_questions:
            points_earned += survey.bonus_points

        # Crear respuesta
        survey_response = SurveyResponse(
            survey_id=response_data.survey_id,
            user_id=response_data.user_id,
            completed=response_data.completed,
            points_earned=points_earned,
            completed_at=datetime.now() if response_data.completed else None,
            ip_address=ip_address,
            user_agent=user_agent,
        )
        db.add(survey_response)
        db.flush()

        # Crear respuestas individuales
        for answer_data in response_data.answers:
            answer = Answer(
                response_id=survey_response.id,
                question_id=answer_data.question_id,
                option_id=answer_data.option_id,
                answer_text=answer_data.answer_text,
                rating=answer_data.rating,
                percentage_data=answer_data.percentage_data,
            )
            db.add(answer)

        # Actualizar puntos del usuario
        if response_data.completed:
            SurveyService._update_user_points(
                db,
                response_data.user_id,
                points_earned,
                survey_response.id
            )

        db.commit()
        db.refresh(survey_response)
        return survey_response

    @staticmethod
    def _update_user_points(
        db: Session,
        user_id: UUID,
        points: int,
        response_id: UUID
    ):
        """Actualiza los puntos del usuario"""
        # Obtener o crear registro de puntos
        user_points = db.query(UserPoints).filter(UserPoints.user_id == user_id).first()

        if not user_points:
            user_points = UserPoints(user_id=user_id)
            db.add(user_points)
            db.flush()

        # Actualizar puntos
        user_points.total_points += points
        user_points.available_points += points

        # Crear transacción
        transaction = PointTransaction(
            user_id=user_id,
            transaction_type="earned",
            amount=points,
            description=f"Encuesta completada",
            related_response_id=response_id,
        )
        db.add(transaction)

    @staticmethod
    def get_survey_results(db: Session, survey_id: UUID, date_from: Optional[date] = None, date_to: Optional[date] = None) -> Dict[str, Any]:
        """
        Obtiene los resultados y estadísticas demográficas de una encuesta.
        Retorna KPIs por edad, ciudad y barrio, más resumen de respuestas por pregunta.
        Opcionalmente filtra por período con date_from y date_to.
        """
        # Obtener todas las respuestas completadas con datos del usuario
        query = db.query(SurveyResponse, User).join(
            User, SurveyResponse.user_id == User.id
        ).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.completed == True
        )

        # Filtro por período
        if date_from:
            query = query.filter(SurveyResponse.completed_at >= datetime.combine(date_from, datetime.min.time()))
        if date_to:
            query = query.filter(SurveyResponse.completed_at <= datetime.combine(date_to, datetime.max.time()))

        responses = query.all()

        total_responses = len(responses)

        # Calcular respuestas de este mes y mes anterior
        now = datetime.now()
        first_day_of_month = datetime(now.year, now.month, 1)
        if now.month == 1:
            first_day_prev_month = datetime(now.year - 1, 12, 1)
        else:
            first_day_prev_month = datetime(now.year, now.month - 1, 1)

        monthly_responses = sum(
            1 for response, _ in responses
            if response.started_at and response.started_at.replace(tzinfo=None) >= first_day_of_month
        )
        prev_month_responses = sum(
            1 for response, _ in responses
            if response.started_at
            and response.started_at.replace(tzinfo=None) >= first_day_prev_month
            and response.started_at.replace(tzinfo=None) < first_day_of_month
        )

        # Calcular % de cambio vs mes anterior
        if prev_month_responses > 0:
            monthly_change = round(((monthly_responses - prev_month_responses) / prev_month_responses) * 100)
        else:
            monthly_change = 100 if monthly_responses > 0 else 0

        # Crecimiento del total: respuestas nuevas este mes como % del total anterior
        total_at_start_of_month = total_responses - monthly_responses
        if total_at_start_of_month > 0:
            total_change = round((monthly_responses / total_at_start_of_month) * 100)
        else:
            total_change = 100 if total_responses > 0 else 0

        if total_responses == 0:
            return {
                "survey_id": str(survey_id),
                "total_responses": 0,
                "monthly_responses": 0,
                "monthly_change": 0,
                "total_change": 0,
                "demographics": {
                    "by_age_group": {},
                    "by_age_group_by_gender": {},
                    "by_city": {},
                    "by_neighborhood": {},
                    "by_gender": {}
                },
                "questions_summary": [],
                "evolution_data": {}
            }

        # Calcular edad y agrupar
        def calculate_age(birth_date: date) -> Optional[int]:
            if not birth_date:
                return None
            today = date.today()
            return today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

        def get_age_group(age: Optional[int]) -> str:
            if age is None:
                return "Sin especificar"
            if age < 18:
                return "Menor de 18"
            elif age < 31:
                return "18-30"
            elif age < 46:
                return "31-45"
            elif age < 61:
                return "46-60"
            else:
                return "60+"

        # Contadores demográficos
        age_groups: Dict[str, int] = {}
        cities: Dict[str, int] = {}
        neighborhoods: Dict[str, int] = {}
        genders: Dict[str, int] = {}

        # Mapeos usuario -> grupo demográfico para filtrar respuestas
        user_age_groups: Dict[UUID, str] = {}
        user_genders: Dict[UUID, str] = {}
        user_neighborhoods: Dict[UUID, str] = {}
        age_groups_by_gender: Dict[str, Dict[str, int]] = {}

        for response, user in responses:
            # Por grupo de edad
            age = calculate_age(user.birth_date)
            age_group = get_age_group(age)
            age_groups[age_group] = age_groups.get(age_group, 0) + 1
            user_age_groups[user.id] = age_group

            # Por género
            gender = user.gender or "Sin especificar"
            genders[gender] = genders.get(gender, 0) + 1
            user_genders[user.id] = gender

            # Cruce edad x género
            if gender not in age_groups_by_gender:
                age_groups_by_gender[gender] = {}
            age_groups_by_gender[gender][age_group] = age_groups_by_gender[gender].get(age_group, 0) + 1

            # Por ciudad
            city = user.city or "Sin especificar"
            cities[city] = cities.get(city, 0) + 1

            # Por barrio
            neighborhood = user.neighborhood or "Sin especificar"
            neighborhoods[neighborhood] = neighborhoods.get(neighborhood, 0) + 1
            user_neighborhoods[user.id] = neighborhood

        # Obtener preguntas de la encuesta con sus opciones
        questions = db.query(Question).filter(
            Question.survey_id == survey_id
        ).order_by(Question.order_index).all()

        # Obtener todas las respuestas (answers) para esta encuesta
        response_ids = [r.id for r, _ in responses]
        all_answers = db.query(Answer).filter(
            Answer.response_id.in_(response_ids)
        ).all()

        # Crear mapeo response_id -> user_id para obtener grupo de edad
        response_user_map = {r.id: u.id for r, u in responses}

        # Construir resumen por pregunta
        questions_summary = []

        for question in questions:
            question_answers = [a for a in all_answers if a.question_id == question.id]

            # Obtener opciones de la pregunta
            options = {opt.id: {"text": opt.option_text, "value": opt.option_value}
                      for opt in question.options}

            question_data = {
                "question_id": str(question.id),
                "question_text": question.question_text,
                "question_type": question.question_type.value,
                "total_answers": len(question_answers),
                "results": {},
                "results_by_age": {},
                "results_by_gender": {},
                "results_by_age_and_gender": {},
                "results_by_neighborhood": {}
            }

            if question.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                # Crear mapeo de option_id (UUID string) -> option_value y option_text
                option_id_map = {}
                for opt in question.options:
                    option_id_map[str(opt.id)] = {
                        "value": opt.option_value,
                        "text": opt.option_text
                    }

                # Promediar los porcentajes de todas las respuestas
                percentage_totals: Dict[str, float] = {}
                percentage_counts: Dict[str, int] = {}
                total_respondents = sum(1 for a in question_answers if a.percentage_data)

                # También por grupo de edad, género, cruce edad+género y barrio
                percentage_by_age: Dict[str, Dict[str, List[float]]] = {}
                percentage_by_gender: Dict[str, Dict[str, List[float]]] = {}
                percentage_by_age_and_gender: Dict[str, Dict[str, List[float]]] = {}
                percentage_by_neighborhood: Dict[str, Dict[str, List[float]]] = {}

                for answer in question_answers:
                    if answer.percentage_data:
                        user_id = response_user_map.get(answer.response_id)
                        user_age = user_age_groups.get(user_id, "Sin especificar")
                        user_gender = user_genders.get(user_id, "Sin especificar")
                        user_neighborhood = user_neighborhoods.get(user_id, "Sin especificar")

                        for key, value in answer.percentage_data.items():
                            # Convertir UUID key a option_value
                            option_info = option_id_map.get(key)
                            if option_info:
                                option_key = option_info["value"]
                            else:
                                option_key = key  # Fallback si no se encuentra

                            # General
                            percentage_totals[option_key] = percentage_totals.get(option_key, 0) + value
                            percentage_counts[option_key] = percentage_counts.get(option_key, 0) + 1

                            # Por edad
                            if user_age not in percentage_by_age:
                                percentage_by_age[user_age] = {}
                            if option_key not in percentage_by_age[user_age]:
                                percentage_by_age[user_age][option_key] = []
                            percentage_by_age[user_age][option_key].append(value)

                            # Por género
                            if user_gender not in percentage_by_gender:
                                percentage_by_gender[user_gender] = {}
                            if option_key not in percentage_by_gender[user_gender]:
                                percentage_by_gender[user_gender][option_key] = []
                            percentage_by_gender[user_gender][option_key].append(value)

                            # Por cruce edad+género
                            age_gender_key = f"{user_age}|{user_gender}"
                            if age_gender_key not in percentage_by_age_and_gender:
                                percentage_by_age_and_gender[age_gender_key] = {}
                            if option_key not in percentage_by_age_and_gender[age_gender_key]:
                                percentage_by_age_and_gender[age_gender_key][option_key] = []
                            percentage_by_age_and_gender[age_gender_key][option_key].append(value)

                            # Por barrio
                            if user_neighborhood not in percentage_by_neighborhood:
                                percentage_by_neighborhood[user_neighborhood] = {}
                            if option_key not in percentage_by_neighborhood[user_neighborhood]:
                                percentage_by_neighborhood[user_neighborhood][option_key] = []
                            percentage_by_neighborhood[user_neighborhood][option_key].append(value)

                def _get_option_label(k):
                    if k == "otros":
                        return "OTROS"
                    for o in question.options:
                        if o.option_value == k:
                            return o.option_text
                    return k

                # Calcular promedios generales
                results = {}
                for key in percentage_totals:
                    # Para "otros", dividir por total de encuestados (no solo los que eligieron "otros")
                    divisor = total_respondents if key == "otros" else percentage_counts[key]
                    avg = percentage_totals[key] / divisor if divisor > 0 else 0
                    option_text = _get_option_label(key)
                    results[key] = {
                        "label": option_text,
                        "percentage": round(avg, 1)
                    }

                question_data["results"] = results

                # Contar encuestados por grupo demográfico
                respondents_by_age: Dict[str, int] = {}
                respondents_by_gender: Dict[str, int] = {}
                respondents_by_age_and_gender: Dict[str, int] = {}
                respondents_by_neighborhood: Dict[str, int] = {}
                for a in question_answers:
                    if a.percentage_data:
                        uid = response_user_map.get(a.response_id)
                        ag = user_age_groups.get(uid, "Sin especificar")
                        gn = user_genders.get(uid, "Sin especificar")
                        nb = user_neighborhoods.get(uid, "Sin especificar")
                        respondents_by_age[ag] = respondents_by_age.get(ag, 0) + 1
                        respondents_by_gender[gn] = respondents_by_gender.get(gn, 0) + 1
                        respondents_by_age_and_gender[f"{ag}|{gn}"] = respondents_by_age_and_gender.get(f"{ag}|{gn}", 0) + 1
                        respondents_by_neighborhood[nb] = respondents_by_neighborhood.get(nb, 0) + 1

                # Helper para calcular promedios por grupo demográfico
                def _calc_percentage_by_group(group_data, group_totals):
                    result = {}
                    for grp, categories in group_data.items():
                        result[grp] = {}
                        for key, values in categories.items():
                            if key == "otros":
                                divisor = group_totals.get(grp, len(values))
                                avg = sum(values) / divisor if divisor > 0 else 0
                            else:
                                avg = sum(values) / len(values) if values else 0
                            result[grp][key] = {
                                "label": _get_option_label(key),
                                "percentage": round(avg, 1)
                            }
                    return result

                question_data["results_by_age"] = _calc_percentage_by_group(percentage_by_age, respondents_by_age)
                question_data["results_by_gender"] = _calc_percentage_by_group(percentage_by_gender, respondents_by_gender)
                question_data["results_by_age_and_gender"] = _calc_percentage_by_group(percentage_by_age_and_gender, respondents_by_age_and_gender)
                question_data["results_by_neighborhood"] = _calc_percentage_by_group(percentage_by_neighborhood, respondents_by_neighborhood)

                # Recopilar textos de "otros" para el resumen
                otros_raw_texts = []
                for answer in question_answers:
                    if answer.answer_text and answer.percentage_data and answer.percentage_data.get("otros", 0) > 0:
                        text = answer.answer_text.strip()
                        if text:
                            otros_raw_texts.append(text)

                if otros_raw_texts:
                    question_data["otros_summary"] = SurveyService._classify_otros_texts(otros_raw_texts)
                else:
                    question_data["otros_summary"] = []

            elif question.question_type == QuestionType.SINGLE_CHOICE:
                # Contar votos por opción
                vote_counts: Dict[str, int] = {}
                votes_by_age: Dict[str, Dict[str, int]] = {}
                votes_by_gender: Dict[str, Dict[str, int]] = {}
                votes_by_age_and_gender: Dict[str, Dict[str, int]] = {}
                votes_by_neighborhood: Dict[str, Dict[str, int]] = {}

                for answer in question_answers:
                    if answer.option_id:
                        opt_id = str(answer.option_id)
                        vote_counts[opt_id] = vote_counts.get(opt_id, 0) + 1

                        user_id = response_user_map.get(answer.response_id)
                        user_age = user_age_groups.get(user_id, "Sin especificar")
                        user_gender = user_genders.get(user_id, "Sin especificar")
                        user_neighborhood = user_neighborhoods.get(user_id, "Sin especificar")

                        # Por grupo de edad
                        if user_age not in votes_by_age:
                            votes_by_age[user_age] = {}
                        votes_by_age[user_age][opt_id] = votes_by_age[user_age].get(opt_id, 0) + 1

                        # Por género
                        if user_gender not in votes_by_gender:
                            votes_by_gender[user_gender] = {}
                        votes_by_gender[user_gender][opt_id] = votes_by_gender[user_gender].get(opt_id, 0) + 1

                        # Por cruce edad+género
                        age_gender_key = f"{user_age}|{user_gender}"
                        if age_gender_key not in votes_by_age_and_gender:
                            votes_by_age_and_gender[age_gender_key] = {}
                        votes_by_age_and_gender[age_gender_key][opt_id] = votes_by_age_and_gender[age_gender_key].get(opt_id, 0) + 1

                        # Por barrio
                        if user_neighborhood not in votes_by_neighborhood:
                            votes_by_neighborhood[user_neighborhood] = {}
                        votes_by_neighborhood[user_neighborhood][opt_id] = votes_by_neighborhood[user_neighborhood].get(opt_id, 0) + 1

                total_votes = sum(vote_counts.values())

                # Resultados generales
                results = {}
                for opt_id, count in vote_counts.items():
                    opt_uuid = UUID(opt_id)
                    if opt_uuid in options:
                        opt_info = options[opt_uuid]
                        percentage = (count / total_votes * 100) if total_votes > 0 else 0
                        results[opt_info["value"]] = {
                            "label": opt_info["text"],
                            "votes": count,
                            "percentage": round(percentage, 1)
                        }

                question_data["results"] = results

                # Resultados por grupo de edad
                results_by_age = {}
                for age_grp, age_votes in votes_by_age.items():
                    age_total = sum(age_votes.values())
                    results_by_age[age_grp] = {}
                    for opt_id, count in age_votes.items():
                        opt_uuid = UUID(opt_id)
                        if opt_uuid in options:
                            opt_info = options[opt_uuid]
                            percentage = (count / age_total * 100) if age_total > 0 else 0
                            results_by_age[age_grp][opt_info["value"]] = {
                                "label": opt_info["text"],
                                "votes": count,
                                "percentage": round(percentage, 1)
                            }

                question_data["results_by_age"] = results_by_age

                # Resultados por género
                def _calc_votes_by_group(votes_by_group, options_map):
                    result = {}
                    for grp, grp_votes in votes_by_group.items():
                        grp_total = sum(grp_votes.values())
                        result[grp] = {}
                        for opt_id, count in grp_votes.items():
                            opt_uuid = UUID(opt_id)
                            if opt_uuid in options_map:
                                opt_info = options_map[opt_uuid]
                                percentage = (count / grp_total * 100) if grp_total > 0 else 0
                                result[grp][opt_info["value"]] = {
                                    "label": opt_info["text"],
                                    "votes": count,
                                    "percentage": round(percentage, 1)
                                }
                    return result

                question_data["results_by_gender"] = _calc_votes_by_group(votes_by_gender, options)
                question_data["results_by_age_and_gender"] = _calc_votes_by_group(votes_by_age_and_gender, options)
                question_data["results_by_neighborhood"] = _calc_votes_by_group(votes_by_neighborhood, options)

            elif question.question_type == QuestionType.RATING:
                # Calcular promedio de calificaciones
                ratings = [a.rating for a in question_answers if a.rating is not None]
                avg_rating = sum(ratings) / len(ratings) if ratings else 0

                # Distribución de calificaciones
                rating_dist = {}
                for r in range(1, 6):
                    rating_dist[str(r)] = sum(1 for rating in ratings if rating == r)

                question_data["results"] = {
                    "average": round(avg_rating, 2),
                    "total_ratings": len(ratings),
                    "distribution": rating_dist
                }

                # Agrupar ratings por edad, género y barrio
                ratings_by_age: Dict[str, List[int]] = {}
                ratings_by_gender: Dict[str, List[int]] = {}
                ratings_by_age_and_gender: Dict[str, List[int]] = {}
                ratings_by_neighborhood: Dict[str, List[int]] = {}
                for answer in question_answers:
                    if answer.rating is not None:
                        user_id = response_user_map.get(answer.response_id)
                        user_age = user_age_groups.get(user_id, "Sin especificar")
                        user_gender = user_genders.get(user_id, "Sin especificar")
                        user_neighborhood = user_neighborhoods.get(user_id, "Sin especificar")

                        if user_age not in ratings_by_age:
                            ratings_by_age[user_age] = []
                        ratings_by_age[user_age].append(answer.rating)

                        if user_gender not in ratings_by_gender:
                            ratings_by_gender[user_gender] = []
                        ratings_by_gender[user_gender].append(answer.rating)

                        age_gender_key = f"{user_age}|{user_gender}"
                        if age_gender_key not in ratings_by_age_and_gender:
                            ratings_by_age_and_gender[age_gender_key] = []
                        ratings_by_age_and_gender[age_gender_key].append(answer.rating)

                        if user_neighborhood not in ratings_by_neighborhood:
                            ratings_by_neighborhood[user_neighborhood] = []
                        ratings_by_neighborhood[user_neighborhood].append(answer.rating)

                def _calc_rating_by_group(ratings_by_group):
                    result = {}
                    for grp, grp_ratings in ratings_by_group.items():
                        avg = sum(grp_ratings) / len(grp_ratings) if grp_ratings else 0
                        grp_rating_dist = {}
                        for r in range(1, 6):
                            grp_rating_dist[str(r)] = sum(1 for rating in grp_ratings if rating == r)
                        result[grp] = {
                            "average": round(avg, 2),
                            "total_ratings": len(grp_ratings),
                            "distribution": grp_rating_dist
                        }
                    return result

                question_data["results_by_age"] = _calc_rating_by_group(ratings_by_age)
                question_data["results_by_gender"] = _calc_rating_by_group(ratings_by_gender)
                question_data["results_by_age_and_gender"] = _calc_rating_by_group(ratings_by_age_and_gender)
                question_data["results_by_neighborhood"] = _calc_rating_by_group(ratings_by_neighborhood)

            questions_summary.append(question_data)

        # Calcular evolución histórica por mes
        evolution_data = SurveyService._calculate_evolution_data(
            responses, all_answers, questions, user_age_groups, user_genders, response_user_map
        )

        return {
            "survey_id": str(survey_id),
            "total_responses": total_responses,
            "monthly_responses": monthly_responses,
            "monthly_change": monthly_change,
            "total_change": total_change,
            "demographics": {
                "by_age_group": age_groups,
                "by_age_group_by_gender": age_groups_by_gender,
                "by_city": cities,
                "by_neighborhood": neighborhoods,
                "by_gender": genders
            },
            "questions_summary": questions_summary,
            "evolution_data": evolution_data
        }

    @staticmethod
    def _calculate_evolution_data(
        responses: List,
        all_answers: List[Answer],
        questions: List[Question],
        user_age_groups: Dict[UUID, str],
        user_genders: Dict[UUID, str],
        response_user_map: Dict[UUID, UUID]
    ) -> Dict[str, Any]:
        """
        Calcula la evolución histórica de respuestas por mes.
        Agrupa los datos por mes para cada tipo de pregunta.
        """
        # Crear mapeo de response_id -> fecha de respuesta
        response_dates = {r.id: r.started_at or r.completed_at for r, _ in responses}

        # Agrupar respuestas por mes
        from collections import defaultdict

        # Estructura: {month_key: {question_id: [answers]}}
        answers_by_month: Dict[str, Dict[UUID, List[Answer]]] = defaultdict(lambda: defaultdict(list))

        # También por edad y género: {group: {month_key: {question_id: [answers]}}}
        answers_by_age_month: Dict[str, Dict[str, Dict[UUID, List[Answer]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )
        answers_by_gender_month: Dict[str, Dict[str, Dict[UUID, List[Answer]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )
        answers_by_age_and_gender_month: Dict[str, Dict[str, Dict[UUID, List[Answer]]]] = defaultdict(
            lambda: defaultdict(lambda: defaultdict(list))
        )

        for answer in all_answers:
            response_date = response_dates.get(answer.response_id)
            if response_date:
                # Convertir a naive si tiene timezone
                if hasattr(response_date, 'replace') and response_date.tzinfo:
                    response_date = response_date.replace(tzinfo=None)

                month_key = response_date.strftime("%Y-%m")
                answers_by_month[month_key][answer.question_id].append(answer)

                user_id = response_user_map.get(answer.response_id)

                # Por grupo de edad
                age_group = user_age_groups.get(user_id, "Sin especificar")
                answers_by_age_month[age_group][month_key][answer.question_id].append(answer)

                # Por género
                gender = user_genders.get(user_id, "Sin especificar")
                answers_by_gender_month[gender][month_key][answer.question_id].append(answer)

                # Por cruce edad+género
                age_gender_key = f"{age_group}|{gender}"
                answers_by_age_and_gender_month[age_gender_key][month_key][answer.question_id].append(answer)

        # Obtener los últimos 8 meses con datos (o los que haya)
        sorted_months = sorted(answers_by_month.keys())[-8:]

        # Formatear nombres de meses en español
        month_names = {
            "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
            "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
            "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
        }

        def get_month_label(month_key: str) -> str:
            month_num = month_key.split("-")[1]
            return month_names.get(month_num, month_num)

        months_labels = [get_month_label(m) for m in sorted_months]

        # Calcular datos de evolución por tipo de pregunta
        evolution_result = {
            "months": months_labels,
            "percentage_distribution": {},
            "single_choice": {},
            "rating": {},
            "by_age": {},
            "by_gender": {},
            "by_age_and_gender": {}
        }

        for question in questions:
            if question.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                # Crear mapeo option_id -> option_value
                option_id_map = {str(opt.id): opt.option_value for opt in question.options}
                option_labels = {opt.option_value: opt.option_text for opt in question.options}
                option_labels["otros"] = "OTROS"

                # Calcular promedio por mes para cada opción (incluir "otros")
                option_data: Dict[str, List[float]] = {opt.option_value: [] for opt in question.options}
                option_data["otros"] = []

                for month_key in sorted_months:
                    month_answers = answers_by_month[month_key].get(question.id, [])

                    # Agregar porcentajes por opción
                    month_totals: Dict[str, List[float]] = defaultdict(list)

                    for answer in month_answers:
                        if answer.percentage_data:
                            for key, value in answer.percentage_data.items():
                                option_value = option_id_map.get(key, key)
                                month_totals[option_value].append(value)

                    # Calcular promedio de este mes para cada opción
                    for opt_value in option_data.keys():
                        values = month_totals.get(opt_value, [])
                        avg = sum(values) / len(values) if values else 0
                        option_data[opt_value].append(round(avg, 1))

                evolution_result["percentage_distribution"] = {
                    "question_id": str(question.id),
                    "question_text": question.question_text,
                    "categories": [
                        {
                            "name": option_labels.get(opt_value, opt_value),
                            "key": opt_value,
                            "data": data
                        }
                        for opt_value, data in option_data.items()
                    ]
                }

            elif question.question_type == QuestionType.SINGLE_CHOICE:
                option_labels = {str(opt.id): opt.option_text for opt in question.options}
                option_values = {str(opt.id): opt.option_value for opt in question.options}

                # Calcular porcentaje de votos por mes para cada opción
                option_data: Dict[str, List[float]] = {str(opt.id): [] for opt in question.options}

                for month_key in sorted_months:
                    month_answers = answers_by_month[month_key].get(question.id, [])

                    # Contar votos por opción
                    vote_counts: Dict[str, int] = defaultdict(int)
                    for answer in month_answers:
                        if answer.option_id:
                            vote_counts[str(answer.option_id)] += 1

                    total_votes = sum(vote_counts.values())

                    # Calcular porcentaje para cada opción
                    for opt_id in option_data.keys():
                        count = vote_counts.get(opt_id, 0)
                        percentage = (count / total_votes * 100) if total_votes > 0 else 0
                        option_data[opt_id].append(round(percentage, 1))

                evolution_result["single_choice"] = {
                    "question_id": str(question.id),
                    "question_text": question.question_text,
                    "projects": [
                        {
                            "name": option_labels.get(opt_id, ""),
                            "key": option_values.get(opt_id, opt_id),
                            "data": data
                        }
                        for opt_id, data in option_data.items()
                    ]
                }

            elif question.question_type == QuestionType.RATING:
                # Calcular promedio de calificación por mes
                rating_data: List[float] = []

                for month_key in sorted_months:
                    month_answers = answers_by_month[month_key].get(question.id, [])
                    ratings = [a.rating for a in month_answers if a.rating is not None]
                    avg = sum(ratings) / len(ratings) if ratings else 0
                    rating_data.append(round(avg, 2))

                evolution_result["rating"] = {
                    "question_id": str(question.id),
                    "question_text": question.question_text,
                    "data": rating_data
                }

        # Helper para calcular evolución por grupo demográfico
        def _calc_group_evolution(group_list, answers_by_group_month):
            result = {}
            for group in group_list:
                group_evolution = {
                    "percentage_distribution": {},
                    "single_choice": {},
                    "rating": {}
                }

                group_months_data = answers_by_group_month.get(group, {})

                for question in questions:
                    if question.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                        option_id_map = {str(opt.id): opt.option_value for opt in question.options}
                        option_labels = {opt.option_value: opt.option_text for opt in question.options}
                        option_labels["otros"] = "OTROS"
                        option_data: Dict[str, List[float]] = {opt.option_value: [] for opt in question.options}
                        option_data["otros"] = []

                        for month_key in sorted_months:
                            month_answers = group_months_data.get(month_key, {}).get(question.id, [])
                            month_totals: Dict[str, List[float]] = defaultdict(list)

                            for answer in month_answers:
                                if answer.percentage_data:
                                    for key, value in answer.percentage_data.items():
                                        option_value = option_id_map.get(key, key)
                                        month_totals[option_value].append(value)

                            for opt_value in option_data.keys():
                                values = month_totals.get(opt_value, [])
                                avg = sum(values) / len(values) if values else 0
                                option_data[opt_value].append(round(avg, 1))

                        group_evolution["percentage_distribution"] = {
                            "categories": [
                                {
                                    "name": option_labels.get(opt_value, opt_value),
                                    "key": opt_value,
                                    "data": data
                                }
                                for opt_value, data in option_data.items()
                            ]
                        }

                    elif question.question_type == QuestionType.SINGLE_CHOICE:
                        option_labels = {str(opt.id): opt.option_text for opt in question.options}
                        option_values = {str(opt.id): opt.option_value for opt in question.options}
                        option_data: Dict[str, List[float]] = {str(opt.id): [] for opt in question.options}

                        for month_key in sorted_months:
                            month_answers = group_months_data.get(month_key, {}).get(question.id, [])
                            vote_counts: Dict[str, int] = defaultdict(int)

                            for answer in month_answers:
                                if answer.option_id:
                                    vote_counts[str(answer.option_id)] += 1

                            total_votes = sum(vote_counts.values())

                            for opt_id in option_data.keys():
                                count = vote_counts.get(opt_id, 0)
                                percentage = (count / total_votes * 100) if total_votes > 0 else 0
                                option_data[opt_id].append(round(percentage, 1))

                        group_evolution["single_choice"] = {
                            "projects": [
                                {
                                    "name": option_labels.get(opt_id, ""),
                                    "key": option_values.get(opt_id, opt_id),
                                    "data": data
                                }
                                for opt_id, data in option_data.items()
                            ]
                        }

                    elif question.question_type == QuestionType.RATING:
                        rating_data: List[float] = []

                        for month_key in sorted_months:
                            month_answers = group_months_data.get(month_key, {}).get(question.id, [])
                            ratings = [a.rating for a in month_answers if a.rating is not None]
                            avg = sum(ratings) / len(ratings) if ratings else 0
                            rating_data.append(round(avg, 2))

                        group_evolution["rating"] = {
                            "data": rating_data
                        }

                result[group] = group_evolution
            return result

        # Evolución por grupo de edad
        age_groups_list = ["18-30", "31-45", "46-60", "60+"]
        evolution_result["by_age"] = _calc_group_evolution(age_groups_list, answers_by_age_month)

        # Evolución por género
        gender_list = [g for g in answers_by_gender_month.keys() if g != "Sin especificar"]
        evolution_result["by_gender"] = _calc_group_evolution(gender_list, answers_by_gender_month)

        # Evolución por cruce edad+género
        age_gender_list = [k for k in answers_by_age_and_gender_month.keys() if "Sin especificar" not in k]
        evolution_result["by_age_and_gender"] = _calc_group_evolution(age_gender_list, answers_by_age_and_gender_month)

        return evolution_result

    @staticmethod
    def get_survey_segments(db: Session, survey_id: UUID, threshold: int = 20) -> Dict[str, Any]:
        """
        Segmenta a los votantes según sus preferencias en la pregunta de distribución porcentual.
        Una persona entra en un segmento si asignó >= threshold% a esa área.
        """
        # Obtener la encuesta con preguntas
        survey = db.query(Survey).options(
            joinedload(Survey.questions).joinedload(Question.options)
        ).filter(Survey.id == survey_id).first()

        if not survey:
            return {"segments": [], "threshold": threshold, "total_respondents": 0}

        # Encontrar la pregunta de distribución porcentual
        pct_question = None
        for q in survey.questions:
            if q.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                pct_question = q
                break

        if not pct_question:
            return {"segments": [], "threshold": threshold, "total_respondents": 0}

        # Mapeo option_id -> option info
        option_map = {}
        for opt in pct_question.options:
            option_map[str(opt.id)] = {
                "text": opt.option_text,
                "value": opt.option_value or str(opt.id)
            }

        # Obtener respuestas completadas con datos de usuario
        responses = (
            db.query(SurveyResponse, User)
            .join(User, SurveyResponse.user_id == User.id)
            .filter(
                SurveyResponse.survey_id == survey_id,
                SurveyResponse.completed == True
            )
            .all()
        )

        # Obtener las answers de la pregunta de distribución porcentual
        response_ids = [r.id for r, _ in responses]
        user_by_response = {r.id: u for r, u in responses}

        if not response_ids:
            return {"segments": [], "threshold": threshold, "total_respondents": 0}

        answers = (
            db.query(Answer)
            .filter(
                Answer.response_id.in_(response_ids),
                Answer.question_id == pct_question.id
            )
            .all()
        )

        # Agrupar por usuario y promediar porcentajes (un usuario puede tener múltiples respuestas)
        # user_id -> {area_key -> [values]}
        user_area_values: Dict[UUID, Dict[str, List[float]]] = {}
        user_otros_texts: Dict[UUID, str] = {}
        users_map: Dict[UUID, User] = {}

        for answer in answers:
            if not answer.percentage_data:
                continue

            user = user_by_response.get(answer.response_id)
            if not user:
                continue

            users_map[user.id] = user

            if user.id not in user_area_values:
                user_area_values[user.id] = {}

            for key, value in answer.percentage_data.items():
                if key not in user_area_values[user.id]:
                    user_area_values[user.id][key] = []
                user_area_values[user.id][key].append(value)

                if key == "otros" and answer.answer_text:
                    user_otros_texts[user.id] = answer.answer_text

        # Contar usuarios únicos
        total_respondents = len(user_area_values)

        # Construir segmentos con promedios
        segments_data: Dict[str, Dict[str, Any]] = {}

        for user_id, area_values in user_area_values.items():
            user = users_map[user_id]

            for key, values in area_values.items():
                avg_value = sum(values) / len(values)

                if avg_value >= threshold:
                    # Determinar nombre del área
                    if key == "otros":
                        area_name = "OTROS"
                        area_key = "otros"
                    else:
                        opt_info = option_map.get(key)
                        if opt_info:
                            area_name = opt_info["text"]
                            area_key = opt_info["value"]
                        else:
                            area_name = key
                            area_key = key

                    if area_key not in segments_data:
                        segments_data[area_key] = {
                            "area": area_name,
                            "area_key": area_key,
                            "users": []
                        }

                    segments_data[area_key]["users"].append({
                        "id": str(user.id),
                        "name": user.name or "Sin nombre",
                        "email": user.email,
                        "neighborhood": user.neighborhood or "N/A",
                        "city": user.city or "N/A",
                        "percentage": round(avg_value, 1),
                        "otros_text": user_otros_texts.get(user_id) if key == "otros" else None
                    })

        # Ordenar usuarios dentro de cada segmento por porcentaje descendente
        segments = []
        for seg in segments_data.values():
            seg["users"].sort(key=lambda u: u["percentage"], reverse=True)
            seg["count"] = len(seg["users"])
            segments.append(seg)

        # Ordenar segmentos por cantidad de personas descendente
        segments.sort(key=lambda s: s["count"], reverse=True)

        return {
            "segments": segments,
            "threshold": threshold,
            "total_respondents": total_respondents
        }

    @staticmethod
    def _classify_otros_texts(texts: List[str]) -> List[Dict[str, Any]]:
        """
        Usa Claude para clasificar textos libres de 'otros' en categorías semánticas.
        Retorna lista de {text: nombre_categoria, count: cantidad}.
        """
        if not texts:
            return []

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key:
            # Fallback: agrupar por texto exacto si no hay API key
            from collections import Counter
            counts = Counter(texts)
            return [
                {"text": text, "count": count}
                for text, count in counts.most_common()
            ]

        try:
            client = Anthropic(api_key=api_key)

            texts_list = "\n".join(f"- {t}" for t in texts)

            response = client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=1000,
                temperature=0.2,
                messages=[{
                    "role": "user",
                    "content": f"""Tengo las siguientes respuestas de texto libre de una encuesta de participación ciudadana.
Las personas escribieron en qué área adicional les gustaría que se invierta el presupuesto municipal.

Respuestas:
{texts_list}

Agrupa las respuestas en categorías temáticas. Respuestas similares (ej: "comida", "gastronomía", "bares y restaurantes") deben ir en la misma categoría.
Usa nombres de categoría cortos y claros en español (máximo 3-4 palabras).

Respondé SOLO con un JSON array, sin texto adicional ni markdown. Formato:
[{{"category": "Nombre Categoría", "count": N}}]

Ordená de mayor a menor count."""
                }]
            )

            result_text = response.content[0].text.strip()
            # Limpiar posible markdown wrapping
            if result_text.startswith("```"):
                result_text = result_text.split("\n", 1)[1] if "\n" in result_text else result_text
                result_text = result_text.rsplit("```", 1)[0].strip()

            categories = json.loads(result_text)

            return [
                {"text": cat["category"], "count": cat["count"]}
                for cat in categories
                if cat.get("count", 0) > 0
            ]

        except Exception as e:
            logger.error(f"Error clasificando textos con AI: {e}")
            # Fallback: agrupar por texto exacto
            from collections import Counter
            counts = Counter(texts)
            return [
                {"text": text, "count": count}
                for text, count in counts.most_common()
            ]
