import time
import threading
from collections import defaultdict
from fastapi import Depends, Header, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session
from typing import Optional, Union

import bcrypt

from app.db.base import get_db
from app.models.user import User
from app.models.admin import Admin
from app.models.client import Client
from app.models.provider import Provider
from app.core.security import decode_access_token

security = HTTPBearer()


# --- Rate Limiter ---

class RateLimiter:
    """In-memory rate limiter por provider. Thread-safe."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()

    def check(self, provider_id: str) -> bool:
        """Retorna True si el request está permitido, False si excede el límite."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            # Limpiar requests viejos
            self._requests[provider_id] = [
                ts for ts in self._requests[provider_id] if ts > cutoff
            ]

            if len(self._requests[provider_id]) >= self.max_requests:
                return False

            self._requests[provider_id].append(now)
            return True

    def seconds_until_reset(self, provider_id: str) -> int:
        """Segundos hasta que el window se resetea para este provider."""
        with self._lock:
            timestamps = self._requests.get(provider_id, [])
            if not timestamps:
                return 0
            oldest = min(timestamps)
            remaining = self.window_seconds - (time.time() - oldest)
            return max(1, int(remaining))


rate_limiter = RateLimiter(max_requests=100, window_seconds=60)


# --- API Key Authentication ---

def verify_api_key(
    x_api_key: str = Header(..., alias="X-API-Key"),
    db: Session = Depends(get_db)
) -> Provider:
    """
    Verifica la API key del proveedor de pagos.
    Busca por prefijo (primeros 8 chars) y valida con bcrypt.
    """
    if len(x_api_key) < 8:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="API key inválida"
        )

    prefix = x_api_key[:8]
    candidates = db.query(Provider).filter(
        Provider.api_key_prefix == prefix,
        Provider.is_active == True
    ).all()

    for provider in candidates:
        if bcrypt.checkpw(
            x_api_key.encode("utf-8"),
            provider.api_key_hash.encode("utf-8")
        ):
            # Rate limit check
            provider_id_str = str(provider.id)
            if not rate_limiter.check(provider_id_str):
                retry_after = rate_limiter.seconds_until_reset(provider_id_str)
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail="Rate limit excedido. Intente nuevamente.",
                    headers={"Retry-After": str(retry_after)}
                )
            return provider

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="API key inválida"
    )


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

    # Bloquear usuarios deshabilitados (solo aplica a users)
    if account_type == "user" and not getattr(account, "is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario deshabilitado"
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
