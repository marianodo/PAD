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


def enforce_rate_limit(limiter: "RateLimiter", key: str) -> None:
    """Aplica un rate limit sobre `key`; lanza 429 si se excede."""
    if not limiter.check(key):
        retry_after = limiter.seconds_until_reset(key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados intentos. Intentá nuevamente más tarde.",
            headers={"Retry-After": str(retry_after)},
        )


# --- Rate Limiter ---

class RateLimiter:
    """In-memory rate limiter por provider. Thread-safe."""

    def __init__(self, max_requests: int = 100, window_seconds: int = 60):
        self.max_requests = max_requests
        self.window_seconds = window_seconds
        self._requests: dict[str, list[float]] = defaultdict(list)
        self._lock = threading.Lock()
        self._last_purge = time.time()

    def check(self, provider_id: str) -> bool:
        """Retorna True si el request está permitido, False si excede el límite."""
        now = time.time()
        cutoff = now - self.window_seconds

        with self._lock:
            # Purga global periódica: las claves las elige quien llama, y algunas
            # vienen de endpoints públicos (el email de login de un comercio, por
            # ejemplo). Sin esto, cada valor nuevo deja una entrada para siempre y
            # basta con pedir con un identificador distinto cada vez para hacer
            # crecer la memoria del proceso hasta que lo maten.
            if now - self._last_purge > self.window_seconds:
                stale = [
                    key for key, timestamps in self._requests.items()
                    if not timestamps or max(timestamps) <= cutoff
                ]
                for key in stale:
                    del self._requests[key]
                self._last_purge = now

            # Limpiar requests viejos
            self._requests[provider_id] = [
                ts for ts in self._requests[provider_id] if ts > cutoff
            ]

            if len(self._requests[provider_id]) >= self.max_requests:
                return False

            self._requests[provider_id].append(now)
            return True

    def is_blocked(self, key: str) -> bool:
        """Si la clave ya agotó su cupo, sin consumir un intento.

        Se usa cuando el intento solo debe contarse según cómo termine la
        operación: primero se pregunta, y recién después se registra el fallo.
        """
        cutoff = time.time() - self.window_seconds
        with self._lock:
            recent = [ts for ts in self._requests.get(key, []) if ts > cutoff]
            self._requests[key] = recent
            return len(recent) >= self.max_requests

    def record(self, key: str) -> None:
        """Registra un intento contra la clave."""
        with self._lock:
            self._requests[key].append(time.time())

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

# Anti sondeo de códigos de cupón, keyeado por comercio. Cuenta SOLO los códigos
# que no existen, nunca las operaciones válidas: un local con varias cajas tiene
# que poder validar y consumir en paralelo sin toparse con un 429. Barrer el
# espacio de códigos, en cambio, produce casi puros fallos, y a 30 por minuto
# recorrer 30^6 combinaciones lleva milenios.
coupon_rate_limiter = RateLimiter(max_requests=30, window_seconds=60)


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
    """Get current authenticated account (user, admin, or client).

    Excluye explícitamente a los comercios. Los endpoints que dependen de esto
    autorizan con deny-lists del tipo "si es User, 403; si es Client de otra
    entidad, 403", así que una cuenta que no sea ninguna de las dos los
    atraviesa sin control: un comercio llegaría a los resultados y segmentos de
    encuestas de cualquier entidad, que exponen nombre, email y barrio de cada
    respondente. Los comercios tienen su propia puerta en get_current_merchant.
    """
    account = get_current_account(credentials, db)

    if isinstance(account, Merchant):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta funcionalidad no está disponible para comercios"
        )

    return account


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

    # Solo se consulta el cupo, no se consume: el intento se cuenta después,
    # y únicamente si el código resultó inexistente. Así N cajas del mismo
    # comercio pueden operar en paralelo sin gastarse el cupo entre ellas.
    merchant_key = f"coupon:{merchant.id}"
    if coupon_rate_limiter.is_blocked(merchant_key):
        retry_after = coupon_rate_limiter.seconds_until_reset(merchant_key)
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Demasiados códigos inválidos seguidos. Esperá unos segundos.",
            headers={"Retry-After": str(retry_after)},
        )

    return merchant
