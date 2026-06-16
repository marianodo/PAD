"""Tests de elegibilidad multi-cliente (membresía + jerarquía + públicas)."""

import uuid

from app.models.client import Client
from app.models.survey import Survey
from app.services import membership_service
from app.services.survey_service import SurveyService
from app.core.security import get_password_hash


def _make_client(db, name, parent=None):
    c = Client(
        id=uuid.uuid4(),
        email=f"{name.lower()}@example.com",
        hashed_password=get_password_hash("x"),
        name=name,
        parent_id=parent.id if parent else None,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


def _make_survey(db, client, is_public=False, title="S"):
    s = Survey(
        id=uuid.uuid4(),
        title=title,
        client_id=client.id if client else None,
        is_public=is_public,
        is_active=True,
        status="active",
        points_per_question=10,
        bonus_points=70,
        max_responses_per_user=0,
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def test_member_can_access_own_client_survey(db, sample_user, sample_client):
    survey = _make_survey(db, sample_client)
    membership_service.add_membership(db, sample_user.id, sample_client.id)
    db.commit()
    assert membership_service.user_can_access_survey(db, sample_user, survey) is True


def test_non_member_is_blocked(db, sample_user, another_client):
    survey = _make_survey(db, another_client)
    # sample_user no tiene membresía en another_client
    assert membership_service.user_can_access_survey(db, sample_user, survey) is False


def test_parent_inheritance_grants_province_access(db, sample_user):
    province = _make_client(db, "Provincia")
    city = _make_client(db, "Ciudad", parent=province)
    city_survey = _make_survey(db, city, title="ciudad")
    province_survey = _make_survey(db, province, title="provincia")

    # miembro solo de la ciudad
    added = membership_service.add_membership(db, sample_user.id, city.id)
    db.commit()

    # se agregó ciudad + provincia (herencia)
    assert len(added) == 2
    assert membership_service.user_can_access_survey(db, sample_user, city_survey) is True
    assert membership_service.user_can_access_survey(db, sample_user, province_survey) is True


def test_public_survey_open_to_any_user(db, sample_user):
    public_survey = _make_survey(db, None, is_public=True, title="publica")
    assert membership_service.user_can_access_survey(db, sample_user, public_survey) is True


def test_available_surveys_filters_by_eligibility(db, sample_user, sample_client, another_client):
    own = _make_survey(db, sample_client, title="own")
    other = _make_survey(db, another_client, title="other")
    public = _make_survey(db, None, is_public=True, title="public")
    membership_service.add_membership(db, sample_user.id, sample_client.id)
    db.commit()

    available_ids = {str(s.id) for s in SurveyService.get_available_surveys(db, sample_user)}
    assert str(own.id) in available_ids
    assert str(public.id) in available_ids
    assert str(other.id) not in available_ids


def test_add_membership_is_idempotent(db, sample_user):
    fresh = _make_client(db, "Fresh")
    first = membership_service.add_membership(db, sample_user.id, fresh.id)
    db.commit()
    assert len(first) == 1
    second = membership_service.add_membership(db, sample_user.id, fresh.id)
    db.commit()
    assert second == []
