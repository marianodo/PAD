from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Union
import logging

logger = logging.getLogger(__name__)

from app.db.base import get_db
from app.models.user import User
from app.models.admin import Admin
from app.models.client import Client
from app.models.electoral_roll import ElectoralRoll
from app.services import membership_service
from app.core.identity import dni_from_cuil
from app.schemas.auth import LoginRequest, RegisterRequest, Token
from app.schemas.user import UserResponse
from app.core.security import (
    verify_password, get_password_hash, create_access_token, DUMMY_PASSWORD_HASH,
)
from app.core.config import settings
from app.api.dependencies import (
    get_current_user, login_rate_limiter, register_rate_limiter, enforce_rate_limit,
)

router = APIRouter()

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user_data: RegisterRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """Register a new regular user (citizen)."""
    client_ip = request.client.host if request.client else "unknown"
    enforce_rate_limit(register_rate_limiter, f"register:{client_ip}")

    # Check if CUIL already exists
    existing_user = db.query(User).filter(User.cuil == user_data.cuil).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CUIL ya registrado"
        )

    # Check if email already exists
    existing_email = db.query(User).filter(User.email == user_data.email).first()
    if existing_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email ya registrado"
        )

    # Validate minimum age (18 years)
    if user_data.birth_date:
        from datetime import date
        today = date.today()
        age = today.year - user_data.birth_date.year - (
            (today.month, today.day) < (user_data.birth_date.month, user_data.birth_date.day)
        )
        if age < 18:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Debés tener al menos 18 años para registrarte"
            )

    # Create new user (citizen)
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        cuil=user_data.cuil,
        dni=dni_from_cuil(user_data.cuil),
        hashed_password=hashed_password,
        email=user_data.email,
        name=user_data.name,
        phone=user_data.phone,
        birth_date=user_data.birth_date,
        gender=user_data.gender,
        address=user_data.address,
        neighborhood=user_data.neighborhood,
        city=user_data.city,
        postal_code=user_data.postal_code
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    # Si el DNI ya está en algún padrón, asignar membresías automáticamente
    # (con herencia por parent_id). Match por DNI: el CUIL contiene el DNI.
    padron_client_ids = [
        cid for (cid,) in db.query(ElectoralRoll.client_id).filter(
            ElectoralRoll.dni == new_user.dni
        ).distinct().all()
    ] if new_user.dni else []
    if padron_client_ids:
        for cid in padron_client_ids:
            membership_service.add_membership(db, new_user.id, cid)
        if new_user.client_id is None:
            new_user.client_id = padron_client_ids[0]
        db.commit()
        db.refresh(new_user)

    return {
        "id": str(new_user.id),
        "cuil": new_user.cuil,
        "email": new_user.email,
        "name": new_user.name,
        "account_type": "user"
    }


@router.post("/login", response_model=Token)
def login_v2(
    credentials: LoginRequest,
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Login with CUIL/Email and password.
    Busca en las tres tablas: users (CUIL), admins (email), clients (email).
    """
    # Anti fuerza bruta: se limita por identificador de cuenta (no por IP) para
    # apuntar al brute-force de una cuenta puntual sin afectar IPs compartidas.
    enforce_rate_limit(login_rate_limiter, f"login:{credentials.cuil.strip().lower()}")

    account: Union[User, Admin, Client, None] = None
    account_type = None

    # Si contiene @, es email (buscar en admins y clients)
    if "@" in credentials.cuil:
        # Primero buscar en admins
        admin = db.query(Admin).filter(Admin.email == credentials.cuil).first()
        if admin:
            account = admin
            account_type = "admin"
        else:
            # Luego buscar en clients
            client = db.query(Client).filter(Client.email == credentials.cuil).first()
            if client:
                account = client
                account_type = "client"
            else:
                # Por último, buscar en users por si algún user tiene email
                user = db.query(User).filter(User.email == credentials.cuil).first()
                if user:
                    account = user
                    account_type = "user"
    else:
        # Es CUIL, buscar solo en users
        user = db.query(User).filter(User.cuil == credentials.cuil).first()
        if user:
            account = user
            account_type = "user"

    # Verificación de password en tiempo constante: si la cuenta no existe se
    # verifica contra un hash dummy para no revelar la existencia por timing.
    if account is None:
        verify_password(credentials.password, DUMMY_PASSWORD_HASH)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not verify_password(credentials.password, account.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Check is_active for users (only users tienen este flag)
    if account_type == "user" and not getattr(account, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario deshabilitado. Contactá al administrador.",
        )

    # Create access token with account type
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(account.id), "account_type": account_type},
        expires_delta=access_token_expires
    )

    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
def get_current_user_info(current_user: Union[User, Admin, Client] = Depends(get_current_user)):
    """Get current user information from token."""
    # Determinar el tipo de cuenta y retornar con campo account_type
    if isinstance(current_user, Admin):
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "account_type": "admin",
            "created_at": current_user.created_at
        }
    elif isinstance(current_user, Client):
        return {
            "id": str(current_user.id),
            "email": current_user.email,
            "name": current_user.name,
            "account_type": "client",
            "cuit": current_user.cuit,
            "phone": current_user.phone,
            "created_at": current_user.created_at
        }
    else:  # User
        return {
            "id": str(current_user.id),
            "cuil": current_user.cuil,
            "email": current_user.email,
            "name": current_user.name,
            "account_type": "user",
            "phone": current_user.phone,
            "birth_date": current_user.birth_date,
            "gender": current_user.gender,
            "address": current_user.address,
            "neighborhood": current_user.neighborhood,
            "city": current_user.city,
            "postal_code": current_user.postal_code,
            "created_at": current_user.created_at
        }
