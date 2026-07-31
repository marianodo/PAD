import time
import threading
import uuid
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
from app.models.merchant import Merchant, MERCHANT_APPROVED
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

# Anti fuerza bruta en login: se keyea por IDENTIFICADOR de cuenta (CUIL/email),
# no por IP, para no bloquear usuarios legítimos detrás de una IP compartida
# (CGNAT, wifi municipal). 10 intentos cada 5 minutos por cuenta.
login_rate_limiter = RateLimiter(max_requests=10, window_seconds=300)

# Anti abuso de registro masivo: se keyea por IP con un umbral más tolerante
# (permite altas en lote desde una oficina, corta bots).
register_rate_limiter = RateLimiter(max_requests=30, window_seconds=300)

# Anti fuerza bruta de códigos de cupón: se keyea por comercio. Un mostrador real
# tipea unos pocos códigos por minuto, así que 20 por minuto no molesta a nadie
# legítimo y hace inviable barrer el espacio de códigos desde una cuenta.
coupon_rate_limiter = RateLimiter(max_requests=20, window_seconds=60)


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
) -> Union[User, Admin, Client, Merchant]:
    """
    Get current authenticated account from JWT token.
    Returns User, Admin, Client, or Merchant based on account_type in token.
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

    # El sub del token es el UUID de la cuenta. Parseo explícito para no depender
    # de la coerción del driver de la DB y rechazar tokens con sub malformado.
    try:
        account_uuid = uuid.UUID(str(account_id))
    except (ValueError, AttributeError, TypeError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token inválido",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Buscar en la tabla correspondiente según account_type
    account = None
    if account_type == "user":
        account = db.query(User).filter(User.id == account_uuid).first()
    elif account_type == "admin":
        account = db.query(Admin).filter(Admin.id == account_uuid).first()
    elif account_type == "client":
        account = db.query(Client).filter(Client.id == account_uuid).first()
    elif account_type == "merchant":
        account = db.query(Merchant).filter(Merchant.id == account_uuid).first()

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


def get_current_merchant(
    account: Union[User, Admin, Client, Merchant] = Depends(get_current_account)
) -> Merchant:
    """Verify that current account is a merchant (aprobado o no)."""
    if not isinstance(account, Merchant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidad es solo para comercios"
        )
    return account


def get_approved_merchant(
    merchant: Merchant = Depends(get_current_merchant)
) -> Merchant:
    """Exige un comercio habilitado.

    El alta la hace el comercio por su cuenta, pero recién puede operar cuando
    verificamos con la entidad que está efectivamente adherido al plan.
    """
    if merchant.status != MERCHANT_APPROVED:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta todavía no está habilitada para consumir cupones."
        )

    # El rate limit va acá y no en el endpoint para que cubra por igual la
    # validación y el consumo: son las dos puertas donde se prueban códigos.
    merchant_key = f"coupon:{merchant.id}"
    if not coupon_rate_limiter.check(merchant_key):
        retry_after = coupon_rate_limiter.seconds_until_reset(merchant_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiadas consultas de cupones. Esperá unos segundos.",
            headers={"Retry-After": str(retry_after)},
        )

    return merchant
