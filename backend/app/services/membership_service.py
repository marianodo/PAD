"""Servicio de membresías ciudadano ↔ municipio (multi-tenant).

La elegibilidad para votar una encuesta se basa en membresías (`user_clients`):
un ciudadano puede pertenecer a varios clientes. Si un cliente tiene `parent_id`
(ej: ciudad → provincia), la membresía se **hereda hacia arriba**.
"""

from typing import List, Set
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.client import Client
from app.models.survey import Survey
from app.models.user import User
from app.models.user_client import UserClient


def get_ancestor_client_ids(db: Session, client_id: UUID) -> List[UUID]:
    """Devuelve [client_id, padre, abuelo, ...] siguiendo `parent_id`.

    Incluye el propio client. Tiene guarda anti-ciclos.
    """
    chain: List[UUID] = []
    visited: Set[str] = set()
    current = db.query(Client).filter(Client.id == client_id).first()
    while current is not None and str(current.id) not in visited:
        visited.add(str(current.id))
        chain.append(current.id)
        current = (
            db.query(Client).filter(Client.id == current.parent_id).first()
            if current.parent_id
            else None
        )
    return chain


def add_membership(db: Session, user_id: UUID, client_id: UUID) -> List[UUID]:
    """Agrega la membresía del usuario al client y a todos sus ancestros.

    Idempotente. NO hace commit (lo hace el caller). Devuelve los client_id agregados.
    """
    existing = {
        str(cid)
        for (cid,) in db.query(UserClient.client_id).filter(
            UserClient.user_id == user_id
        ).all()
    }
    added: List[UUID] = []
    for cid in get_ancestor_client_ids(db, client_id):
        if str(cid) not in existing:
            db.add(UserClient(user_id=user_id, client_id=cid))
            existing.add(str(cid))
            added.append(cid)
    return added


def get_member_client_ids(db: Session, user_id: UUID) -> Set[str]:
    """Set de client_id (como str) a los que pertenece el usuario."""
    return {
        str(cid)
        for (cid,) in db.query(UserClient.client_id).filter(
            UserClient.user_id == user_id
        ).all()
    }


def user_can_access_survey(db: Session, user: User, survey: Survey) -> bool:
    """True si el usuario puede ver/responder la encuesta.

    Reglas: la encuesta es pública, o el usuario es miembro del client dueño.
    """
    if getattr(survey, "is_public", False):
        return True
    if survey.client_id is None:
        return False
    return str(survey.client_id) in get_member_client_ids(db, user.id)
