"""Test del flujo de elegibilidad por DNI: registro ↔ padrón."""

import uuid

from app.models.electoral_roll import ElectoralRoll
from app.services import membership_service


def test_register_asigna_membresia_por_dni(client, db, sample_client):
    # Padrón del cliente con un DNI (sin CUIL, como el padrón oficial CNE)
    db.add(ElectoralRoll(
        id=uuid.uuid4(), client_id=sample_client.id, dni="29417473", name="ABACA CINTIA",
    ))
    db.commit()

    # El ciudadano se registra con su CUIL (que contiene ese DNI: 20-29417473-3)
    res = client.post("/api/v1/auth/register", json={
        "cuil": "20294174733",
        "email": "cintia@example.com",
        "password": "secret123",
        "name": "Cintia Abaca",
    })
    assert res.status_code == 201
    user_id = res.json()["id"]

    # Debe quedar como miembro del cliente (match por DNI)
    member_ids = membership_service.get_member_client_ids(db, uuid.UUID(user_id))
    assert str(sample_client.id) in member_ids


def test_register_sin_padron_no_asigna(client, db, sample_client):
    # CUIL cuyo DNI NO está en ningún padrón
    res = client.post("/api/v1/auth/register", json={
        "cuil": "20999999991",
        "email": "nadie@example.com",
        "password": "secret123",
        "name": "Sin Padrón",
    })
    assert res.status_code == 201
    member_ids = membership_service.get_member_client_ids(db, uuid.UUID(res.json()["id"]))
    assert member_ids == set()


def test_register_hereda_membresia_provincia_por_dni(client, db):
    from app.models.client import Client
    from app.core.security import get_password_hash

    provincia = Client(id=uuid.uuid4(), email="prov@x.com",
                       hashed_password=get_password_hash("x"), name="Provincia")
    db.add(provincia); db.flush()
    ciudad = Client(id=uuid.uuid4(), email="ciudad@x.com",
                    hashed_password=get_password_hash("x"), name="Ciudad",
                    parent_id=provincia.id)
    db.add(ciudad)
    db.add(ElectoralRoll(id=uuid.uuid4(), client_id=ciudad.id, dni="30163510", name="X"))
    db.commit()

    res = client.post("/api/v1/auth/register", json={
        "cuil": "20301635108", "email": "v@x.com", "password": "secret123", "name": "Vecino",
    })
    assert res.status_code == 201
    member_ids = membership_service.get_member_client_ids(db, uuid.UUID(res.json()["id"]))
    # Miembro de la ciudad Y de la provincia (herencia)
    assert str(ciudad.id) in member_ids
    assert str(provincia.id) in member_ids
