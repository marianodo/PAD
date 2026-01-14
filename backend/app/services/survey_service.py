from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, date
from uuid import UUID

from app.models.survey import Survey, Question, QuestionOption
from app.models.response import SurveyResponse, Answer
from app.models.user import User
from app.models.client import Client
from app.models.points import UserPoints, PointTransaction
from app.schemas.survey import SurveyCreate
from app.schemas.response import SurveyResponseCreate, AnswerCreate


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
    def get_survey_results(db: Session, survey_id: UUID) -> Dict[str, Any]:
        """
        Obtiene los resultados y estadísticas demográficas de una encuesta.
        Retorna KPIs por edad, ciudad y barrio.
        """
        # Obtener todas las respuestas completadas con datos del usuario
        responses = db.query(SurveyResponse, User).join(
            User, SurveyResponse.user_id == User.id
        ).filter(
            SurveyResponse.survey_id == survey_id,
            SurveyResponse.completed == True
        ).all()

        total_responses = len(responses)

        # Calcular respuestas de este mes
        now = datetime.now()
        first_day_of_month = datetime(now.year, now.month, 1)
        monthly_responses = sum(
            1 for response, _ in responses
            if response.started_at and response.started_at.replace(tzinfo=None) >= first_day_of_month
        )

        if total_responses == 0:
            return {
                "survey_id": str(survey_id),
                "total_responses": 0,
                "monthly_responses": 0,
                "demographics": {
                    "by_age_group": {},
                    "by_city": {},
                    "by_neighborhood": {}
                }
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
            elif age < 25:
                return "18-24"
            elif age < 35:
                return "25-34"
            elif age < 45:
                return "35-44"
            elif age < 55:
                return "45-54"
            elif age < 65:
                return "55-64"
            else:
                return "65+"

        # Contadores
        age_groups: Dict[str, int] = {}
        cities: Dict[str, int] = {}
        neighborhoods: Dict[str, int] = {}

        for response, user in responses:
            # Por grupo de edad
            age = calculate_age(user.birth_date)
            age_group = get_age_group(age)
            age_groups[age_group] = age_groups.get(age_group, 0) + 1

            # Por ciudad
            city = user.city or "Sin especificar"
            cities[city] = cities.get(city, 0) + 1

            # Por barrio
            neighborhood = user.neighborhood or "Sin especificar"
            neighborhoods[neighborhood] = neighborhoods.get(neighborhood, 0) + 1

        return {
            "survey_id": str(survey_id),
            "total_responses": total_responses,
            "monthly_responses": monthly_responses,
            "demographics": {
                "by_age_group": age_groups,
                "by_city": cities,
                "by_neighborhood": neighborhoods
            }
        }
