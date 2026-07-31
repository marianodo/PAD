from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List

from app.db.base import get_db
from app.models.client import Client
from app.models.merchant import Merchant, MERCHANT_PENDING
from app.schemas.auth import Token
from app.schemas.merchant import (
    MerchantRegisterRequest,
    MerchantLoginRequest,
    MerchantResponse,
)
from app.core.security import (
    verify_password, get_password_hash, create_access_token, DUMMY_PASSWORD_HASH,
)
from app.core.config import settings
from app.api.dependencies import (
    get_current_merchant,
    login_rate_limiter,
    register_rate_limiter,
    enforce_rate_limit,
)

router = APIRouter()


def _to_response(merchant: Merchant) -> MerchantResponse:
    data = MerchantResponse.model_validate(merchant)
    data.client_name = merchant.client.name if merchant.client else None
    return data


@router.get("/entities", response_model=List[dict])
def list_entities(db: Session = Depends(get_db)):
    """Entidades a las que un comercio puede adherirse.

    Público a propósito: hace falta antes de tener cuenta, para poder elegir la
    entidad en el alta. Devuelve solo id y nombre — son organizaciones públicas y
    no se expone ningún dato de contacto ni fiscal.
    """
    entities = db.query(Client.id, Client.name).order_by(Client.name.asc()).all()
    return [{"id": str(e.id), "name": e.name} for e in entities]


@router.post("/register", response_model=MerchantResponse, status_code=status.HTTP_201_CREATED)
def register_merchant(
    body: MerchantRegisterRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Alta de un comercio.

    Queda en estado 'pending': el comercio puede entrar y ver su cuenta, pero no
    puede consumir cupones hasta que verifiquemos con la entidad que está
    adherido al plan y lo habilitemos.
    """
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(register_rate_limiter, f"merchant_register:{client_ip}")

    entity = db.query(Client).filter(Client.id == body.client_id).first()
    if not entity:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La entidad indicada no existe",
        )

    email = body.email.strip().lower()
    if db.query(Merchant).filter(Merchant.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )

    merchant = Merchant(
        client_id=body.client_id,
        email=email,
        hashed_password=get_password_hash(body.password),
        name=body.name,
        cuit=body.cuit,
        address=body.address,
        phone=body.phone,
        status=MERCHANT_PENDING,
    )
    db.add(merchant)
    try:
        db.commit()
    except IntegrityError:
        # Dos altas simultáneas con el mismo email pasan las dos por el chequeo
        # de arriba; el índice único es el que decide, y la que pierde tiene que
        # ver el mismo 400 que habría visto en serie, no un 500.
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El email ya está registrado",
        )
    db.refresh(merchant)

    return _to_response(merchant)


@router.post("/login", response_model=Token)
def login_merchant(
    credentials: MerchantLoginRequest,
    db: Session = Depends(get_db),
):
    """Login de comercio.

    Un comercio pendiente puede autenticarse: necesita poder entrar para ver el
    estado de su solicitud. El bloqueo para operar está en get_approved_merchant.
    """
    email = credentials.email.strip().lower()
    enforce_rate_limit(login_rate_limiter, f"merchant_login:{email}")

    merchant = db.query(Merchant).filter(Merchant.email == email).first()

    if merchant is None:
        verify_password(credentials.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(credentials.password, merchant.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(
        data={"sub": str(merchant.id), "account_type": "merchant"},
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me", response_model=MerchantResponse)
def get_merchant_me(
    merchant: Merchant = Depends(get_current_merchant),
):
    """Datos del comercio autenticado, incluido su estado de habilitación."""
    return _to_response(merchant)
