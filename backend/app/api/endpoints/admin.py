from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID

from app.db.base import get_db
from app.models.admin import Admin
from app.models.client import Client
from app.api.dependencies import get_current_admin

router = APIRouter()


@router.get("/clients", response_model=List[dict])
def get_all_clients(
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get all clients - Admin only"""
    clients = db.query(Client).all()

    return [
        {
            "id": str(client.id),
            "name": client.name,
            "email": client.email,
            "cuit": client.cuit,
            "phone": client.phone,
            "contact_person": client.contact_person,
            "contact_position": client.contact_position,
            "created_at": client.created_at
        }
        for client in clients
    ]


@router.get("/clients/{client_id}")
def get_client_detail(
    client_id: UUID,
    current_admin: Admin = Depends(get_current_admin),
    db: Session = Depends(get_db)
):
    """Get client detail - Admin only"""
    client = db.query(Client).filter(Client.id == client_id).first()

    if not client:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cliente no encontrado"
        )

    return {
        "id": str(client.id),
        "name": client.name,
        "email": client.email,
        "cuit": client.cuit,
        "phone": client.phone,
        "contact_person": client.contact_person,
        "contact_position": client.contact_position,
        "address": client.address,
        "city": client.city,
        "postal_code": client.postal_code,
        "website": client.website,
        "description": client.description,
        "created_at": client.created_at
    }
