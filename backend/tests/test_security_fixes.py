"""Regresiones de la auditoría de seguridad (rama fix/security-audit-2026-07).

Cubre:
- Farmeo de puntos: los puntos se calculan sobre preguntas válidas y distintas.
- Autorización del endpoint de IA ai-predictions (no accesible por ciudadanos).
- GET /surveys/{id} requiere autenticación y respeta el scope por cliente.
"""

import uuid

import pytest

from app.models.survey import Survey, Question, QuestionType
from app.models.response import SurveyResponse as SurveyResponseModel, Answer
from app.models.points import UserPoints
from app.services import membership_service
from app.services.survey_service import SurveyService
from app.schemas.response import SurveyResponseCreate, AnswerCreate
from app.core.security import create_access_token


def _make_survey_with_one_question(db, client, points_per_question=10):
    survey = Survey(
        id=uuid.uuid4(),
        title="S",
        client_id=client.id if client else None,
        is_public=False,
        is_active=True,
        status="active",
        points_per_question=points_per_question,
        bonus_points=0,
        max_responses_per_user=0,
    )
    db.add(survey)
    db.flush()
    question = Question(
        id=uuid.uuid4(),
        survey_id=survey.id,
        question_text="Q1",
        question_type=QuestionType.OPEN_TEXT,
        order_index=0,
        is_required=False,
    )
    db.add(question)
    db.commit()
    db.refresh(survey)
    db.refresh(question)
    return survey, question


def _auth_header(user):
    token = create_access_token(data={"sub": str(user.id), "account_type": "user"})
    return {"Authorization": f"Bearer {token}"}


# --- Fix #1: farmeo de puntos -------------------------------------------------

def test_points_not_inflated_by_duplicate_and_invalid_answers(db, sample_user, sample_client):
    """Enviar answers duplicadas y de question_id inventados no infla los puntos."""
    survey, question = _make_survey_with_one_question(db, sample_client, points_per_question=10)
    membership_service.add_membership(db, sample_user.id, sample_client.id)
    db.commit()

    fake_qid = uuid.uuid4()  # pregunta inexistente
    payload = SurveyResponseCreate(
        survey_id=survey.id,
        completed=True,
        answers=[
            AnswerCreate(question_id=question.id, answer_text="a"),
            AnswerCreate(question_id=question.id, answer_text="dup"),   # duplicada
            AnswerCreate(question_id=fake_qid, answer_text="fake"),     # no es de la encuesta
            AnswerCreate(question_id=uuid.uuid4(), answer_text="fake2"),
        ],
    )

    resp = SurveyService.submit_response(db, payload, user_id=sample_user.id)

    # Solo 1 pregunta válida y distinta => 10 puntos, no 40.
    assert resp.points_earned == 10

    persisted = db.query(Answer).filter(Answer.response_id == resp.id).count()
    assert persisted == 1

    points = db.query(UserPoints).filter(UserPoints.user_id == sample_user.id).first()
    assert points.available_points == 10


# --- Fix #2: autorización de ai-predictions ----------------------------------

def test_ai_predictions_forbidden_for_citizen(client, db, sample_user, sample_client):
    survey, _ = _make_survey_with_one_question(db, sample_client)
    membership_service.add_membership(db, sample_user.id, sample_client.id)
    db.commit()

    r = client.post(
        f"/api/v1/surveys/{survey.id}/ai-predictions",
        headers=_auth_header(sample_user),
    )
    # La autorización corre ANTES del check de ANTHROPIC_API_KEY: debe ser 403, no 500.
    assert r.status_code == 403


def test_ai_predictions_forbidden_without_token(client, db, sample_client):
    survey, _ = _make_survey_with_one_question(db, sample_client)
    r = client.post(f"/api/v1/surveys/{survey.id}/ai-predictions")
    assert r.status_code in (401, 403)


# --- Fix #3: rate limit de login (anti fuerza bruta) --------------------------

def test_login_rate_limited_after_threshold(client):
    """Tras 10 intentos fallidos para una cuenta, el 11º devuelve 429."""
    # CUIL único e inexistente => siempre 401 hasta que corte el rate limit.
    unique_cuil = "20" + uuid.uuid4().int.__str__()[:9]
    body = {"cuil": unique_cuil, "password": "wrong-password"}

    statuses = [client.post("/api/v1/auth/login", json=body).status_code for _ in range(10)]
    assert all(s == 401 for s in statuses)

    # El siguiente intento debe estar limitado.
    assert client.post("/api/v1/auth/login", json=body).status_code == 429


# --- Fix #4: GET /surveys/{id} requiere auth y respeta scope ------------------

def test_get_survey_requires_auth(client, db, sample_client):
    survey, _ = _make_survey_with_one_question(db, sample_client)
    r = client.get(f"/api/v1/surveys/{survey.id}")
    assert r.status_code in (401, 403)


def test_get_survey_forbidden_for_non_member(client, db, sample_client, user_other_client):
    survey, _ = _make_survey_with_one_question(db, sample_client)
    r = client.get(
        f"/api/v1/surveys/{survey.id}",
        headers=_auth_header(user_other_client),
    )
    assert r.status_code == 403


def test_get_survey_ok_for_member(client, db, sample_client, sample_user):
    survey, _ = _make_survey_with_one_question(db, sample_client)
    membership_service.add_membership(db, sample_user.id, sample_client.id)
    db.commit()
    r = client.get(
        f"/api/v1/surveys/{survey.id}",
        headers=_auth_header(sample_user),
    )
    assert r.status_code == 200
    assert r.json()["id"] == str(survey.id)
