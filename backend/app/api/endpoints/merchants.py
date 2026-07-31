from fastapi import APIRouter, Depends, HTTPException, Request, status
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
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.dependencies import (
    get_current_merchant,
    login_rate_limiter,
    register_rate_limiter,
)

router = APIRouter()

# Mismo criterio que en auth.py: se verifica contra un hash dummy cuando la
# cuenta no existe, para no revelar su existencia por diferencia de tiempo.
_DUMMY_PASSWORD_HASH = get_password_hash("dummy-password-for-constant-time-check")


def _enforce_rate_limit(limiter, key: str) -> None:
    """Aplica un rate limit sobre `key`; lanza 429 si se excede."""
    if not limiter.check(key):
        retry_after = limiter.seconds_until_reset(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Intentá nuevamente más tarde.",
            headers={"Retry-After": str(retry_after)},
        )


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
    _enforce_rate_limit(register_rate_limiter, f"merchant_register:{client_ip}")

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
    db.commit()
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
    _enforce_rate_limit(login_rate_limiter, f"merchant_login:{email}")

    merchant = db.query(Merchant).filter(Merchant.email == email).first()

    if merchant is None:
        verify_password(credentials.password, _DUMMY_PASSWORD_HASH)
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
