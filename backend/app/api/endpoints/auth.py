from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import Union
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
logger.info("AUTH ENDPOINT MODULE LOADED - VERSION 2.0")

from app.db.base import get_db
from app.models.user import User
from app.models.admin import Admin
from app.models.client import Client
from app.schemas.auth import LoginRequest, RegisterRequest, Token
from app.schemas.user import UserResponse
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.api.dependencies import get_current_user

router = APIRouter()


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(
    user_data: RegisterRequest,
    db: Session = Depends(get_db)
):
    """Register a new regular user (citizen)."""

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

    # Create new user (citizen)
    hashed_password = get_password_hash(user_data.password)
    new_user = User(
        cuil=user_data.cuil,
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
    db: Session = Depends(get_db)
):
    """
    Login with CUIL/Email and password.
    Busca en las tres tablas: users (CUIL), admins (email), clients (email).
    VERSION 2 - Fixed to search in admins table first
    """
    logger.warning(f"=== LOGIN ATTEMPT V2 === Email/CUIL: {credentials.cuil}")

    account: Union[User, Admin, Client, None] = None
    account_type = None

    # Si contiene @, es email (buscar en admins y clients)
    if "@" in credentials.cuil:
        logger.warning(f"Email detected ({credentials.cuil}), searching in admins first")

        # Primero buscar en admins
        admin = db.query(Admin).filter(Admin.email == credentials.cuil).first()
        logger.warning(f"Admin query result: {admin is not None}")

        if admin:
            logger.warning(f"✅ Admin found - ID: {admin.id}, Email: {admin.email}")
            account = admin
            account_type = "admin"
        else:
            logger.warning(f"No admin found, checking clients...")
            # Luego buscar en clients
            client = db.query(Client).filter(Client.email == credentials.cuil).first()
            if client:
                logger.warning(f"✅ Client found - ID: {client.id}")
                account = client
                account_type = "client"
            else:
                logger.warning(f"No client found, checking users...")
                # Por último, buscar en users por si algún user tiene email
                user = db.query(User).filter(User.email == credentials.cuil).first()
                if user:
                    logger.warning(f"✅ User found - ID: {user.id}")
                    account = user
                    account_type = "user"
    else:
        logger.warning(f"CUIL detected ({credentials.cuil}), searching in users only")
        # Es CUIL, buscar solo en users
        user = db.query(User).filter(User.cuil == credentials.cuil).first()
        if user:
            account = user
            account_type = "user"

    if not account:
        logger.warning(f"❌ NO ACCOUNT FOUND for: {credentials.cuil}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Verify password
    logger.warning(f"Account found ({account_type}), verifying password...")
    password_valid = verify_password(credentials.password, account.hashed_password)
    logger.warning(f"Password verification result: {password_valid}")

    if not password_valid:
        logger.warning(f"❌ INVALID PASSWORD for: {credentials.cuil}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciales incorrectas",
            headers={"WWW-Authenticate": "Bearer"},
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
