from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta, date
from uuid import UUID
from collections import Counter
import time

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

# In-memory cache for AI classification results (TTL: 1 hour)
_otros_cache: Dict[str, Any] = {}
_OTROS_CACHE_TTL = 3600


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
        Usa agregaciones SQL para evitar cargar millones de filas en Python.
        """
        from sqlalchemy import text as sql_text
        from collections import defaultdict

        survey_id_str = str(survey_id)

        # --- 1. KPIs de conteo con SQL ---
        date_filter_sql = ""
        date_params: Dict[str, Any] = {"survey_id": survey_id_str}

        if date_from:
            date_filter_sql += " AND sr.completed_at >= :date_from"
            date_params["date_from"] = datetime.combine(date_from, datetime.min.time())
        if date_to:
            date_filter_sql += " AND sr.completed_at <= :date_to"
            date_params["date_to"] = datetime.combine(date_to, datetime.max.time())

        now = datetime.now()
        first_day_of_month = datetime(now.year, now.month, 1)
        if now.month == 1:
            first_day_prev_month = datetime(now.year - 1, 12, 1)
        else:
            first_day_prev_month = datetime(now.year, now.month - 1, 1)

        kpi_row = db.execute(sql_text(f"""
            SELECT
                COUNT(*) AS total,
                COUNT(*) FILTER (WHERE sr.started_at >= :first_day_month) AS monthly,
                COUNT(*) FILTER (WHERE sr.started_at >= :first_day_prev AND sr.started_at < :first_day_month) AS prev_monthly
            FROM survey_responses sr
            WHERE sr.survey_id = :survey_id AND sr.completed = TRUE
            {date_filter_sql}
        """), {**date_params, "first_day_month": first_day_of_month, "first_day_prev": first_day_prev_month}).fetchone()

        total_responses = kpi_row.total or 0
        monthly_responses = kpi_row.monthly or 0
        prev_month_responses = kpi_row.prev_monthly or 0

        if prev_month_responses > 0:
            monthly_change = round(((monthly_responses - prev_month_responses) / prev_month_responses) * 100)
        else:
            monthly_change = 100 if monthly_responses > 0 else 0

        total_at_start_of_month = total_responses - monthly_responses
        if total_at_start_of_month > 0:
            total_change = round((monthly_responses / total_at_start_of_month) * 100)
        else:
            total_change = 100 if total_responses > 0 else 0

        if total_responses == 0:
            return {
                "survey_id": survey_id_str,
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

        # --- 2. Demographics via SQL GROUP BY ---
        # Age group computed in SQL using EXTRACT(YEAR FROM AGE(birth_date))
        demo_rows = db.execute(sql_text(f"""
            SELECT
                CASE
                    WHEN u.birth_date IS NULL THEN 'Sin especificar'
                    WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 18 THEN 'Menor de 18'
                    WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 31 THEN '18-30'
                    WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 46 THEN '31-45'
                    WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 61 THEN '46-60'
                    ELSE '60+'
                END AS age_group,
                COALESCE(u.gender, 'Sin especificar') AS gender,
                COALESCE(u.city, 'Sin especificar') AS city,
                COALESCE(u.neighborhood, 'Sin especificar') AS neighborhood,
                COUNT(*) AS cnt
            FROM survey_responses sr
            JOIN users u ON sr.user_id = u.id
            WHERE sr.survey_id = :survey_id AND sr.completed = TRUE
            {date_filter_sql}
            GROUP BY age_group, gender, city, neighborhood
        """), date_params).fetchall()

        age_groups: Dict[str, int] = defaultdict(int)
        cities: Dict[str, int] = defaultdict(int)
        neighborhoods: Dict[str, int] = defaultdict(int)
        genders: Dict[str, int] = defaultdict(int)
        age_groups_by_gender: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

        for row in demo_rows:
            age_groups[row.age_group] += row.cnt
            genders[row.gender] += row.cnt
            cities[row.city] += row.cnt
            neighborhoods[row.neighborhood] += row.cnt
            age_groups_by_gender[row.gender][row.age_group] += row.cnt

        # --- 3. Questions with their options ---
        questions = db.query(Question).filter(
            Question.survey_id == survey_id
        ).order_by(Question.order_index).all()

        # Helper: age group expression (reused across queries)
        age_case = """
            CASE
                WHEN u.birth_date IS NULL THEN 'Sin especificar'
                WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 18 THEN 'Menor de 18'
                WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 31 THEN '18-30'
                WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 46 THEN '31-45'
                WHEN EXTRACT(YEAR FROM AGE(u.birth_date)) < 61 THEN '46-60'
                ELSE '60+'
            END
        """

        questions_summary = []

        for question in questions:
            options = {opt.id: {"text": opt.option_text, "value": opt.option_value}
                      for opt in question.options}

            question_data = {
                "question_id": str(question.id),
                "question_text": question.question_text,
                "question_type": question.question_type.value,
                "total_answers": 0,
                "results": {},
                "results_by_age": {},
                "results_by_gender": {},
                "results_by_age_and_gender": {},
                "results_by_neighborhood": {},
                "results_by_city": {}
            }

            q_id_str = str(question.id)
            q_params = {**date_params, "question_id": q_id_str}

            if question.question_type == QuestionType.RATING:
                # SQL: GROUP BY demographic + rating value → count
                rating_rows = db.execute(sql_text(f"""
                    SELECT
                        a.rating,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        COALESCE(u.city, 'Sin especificar') AS city,
                        COALESCE(u.neighborhood, 'Sin especificar') AS neighborhood,
                        COUNT(*) AS cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.rating IS NOT NULL
                    {date_filter_sql}
                    GROUP BY a.rating, age_group, gender, city, neighborhood
                """), q_params).fetchall()

                # Aggregate in Python (from compact aggregated rows, not raw rows)
                total_ratings = 0
                total_rating_sum = 0
                dist: Dict[str, int] = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0}

                by_age: Dict[str, Dict] = defaultdict(lambda: {"sum": 0, "count": 0, "dist": defaultdict(int)})
                by_gender: Dict[str, Dict] = defaultdict(lambda: {"sum": 0, "count": 0, "dist": defaultdict(int)})
                by_age_gender: Dict[str, Dict] = defaultdict(lambda: {"sum": 0, "count": 0, "dist": defaultdict(int)})
                by_neighborhood: Dict[str, Dict] = defaultdict(lambda: {"sum": 0, "count": 0, "dist": defaultdict(int)})
                by_city: Dict[str, Dict] = defaultdict(lambda: {"sum": 0, "count": 0, "dist": defaultdict(int)})

                for row in rating_rows:
                    r, cnt = row.rating, row.cnt
                    total_ratings += cnt
                    total_rating_sum += r * cnt
                    dist[str(r)] = dist.get(str(r), 0) + cnt

                    ag, gn, ct, nb = row.age_group, row.gender, row.city, row.neighborhood
                    ag_key = f"{ag}|{gn}"

                    for bucket in [by_age[ag], by_gender[gn], by_age_gender[ag_key], by_neighborhood[nb], by_city[ct]]:
                        bucket["sum"] += r * cnt
                        bucket["count"] += cnt
                        bucket["dist"][str(r)] += cnt

                def _fmt_rating_bucket(bucket):
                    cnt = bucket["count"]
                    avg = bucket["sum"] / cnt if cnt else 0
                    d = {str(k): bucket["dist"].get(str(k), 0) for k in range(1, 6)}
                    return {"average": round(avg, 2), "total_ratings": cnt, "distribution": d}

                avg_rating = total_rating_sum / total_ratings if total_ratings else 0
                question_data["total_answers"] = total_ratings
                question_data["results"] = {
                    "average": round(avg_rating, 2),
                    "total_ratings": total_ratings,
                    "distribution": dist
                }
                question_data["results_by_age"] = {k: _fmt_rating_bucket(v) for k, v in by_age.items()}
                question_data["results_by_gender"] = {k: _fmt_rating_bucket(v) for k, v in by_gender.items()}
                question_data["results_by_age_and_gender"] = {k: _fmt_rating_bucket(v) for k, v in by_age_gender.items()}
                question_data["results_by_neighborhood"] = {k: _fmt_rating_bucket(v) for k, v in by_neighborhood.items()}
                question_data["results_by_city"] = {k: _fmt_rating_bucket(v) for k, v in by_city.items()}

            elif question.question_type == QuestionType.SINGLE_CHOICE:
                vote_rows = db.execute(sql_text(f"""
                    SELECT
                        a.option_id::text AS option_id,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        COALESCE(u.city, 'Sin especificar') AS city,
                        COALESCE(u.neighborhood, 'Sin especificar') AS neighborhood,
                        COUNT(*) AS cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.option_id IS NOT NULL
                    {date_filter_sql}
                    GROUP BY a.option_id, age_group, gender, city, neighborhood
                """), q_params).fetchall()

                # Aggregate
                total_votes_map: Dict[str, int] = defaultdict(int)
                by_age: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
                by_gender: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
                by_age_gender: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
                by_neighborhood: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
                by_city: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))

                for row in vote_rows:
                    opt_id, cnt = row.option_id, row.cnt
                    ag, gn, ct, nb = row.age_group, row.gender, row.city, row.neighborhood
                    total_votes_map[opt_id] += cnt
                    by_age[ag][opt_id] += cnt
                    by_gender[gn][opt_id] += cnt
                    by_age_gender[f"{ag}|{gn}"][opt_id] += cnt
                    by_neighborhood[nb][opt_id] += cnt
                    by_city[ct][opt_id] += cnt

                def _fmt_votes(votes_dict):
                    total = sum(votes_dict.values())
                    result = {}
                    for opt_id, count in votes_dict.items():
                        try:
                            opt_uuid = UUID(opt_id)
                        except Exception:
                            continue
                        if opt_uuid in options:
                            opt_info = options[opt_uuid]
                            pct = (count / total * 100) if total else 0
                            result[opt_info["value"]] = {
                                "label": opt_info["text"],
                                "votes": count,
                                "percentage": round(pct, 1)
                            }
                    return result

                total_answers = sum(total_votes_map.values())
                question_data["total_answers"] = total_answers
                question_data["results"] = _fmt_votes(total_votes_map)
                question_data["results_by_age"] = {k: _fmt_votes(v) for k, v in by_age.items()}
                question_data["results_by_gender"] = {k: _fmt_votes(v) for k, v in by_gender.items()}
                question_data["results_by_age_and_gender"] = {k: _fmt_votes(v) for k, v in by_age_gender.items()}
                question_data["results_by_neighborhood"] = {k: _fmt_votes(v) for k, v in by_neighborhood.items()}
                question_data["results_by_city"] = {k: _fmt_votes(v) for k, v in by_city.items()}

            elif question.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                # Build option_id -> option_value/text maps
                option_id_map: Dict[str, Dict] = {}
                for opt in question.options:
                    option_id_map[str(opt.id)] = {"value": opt.option_value, "text": opt.option_text}

                def _get_option_label(k):
                    if k in ("otros", "otro"):
                        return "OTROS"
                    for o in question.options:
                        if o.option_value == k:
                            return o.option_text
                    return k

                # Two aggregated queries instead of 530k raw rows:
                # 1) SUM + COUNT per key per demographic group
                pct_agg_rows = db.execute(sql_text(f"""
                    SELECT
                        kv.key AS pct_key,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        COALESCE(u.city, 'Sin especificar') AS city,
                        COALESCE(u.neighborhood, 'Sin especificar') AS neighborhood,
                        SUM(kv.value::float) AS total_val,
                        COUNT(*) AS cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    JOIN LATERAL jsonb_each(a.percentage_data) kv ON TRUE
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.percentage_data IS NOT NULL
                    {date_filter_sql}
                    GROUP BY pct_key, age_group, gender, city, neighborhood
                """), q_params).fetchall()

                # 2) Respondent counts per demographic (for "otros" divisor)
                resp_count_rows = db.execute(sql_text(f"""
                    SELECT
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        COALESCE(u.city, 'Sin especificar') AS city,
                        COALESCE(u.neighborhood, 'Sin especificar') AS neighborhood,
                        COUNT(DISTINCT a.response_id) AS resp_cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.percentage_data IS NOT NULL
                    {date_filter_sql}
                    GROUP BY age_group, gender, city, neighborhood
                """), q_params).fetchall()

                # Build respondent count lookups
                total_respondents = 0
                resp_by_age: Dict[str, int] = defaultdict(int)
                resp_by_gender: Dict[str, int] = defaultdict(int)
                resp_by_age_gender: Dict[str, int] = defaultdict(int)
                resp_by_neighborhood: Dict[str, int] = defaultdict(int)
                resp_by_city: Dict[str, int] = defaultdict(int)
                for row in resp_count_rows:
                    total_respondents += row.resp_cnt
                    resp_by_age[row.age_group] += row.resp_cnt
                    resp_by_gender[row.gender] += row.resp_cnt
                    resp_by_age_gender[f"{row.age_group}|{row.gender}"] += row.resp_cnt
                    resp_by_neighborhood[row.neighborhood] += row.resp_cnt
                    resp_by_city[row.city] += row.resp_cnt

                # Accumulate sums and counts per key per group from aggregated rows
                pct_totals: Dict[str, float] = defaultdict(float)
                pct_counts: Dict[str, int] = defaultdict(int)
                # group -> key -> {sum, count}
                pct_by_age: Dict[str, Dict[str, Dict]] = defaultdict(lambda: defaultdict(lambda: {"sum": 0.0, "cnt": 0}))
                pct_by_gender: Dict[str, Dict[str, Dict]] = defaultdict(lambda: defaultdict(lambda: {"sum": 0.0, "cnt": 0}))
                pct_by_age_gender: Dict[str, Dict[str, Dict]] = defaultdict(lambda: defaultdict(lambda: {"sum": 0.0, "cnt": 0}))
                pct_by_neighborhood: Dict[str, Dict[str, Dict]] = defaultdict(lambda: defaultdict(lambda: {"sum": 0.0, "cnt": 0}))
                pct_by_city: Dict[str, Dict[str, Dict]] = defaultdict(lambda: defaultdict(lambda: {"sum": 0.0, "cnt": 0}))

                for row in pct_agg_rows:
                    raw_key = row.pct_key
                    opt_info = option_id_map.get(raw_key)
                    option_key = opt_info["value"] if opt_info else raw_key
                    if option_key.lower() in ("otro", "otros"):
                        option_key = "otros"
                    ag, gn, ct, nb = row.age_group, row.gender, row.city, row.neighborhood
                    ag_key = f"{ag}|{gn}"

                    pct_totals[option_key] += float(row.total_val)
                    pct_counts[option_key] += row.cnt

                    for bucket in [pct_by_age[ag][option_key], pct_by_gender[gn][option_key],
                                   pct_by_age_gender[ag_key][option_key], pct_by_neighborhood[nb][option_key],
                                   pct_by_city[ct][option_key]]:
                        bucket["sum"] += float(row.total_val)
                        bucket["cnt"] += row.cnt

                def _build_pct_results(totals, counts, total_resp):
                    result = {}
                    for key in totals:
                        divisor = total_resp if key in ("otros", "otro") else counts[key]
                        avg = totals[key] / divisor if divisor else 0
                        result[key] = {"label": _get_option_label(key), "percentage": round(avg, 1)}
                    return result

                def _calc_pct_by_group(group_data, group_resp_counts):
                    result = {}
                    for grp, categories in group_data.items():
                        grp_resp = group_resp_counts.get(grp, 0)
                        result[grp] = {}
                        for key, bucket in categories.items():
                            if key in ("otros", "otro"):
                                divisor = grp_resp or bucket["cnt"]
                            else:
                                divisor = bucket["cnt"]
                            avg = bucket["sum"] / divisor if divisor else 0
                            result[grp][key] = {"label": _get_option_label(key), "percentage": round(avg, 1)}
                            
                    return result

                question_data["total_answers"] = total_respondents
                question_data["results"] = _build_pct_results(pct_totals, pct_counts, total_respondents)
                question_data["results_by_age"] = _calc_pct_by_group(pct_by_age, resp_by_age)
                question_data["results_by_gender"] = _calc_pct_by_group(pct_by_gender, resp_by_gender)
                question_data["results_by_age_and_gender"] = _calc_pct_by_group(pct_by_age_gender, resp_by_age_gender)
                question_data["results_by_neighborhood"] = _calc_pct_by_group(pct_by_neighborhood, resp_by_neighborhood)
                question_data["results_by_city"] = _calc_pct_by_group(pct_by_city, resp_by_city)

                # "Otros" free-text summary — support UUID key (Córdoba) and string key "otros" (Alta Gracia)
                otro_uuid = next(
                    (uid for uid, meta in option_id_map.items()
                     if meta["value"].lower() in ("otro", "otros")),
                    None
                )
                otros_texts_rows = []
                if otro_uuid:
                    otros_texts_rows = db.execute(sql_text(f"""
                        SELECT a.answer_text
                        FROM answers a
                        JOIN survey_responses sr ON a.response_id = sr.id
                        WHERE sr.survey_id = :survey_id
                          AND sr.completed = TRUE
                          AND a.question_id = :question_id
                          AND a.answer_text IS NOT NULL
                          AND a.answer_text != ''
                          AND COALESCE((a.percentage_data->>'{otro_uuid}')::float, 0) > 0
                        {date_filter_sql}
                        LIMIT 500
                    """), q_params).fetchall()
                if not otros_texts_rows:
                    # Fallback: string key "otros" (legacy surveys like Alta Gracia)
                    otros_texts_rows = db.execute(sql_text(f"""
                        SELECT a.answer_text
                        FROM answers a
                        JOIN survey_responses sr ON a.response_id = sr.id
                        WHERE sr.survey_id = :survey_id
                          AND sr.completed = TRUE
                          AND a.question_id = :question_id
                          AND a.answer_text IS NOT NULL
                          AND a.answer_text != ''
                          AND COALESCE((a.percentage_data->>'otros')::float, 0) > 0
                        {date_filter_sql}
                        LIMIT 500
                    """), q_params).fetchall()

                otros_raw_texts = [r.answer_text.strip() for r in otros_texts_rows if r.answer_text and r.answer_text.strip()]
                if otros_raw_texts:
                    cache_key = f"{survey_id_str}:{q_id_str}:{date_filter_sql}"
                    question_data["otros_summary"] = SurveyService._classify_otros_texts(otros_raw_texts, cache_key)
                else:
                    question_data["otros_summary"] = []

            questions_summary.append(question_data)

        # --- 4. Evolution data via SQL ---
        evolution_data = SurveyService._calculate_evolution_data_sql(
            db, survey_id, survey_id_str, questions, date_filter_sql, date_params, age_case
        )

        return {
            "survey_id": survey_id_str,
            "total_responses": total_responses,
            "monthly_responses": monthly_responses,
            "monthly_change": monthly_change,
            "total_change": total_change,
            "demographics": {
                "by_age_group": dict(age_groups),
                "by_age_group_by_gender": {k: dict(v) for k, v in age_groups_by_gender.items()},
                "by_city": dict(cities),
                "by_neighborhood": dict(neighborhoods),
                "by_gender": dict(genders)
            },
            "questions_summary": questions_summary,
            "evolution_data": evolution_data
        }

    @staticmethod
    def _calculate_evolution_data_sql(
        db: Session,
        survey_id: UUID,
        survey_id_str: str,
        questions: List[Question],
        date_filter_sql: str,
        date_params: Dict[str, Any],
        age_case: str,
    ) -> Dict[str, Any]:
        """
        Calcula la evolución histórica de respuestas por mes usando SQL GROUP BY.
        """
        from sqlalchemy import text as sql_text
        from collections import defaultdict

        month_names = {
            "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
            "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
            "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic"
        }

        def get_month_label(month_key: str) -> str:
            return month_names.get(month_key.split("-")[1], month_key.split("-")[1])

        evolution_result: Dict[str, Any] = {
            "months": [],
            "percentage_distribution": {},
            "single_choice": {},
            "rating": {},
            "by_age": {},
            "by_gender": {},
            "by_age_and_gender": {}
        }

        # Detect available months (last 8)
        months_rows = db.execute(sql_text(f"""
            SELECT DISTINCT TO_CHAR(sr.started_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key
            FROM survey_responses sr
            WHERE sr.survey_id = :survey_id AND sr.completed = TRUE
            {date_filter_sql}
            ORDER BY month_key
        """), date_params).fetchall()

        sorted_months = [r.month_key for r in months_rows if r.month_key][-8:]
        evolution_result["months"] = [get_month_label(m) for m in sorted_months]

        if not sorted_months:
            return evolution_result

        for question in questions:
            q_id_str = str(question.id)
            q_params = {**date_params, "question_id": q_id_str}

            if question.question_type == QuestionType.RATING:
                # Rating: AVG per month, plus breakdowns by age and gender
                rating_evo_rows = db.execute(sql_text(f"""
                    SELECT
                        TO_CHAR(sr.started_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        AVG(a.rating) AS avg_rating,
                        COUNT(*) AS cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.rating IS NOT NULL
                    {date_filter_sql}
                    GROUP BY month_key, age_group, gender
                """), q_params).fetchall()

                # General monthly averages
                month_rating: Dict[str, list] = defaultdict(list)
                month_age_gender: Dict[str, Dict[str, Dict[str, list]]] = defaultdict(
                    lambda: defaultdict(lambda: defaultdict(list))
                )
                for row in rating_evo_rows:
                    mk = row.month_key
                    if mk in sorted_months:
                        month_rating[mk].append((row.avg_rating, row.cnt))
                        month_age_gender[row.age_group][mk]["ratings"].append((row.avg_rating, row.cnt))
                        month_age_gender[f"{row.age_group}|{row.gender}"][mk]["ratings"].append((row.avg_rating, row.cnt))
                        month_age_gender[row.gender][mk]["ratings"].append((row.avg_rating, row.cnt))

                def _weighted_avg(pairs):
                    total_cnt = sum(p[1] for p in pairs)
                    if not total_cnt:
                        return 0.0
                    return round(float(sum(float(p[0]) * p[1] for p in pairs)) / total_cnt, 2)

                rating_data = [_weighted_avg(month_rating.get(m, [])) for m in sorted_months]
                evolution_result["rating"] = {
                    "question_id": q_id_str,
                    "question_text": question.question_text,
                    "data": rating_data
                }

                # By age/gender/cross (re-aggregate from rating_evo_rows)
                age_groups_seen = set()
                genders_seen = set()
                age_genders_seen = set()
                for row in rating_evo_rows:
                    age_groups_seen.add(row.age_group)
                    genders_seen.add(row.gender)
                    age_genders_seen.add(f"{row.age_group}|{row.gender}")

                # by_age
                by_age_evo: Dict[str, Dict] = {}
                for ag in age_groups_seen:
                    ag_month_data: Dict[str, list] = defaultdict(list)
                    for row in rating_evo_rows:
                        if row.age_group == ag and row.month_key in sorted_months:
                            ag_month_data[row.month_key].append((row.avg_rating, row.cnt))
                    by_age_evo[ag] = {
                        "rating": {"data": [_weighted_avg(ag_month_data.get(m, [])) for m in sorted_months]}
                    }
                for ag, data in by_age_evo.items():
                    if ag not in evolution_result["by_age"]:
                        evolution_result["by_age"][ag] = {}
                    evolution_result["by_age"][ag].update(data)

                # by_gender
                by_gender_evo: Dict[str, Dict] = {}
                for gn in genders_seen:
                    if gn == "Sin especificar":
                        continue
                    gn_month_data: Dict[str, list] = defaultdict(list)
                    for row in rating_evo_rows:
                        if row.gender == gn and row.month_key in sorted_months:
                            gn_month_data[row.month_key].append((row.avg_rating, row.cnt))
                    by_gender_evo[gn] = {
                        "rating": {"data": [_weighted_avg(gn_month_data.get(m, [])) for m in sorted_months]}
                    }
                for gn, data in by_gender_evo.items():
                    if gn not in evolution_result["by_gender"]:
                        evolution_result["by_gender"][gn] = {}
                    evolution_result["by_gender"][gn].update(data)

                # by_age_and_gender
                by_ag_evo: Dict[str, Dict] = {}
                for ag_key in age_genders_seen:
                    if "Sin especificar" in ag_key:
                        continue
                    parts = ag_key.split("|")
                    ag, gn = parts[0], parts[1]
                    ag_gn_month_data: Dict[str, list] = defaultdict(list)
                    for row in rating_evo_rows:
                        if row.age_group == ag and row.gender == gn and row.month_key in sorted_months:
                            ag_gn_month_data[row.month_key].append((row.avg_rating, row.cnt))
                    by_ag_evo[ag_key] = {
                        "rating": {"data": [_weighted_avg(ag_gn_month_data.get(m, [])) for m in sorted_months]}
                    }
                for ag_key, data in by_ag_evo.items():
                    if ag_key not in evolution_result["by_age_and_gender"]:
                        evolution_result["by_age_and_gender"][ag_key] = {}
                    evolution_result["by_age_and_gender"][ag_key].update(data)

            elif question.question_type == QuestionType.SINGLE_CHOICE:
                sc_evo_rows = db.execute(sql_text(f"""
                    SELECT
                        TO_CHAR(sr.started_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key,
                        a.option_id::text AS option_id,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        COUNT(*) AS cnt
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.option_id IS NOT NULL
                    {date_filter_sql}
                    GROUP BY month_key, option_id, age_group, gender
                """), q_params).fetchall()

                # option_id -> label/value
                option_labels = {str(opt.id): opt.option_text for opt in question.options}
                option_values = {str(opt.id): opt.option_value for opt in question.options}
                all_opt_ids = list(option_labels.keys())

                # month -> option_id -> count
                month_option_counts: Dict[str, Dict[str, int]] = defaultdict(lambda: defaultdict(int))
                for row in sc_evo_rows:
                    if row.month_key in sorted_months:
                        month_option_counts[row.month_key][row.option_id] += row.cnt

                option_data: Dict[str, list] = {opt_id: [] for opt_id in all_opt_ids}
                for m in sorted_months:
                    month_counts = month_option_counts.get(m, {})
                    total = sum(month_counts.values())
                    for opt_id in all_opt_ids:
                        cnt = month_counts.get(opt_id, 0)
                        pct = (cnt / total * 100) if total else 0
                        option_data[opt_id].append(round(pct, 1))

                evolution_result["single_choice"] = {
                    "question_id": q_id_str,
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

            elif question.question_type == QuestionType.PERCENTAGE_DISTRIBUTION:
                option_id_map = {str(opt.id): opt.option_value for opt in question.options}
                option_labels_map = {opt.option_value: opt.option_text for opt in question.options}
                option_labels_map["otros"] = "OTROS"
                all_opt_values = [opt.option_value for opt in question.options]

                # Single query with age_group and gender for all breakdowns
                pct_evo_rows = db.execute(sql_text(f"""
                    SELECT
                        TO_CHAR(sr.started_at AT TIME ZONE 'UTC', 'YYYY-MM') AS month_key,
                        kv.key AS pct_key,
                        {age_case} AS age_group,
                        COALESCE(u.gender, 'Sin especificar') AS gender,
                        AVG(kv.value::float) AS avg_pct
                    FROM answers a
                    JOIN survey_responses sr ON a.response_id = sr.id
                    JOIN users u ON sr.user_id = u.id
                    JOIN LATERAL jsonb_each(a.percentage_data) kv ON TRUE
                    WHERE sr.survey_id = :survey_id
                      AND sr.completed = TRUE
                      AND a.question_id = :question_id
                      AND a.percentage_data IS NOT NULL
                    {date_filter_sql}
                    GROUP BY month_key, pct_key, age_group, gender
                """), q_params).fetchall()

                def _build_pct_categories(rows_iter, opt_values_list):
                    """Build categories list from (month_key, opt_value, avg_pct) tuples."""
                    mp: Dict[str, Dict[str, float]] = defaultdict(dict)
                    local_opts = list(opt_values_list)
                    for mk, ov, avg in rows_iter:
                        if mk in sorted_months:
                            mp[mk][ov] = round(float(avg), 1)
                            if ov not in local_opts:
                                local_opts.append(ov)
                    evo: Dict[str, list] = {v: [] for v in local_opts}
                    for m in sorted_months:
                        for ov in local_opts:
                            evo[ov].append(mp.get(m, {}).get(ov, 0))
                    return [
                        {"name": option_labels_map.get(ov, ov), "key": ov, "data": d}
                        for ov, d in evo.items()
                    ]

                # General (all ages/genders)
                general_rows = [
                    (row.month_key, option_id_map.get(row.pct_key, row.pct_key), row.avg_pct)
                    for row in pct_evo_rows if row.month_key in sorted_months
                ]
                # Aggregate general: group by (month, opt_value) using weighted average
                gen_agg: Dict[tuple, list] = defaultdict(list)
                for row in pct_evo_rows:
                    if row.month_key in sorted_months:
                        ov = option_id_map.get(row.pct_key, row.pct_key)
                        gen_agg[(row.month_key, ov)].append(row.avg_pct)
                        if ov not in all_opt_values:
                            all_opt_values.append(ov)

                month_pct_gen: Dict[str, Dict[str, float]] = defaultdict(dict)
                for (mk, ov), vals in gen_agg.items():
                    month_pct_gen[mk][ov] = round(float(sum(vals) / len(vals)), 1)

                option_evo_data: Dict[str, list] = {v: [] for v in all_opt_values}
                for m in sorted_months:
                    for opt_v in all_opt_values:
                        option_evo_data[opt_v].append(month_pct_gen.get(m, {}).get(opt_v, 0))

                gen_categories = [
                    {"name": option_labels_map.get(ov, ov), "key": ov, "data": d}
                    for ov, d in option_evo_data.items()
                ]

                evolution_result["percentage_distribution"] = {
                    "question_id": q_id_str,
                    "question_text": question.question_text,
                    "categories": gen_categories
                }

                # by_age breakdown
                age_groups_pct = set(row.age_group for row in pct_evo_rows)
                by_age_pct: Dict[str, Dict] = {}
                for ag in age_groups_pct:
                    ag_agg: Dict[tuple, list] = defaultdict(list)
                    for row in pct_evo_rows:
                        if row.age_group == ag and row.month_key in sorted_months:
                            ov = option_id_map.get(row.pct_key, row.pct_key)
                            ag_agg[(row.month_key, ov)].append(row.avg_pct)
                    ag_month_pct: Dict[str, Dict[str, float]] = defaultdict(dict)
                    for (mk, ov), vals in ag_agg.items():
                        ag_month_pct[mk][ov] = round(float(sum(vals) / len(vals)), 1)
                    ag_evo: Dict[str, list] = {v: [] for v in all_opt_values}
                    for m in sorted_months:
                        for ov in all_opt_values:
                            ag_evo[ov].append(ag_month_pct.get(m, {}).get(ov, 0))
                    by_age_pct[ag] = {
                        "percentage_distribution": {
                            "categories": [
                                {"name": option_labels_map.get(ov, ov), "key": ov, "data": d}
                                for ov, d in ag_evo.items()
                            ]
                        }
                    }
                # Merge into existing by_age (may already have rating data)
                for ag, data in by_age_pct.items():
                    if ag not in evolution_result["by_age"]:
                        evolution_result["by_age"][ag] = {}
                    evolution_result["by_age"][ag].update(data)

                # by_gender breakdown
                genders_pct = set(row.gender for row in pct_evo_rows if row.gender != "Sin especificar")
                by_gender_pct: Dict[str, Dict] = {}
                for gn in genders_pct:
                    gn_agg: Dict[tuple, list] = defaultdict(list)
                    for row in pct_evo_rows:
                        if row.gender == gn and row.month_key in sorted_months:
                            ov = option_id_map.get(row.pct_key, row.pct_key)
                            gn_agg[(row.month_key, ov)].append(row.avg_pct)
                    gn_month_pct: Dict[str, Dict[str, float]] = defaultdict(dict)
                    for (mk, ov), vals in gn_agg.items():
                        gn_month_pct[mk][ov] = round(float(sum(vals) / len(vals)), 1)
                    gn_evo: Dict[str, list] = {v: [] for v in all_opt_values}
                    for m in sorted_months:
                        for ov in all_opt_values:
                            gn_evo[ov].append(gn_month_pct.get(m, {}).get(ov, 0))
                    by_gender_pct[gn] = {
                        "percentage_distribution": {
                            "categories": [
                                {"name": option_labels_map.get(ov, ov), "key": ov, "data": d}
                                for ov, d in gn_evo.items()
                            ]
                        }
                    }
                for gn, data in by_gender_pct.items():
                    if gn not in evolution_result["by_gender"]:
                        evolution_result["by_gender"][gn] = {}
                    evolution_result["by_gender"][gn].update(data)

                # by_age_and_gender breakdown
                by_ag_pct: Dict[str, Dict] = {}
                age_genders_pct = set(
                    f"{row.age_group}|{row.gender}" for row in pct_evo_rows
                    if row.gender != "Sin especificar"
                )
                for ag_key in age_genders_pct:
                    parts = ag_key.split("|")
                    ag, gn = parts[0], parts[1]
                    agg_agg: Dict[tuple, list] = defaultdict(list)
                    for row in pct_evo_rows:
                        if row.age_group == ag and row.gender == gn and row.month_key in sorted_months:
                            ov = option_id_map.get(row.pct_key, row.pct_key)
                            agg_agg[(row.month_key, ov)].append(row.avg_pct)
                    agg_month_pct: Dict[str, Dict[str, float]] = defaultdict(dict)
                    for (mk, ov), vals in agg_agg.items():
                        agg_month_pct[mk][ov] = round(float(sum(vals) / len(vals)), 1)
                    agg_evo: Dict[str, list] = {v: [] for v in all_opt_values}
                    for m in sorted_months:
                        for ov in all_opt_values:
                            agg_evo[ov].append(agg_month_pct.get(m, {}).get(ov, 0))
                    by_ag_pct[ag_key] = {
                        "percentage_distribution": {
                            "categories": [
                                {"name": option_labels_map.get(ov, ov), "key": ov, "data": d}
                                for ov, d in agg_evo.items()
                            ]
                        }
                    }
                for ag_key, data in by_ag_pct.items():
                    if ag_key not in evolution_result["by_age_and_gender"]:
                        evolution_result["by_age_and_gender"][ag_key] = {}
                    evolution_result["by_age_and_gender"][ag_key].update(data)

        return evolution_result

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
        Segmenta votantes según preferencias en la pregunta de distribución porcentual.
        Usa SQL agregado para evitar cargar miles de filas en Python.
        """
        from sqlalchemy import text as sql_text
        survey_id_str = str(survey_id)

        # Obtener pregunta y sus opciones
        survey = db.query(Survey).options(
            joinedload(Survey.questions).joinedload(Question.options)
        ).filter(Survey.id == survey_id).first()

        if not survey:
            return {"segments": [], "threshold": threshold, "total_respondents": 0}

        pct_question = next(
            (q for q in survey.questions if q.question_type == QuestionType.PERCENTAGE_DISTRIBUTION),
            None
        )
        if not pct_question:
            return {"segments": [], "threshold": threshold, "total_respondents": 0}

        # Mapeo option_id -> {text, value}
        option_map = {
            str(opt.id): {"text": opt.option_text, "value": opt.option_value or str(opt.id)}
            for opt in pct_question.options
        }

        pct_question_id_str = str(pct_question.id)

        # Single SQL: promedio por (user_id, pct_key), filtrando ya por threshold
        rows = db.execute(sql_text(f"""
            SELECT
                u.id        AS user_id,
                u.name      AS user_name,
                u.email     AS user_email,
                u.neighborhood AS neighborhood,
                u.city      AS city,
                kv.key      AS pct_key,
                AVG(kv.value::float) AS avg_pct,
                MAX(a.answer_text)   AS otros_text
            FROM answers a
            JOIN survey_responses sr ON a.response_id = sr.id
            JOIN users u ON sr.user_id = u.id
            JOIN LATERAL jsonb_each(a.percentage_data) kv ON TRUE
            WHERE sr.survey_id = :survey_id
              AND sr.completed = TRUE
              AND a.question_id = :question_id
            GROUP BY u.id, u.name, u.email, u.neighborhood, u.city, kv.key
            HAVING AVG(kv.value::float) >= :threshold
            ORDER BY avg_pct DESC
        """), {
            "survey_id": survey_id_str,
            "question_id": pct_question_id_str,
            "threshold": threshold,
        }).fetchall()

        # Total respondents (sin filtro de threshold)
        total_row = db.execute(sql_text("""
            SELECT COUNT(DISTINCT u.id)
            FROM survey_responses sr
            JOIN users u ON sr.user_id = u.id
            WHERE sr.survey_id = :survey_id AND sr.completed = TRUE
        """), {"survey_id": survey_id_str}).scalar()
        total_respondents = total_row or 0

        # Agrupar en segmentos
        segments_data: Dict[str, Dict[str, Any]] = {}

        for row in rows:
            key = row.pct_key
            avg_value = float(row.avg_pct)

            if key in ("otros", "otro"):
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
                segments_data[area_key] = {"area": area_name, "area_key": area_key, "users": []}

            segments_data[area_key]["users"].append({
                "id": str(row.user_id),
                "name": row.user_name or "Sin nombre",
                "email": row.user_email,
                "neighborhood": row.neighborhood or "N/A",
                "city": row.city or "N/A",
                "percentage": round(avg_value, 1),
                "otros_text": row.otros_text if key in ("otros", "otro") else None,
            })

        segments = []
        for seg in segments_data.values():
            seg["users"].sort(key=lambda u: u["percentage"], reverse=True)
            seg["count"] = len(seg["users"])
            segments.append(seg)

        segments.sort(key=lambda s: s["count"], reverse=True)

        return {
            "segments": segments,
            "threshold": threshold,
            "total_respondents": total_respondents,
        }

    @staticmethod
    def _classify_otros_texts(texts: List[str], cache_key: str = "") -> List[Dict[str, Any]]:
        """
        Usa Claude para clasificar textos libres de 'otros' en categorías semánticas.
        Retorna lista de {text: nombre_categoria, count: cantidad}.
        """
        if not texts:
            return []

        # Check in-memory cache first
        if cache_key:
            cached = _otros_cache.get(cache_key)
            if cached and time.time() - cached["ts"] < _OTROS_CACHE_TTL:
                return cached["data"]

        # Pre-aggregate by exact text — reduces tokens and makes result deterministic
        counts = Counter(t.lower().strip() for t in texts)
        # If all texts are already clean categories (≤ 20 unique), skip AI
        unique_texts = list(counts.keys())

        api_key = settings.ANTHROPIC_API_KEY
        if not api_key or len(unique_texts) <= 20:
            result = [
                {"text": text.capitalize(), "count": count}
                for text, count in counts.most_common()
            ]
            if cache_key:
                _otros_cache[cache_key] = {"data": result, "ts": time.time()}
            return result

        try:
            client = Anthropic(api_key=api_key)

            # Pass pre-aggregated counts so Claude groups semantically similar ones
            texts_list = "\n".join(f"- {t} ({c} menciones)" for t, c in counts.most_common())

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

            result = [
                {"text": cat["category"], "count": cat["count"]}
                for cat in categories
                if cat.get("count", 0) > 0
            ]
            if cache_key:
                _otros_cache[cache_key] = {"data": result, "ts": time.time()}
            return result

        except Exception as e:
            logger.error(f"Error clasificando textos con AI: {e}")
            # Fallback: already have counts from pre-aggregation above
            result = [
                {"text": text.capitalize(), "count": count}
                for text, count in counts.most_common()
            ]
            if cache_key:
                _otros_cache[cache_key] = {"data": result, "ts": time.time()}
            return result
