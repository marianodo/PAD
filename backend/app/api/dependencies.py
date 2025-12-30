from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, Union

from app.db.base import get_db
from app.models.user import User
from app.models.admin import Admin
from app.models.client import Client
from app.core.security import decode_access_token

security = HTTPBearer()


def get_current_account(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Union[User, Admin, Client]:
    """
    Get current authenticated account from JWT token.
    Returns User, Admin, or Client based on account_type in token.
    """

    token = credentials.credentials
    payload = decode_access_token(token)

    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido o expirado",
            headers={"WWW-Authenticate": "Bearer"},
        )

    account_id: Optional[str] = payload.get("sub")
    account_type: Optional[str] = payload.get("account_type")

    if account_id is None or account_type is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Buscar en la tabla correspondiente según account_type
    account = None
    if account_type == "user":
        account = db.query(User).filter(User.id == account_id).first()
    elif account_type == "admin":
        account = db.query(Admin).filter(Admin.id == account_id).first()
    elif account_type == "client":
        account = db.query(Client).filter(Client.id == account_id).first()

    if account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Cuenta no encontrada"
        )

    return account


# Alias para mantener compatibilidad con código existente
def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db)
) -> Union[User, Admin, Client]:
    """Get current authenticated account (user, admin, or client)."""
    return get_current_account(credentials, db)


def get_current_admin(
    account: Union[User, Admin, Client] = Depends(get_current_account)
) -> Admin:
    """Verify that current account is an admin."""
    if not isinstance(account, Admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de administrador"
        )
    return account


def get_current_client(
    account: Union[User, Admin, Client] = Depends(get_current_account)
) -> Client:
    """Verify that current account is a client."""
    if not isinstance(account, Client):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tienes permisos de cliente"
        )
    return account


def get_current_regular_user(
    account: Union[User, Admin, Client] = Depends(get_current_account)
) -> User:
    """Verify that current account is a regular user."""
    if not isinstance(account, User):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidad es solo para usuarios regulares"
        )
    return account
