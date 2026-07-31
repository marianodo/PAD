import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.db.base import get_db
from app.models.user import User
from app.models.points import UserPoints, PointTransaction
from app.models.provider import Provider, ProviderClient
from app.models.integration_audit import IntegrationAuditLog
from app.schemas.integration import (
    PointsQueryResponse,
    PointsRedeemRequest,
    PointsRedeemResponse,
)
from app.api.dependencies import verify_api_key
from app.services import membership_service

logger = logging.getLogger(__name__)


def _warn_if_unattributed(db: Session, user: User, scoped_points) -> None:
    """Deja rastro cuando el ciudadano tiene puntos sin entidad asignada.

    Tras el scoping por entidad, los saldos que no se pudieron atribuir quedan
    con client_id NULL. Para el proveedor esos ciudadanos son indistinguibles de
    uno que gastó todo: en ambos casos la respuesta dice 0 puntos. Se registra en
    el log para poder diagnosticarlo sin cambiarle el contrato al proveedor.
    """
    if scoped_points is not None and (scoped_points.available_points or 0) > 0:
        return

    unattributed = db.query(UserPoints).filter(
        UserPoints.user_id == user.id,
        UserPoints.client_id.is_(None),
        UserPoints.available_points > 0,
    ).first()

    if unattributed:
        logger.warning(
            "Contribuyente %s tiene %s puntos sin entidad asignada; se reporta 0 "
            "para la entidad %s. Asignar client_id en user_points para habilitarlos.",
            user.id, unattributed.available_points,
            getattr(user, "authorized_client_id", None),
        )

router = APIRouter()


def _get_authorized_client_ids(provider: Provider, db: Session) -> set:
    """Obtiene los client_ids autorizados para un provider."""
    provider_clients = db.query(ProviderClient).filter(
        ProviderClient.provider_id == provider.id,
        ProviderClient.is_active == True
    ).all()
    return {str(pc.client_id) for pc in provider_clients}


def _get_user_by_cuil_authorized(
    cuil: str,
    provider: Provider,
    db: Session,
) -> User:
    """
    Busca un user por CUIL y verifica que pertenezca a un client autorizado del provider.
    Lanza 404 si no existe, 403 si no está autorizado.
    """
    user = db.query(User).filter(User.cuil == cuil).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Contribuyente no encontrado"
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario deshabilitado"
        )

    member_client_ids = membership_service.get_member_client_ids(db, user.id)
    if not member_client_ids:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Contribuyente no vinculado a ningún municipio"
        )

    authorized_client_ids = _get_authorized_client_ids(provider, db)
    matched = member_client_ids & authorized_client_ids
    if not matched:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene acceso a este contribuyente"
        )

    # Guardar el client autorizado matcheado (no se persiste). Se ordena antes
    # de elegir porque `matched` es un set de strings y su orden de iteración
    # depende del hash, que Python aleatoriza por proceso: sin sorted(), dos
    # workers podrían elegir entidades distintas para el mismo pedido. Desde que
    # los puntos son por entidad, esta elección decide de qué saldo se lee y se
    # debita, así que tiene que ser estable.
    user.authorized_client_id = uuid.UUID(sorted(matched)[0])
    return user


def _log_audit(
    db: Session,
    provider: Provider,
    endpoint: str,
    request: Request,
    response_status: int,
    cuil: str = None,
    client_id=None,
    request_body: dict = None,
    response_body: dict = None,
):
    """Registra una entrada en el audit log."""
    ip_address = request.client.host if request.client else None
    log = IntegrationAuditLog(
        provider_id=provider.id,
        client_id=client_id,
        endpoint=endpoint,
        cuil=cuil,
        request_body=request_body,
        response_status=response_status,
        response_body=response_body,
        ip_address=ip_address,
    )
    db.add(log)
    # No hacemos commit aquí, se hace en la transacción principal


@router.get(
    "/points/{cuil}",
    response_model=PointsQueryResponse,
    summary="Consultar puntos de un contribuyente",
    description="Consulta los puntos totales, disponibles y canjeados de un contribuyente por CUIL. "
                "Solo accesible para CUILs de clientes autorizados del proveedor.",
)
def get_points(
    cuil: str,
    request: Request,
    provider: Provider = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    try:
        user = _get_user_by_cuil_authorized(cuil, provider, db)

        # Los puntos son por entidad: se informa el saldo de la entidad para la
        # que este proveedor está autorizado, no un total entre todas.
        user_points = db.query(UserPoints).filter(
            UserPoints.user_id == user.id,
            UserPoints.client_id == user.authorized_client_id,
        ).first()
        _warn_if_unattributed(db, user, user_points)

        response_data = PointsQueryResponse(
            cuil=cuil,
            total_points=user_points.total_points if user_points else 0,
            available_points=user_points.available_points if user_points else 0,
            redeemed_points=user_points.redeemed_points if user_points else 0,
        )

        _log_audit(
            db=db,
            provider=provider,
            endpoint=f"GET /points/{cuil}",
            request=request,
            response_status=200,
            cuil=cuil,
            client_id=getattr(user, "authorized_client_id", None),
            response_body=response_data.model_dump(mode="json"),
        )
        db.commit()

        return response_data

    except HTTPException as e:
        _log_audit(
            db=db,
            provider=provider,
            endpoint=f"GET /points/{cuil}",
            request=request,
            response_status=e.status_code,
            cuil=cuil,
            response_body={"detail": e.detail},
        )
        db.commit()
        raise


@router.post(
    "/points/redeem",
    response_model=PointsRedeemResponse,
    summary="Informar canjeo de puntos",
    description="Informa que un contribuyente canjeó puntos por un descuento en el pago de impuestos. "
                "Idempotente: si se envía el mismo reference_id, devuelve la transacción original.",
)
def redeem_points(
    body: PointsRedeemRequest,
    request: Request,
    provider: Provider = Depends(verify_api_key),
    db: Session = Depends(get_db),
):
    request_data = body.model_dump(mode="json")

    try:
        # Idempotencia: verificar si reference_id ya fue procesado
        existing_tx = db.query(PointTransaction).filter(
            PointTransaction.reference_id == body.reference_id
        ).first()

        if existing_tx:
            # Devolver la transacción original sin modificar datos
            user_points = db.query(UserPoints).filter(
                UserPoints.user_id == existing_tx.user_id,
                UserPoints.client_id == existing_tx.client_id,
            ).first()

            response_data = PointsRedeemResponse(
                cuil=body.cuil,
                points_redeemed=abs(existing_tx.amount),
                available_points=user_points.available_points if user_points else 0,
                transaction_id=existing_tx.id,
                reference_id=body.reference_id,
                already_processed=True,
            )

            _log_audit(
                db=db,
                provider=provider,
                endpoint="POST /points/redeem",
                request=request,
                response_status=200,
                cuil=body.cuil,
                request_body=request_data,
                response_body=response_data.model_dump(mode="json"),
            )
            db.commit()

            return response_data

        # Buscar y validar acceso al contribuyente
        user = _get_user_by_cuil_authorized(body.cuil, provider, db)

        # Obtener puntos del usuario en la entidad autorizada para este proveedor
        user_points = db.query(UserPoints).filter(
            UserPoints.user_id == user.id,
            UserPoints.client_id == user.authorized_client_id,
        ).with_for_update().first()

        if not user_points or user_points.available_points < body.points:
            _warn_if_unattributed(db, user, user_points)
            available = user_points.available_points if user_points else 0
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Puntos insuficientes. Disponibles: {available}, solicitados: {body.points}"
            )

        # Crear transacción de canjeo
        transaction = PointTransaction(
            user_id=user.id,
            client_id=user.authorized_client_id,
            transaction_type="redeemed",
            amount=-body.points,
            description=body.description or f"Canjeo de {body.points} puntos",
            reference_id=body.reference_id,
        )
        db.add(transaction)

        # Actualizar saldos
        user_points.available_points -= body.points
        user_points.redeemed_points += body.points

        db.flush()  # Para obtener el ID de la transacción

        response_data = PointsRedeemResponse(
            cuil=body.cuil,
            points_redeemed=body.points,
            available_points=user_points.available_points,
            transaction_id=transaction.id,
            reference_id=body.reference_id,
            already_processed=False,
        )

        _log_audit(
            db=db,
            provider=provider,
            endpoint="POST /points/redeem",
            request=request,
            response_status=200,
            cuil=body.cuil,
            client_id=getattr(user, "authorized_client_id", None),
            request_body=request_data,
            response_body=response_data.model_dump(mode="json"),
        )

        db.commit()
        return response_data

    except HTTPException as e:
        db.rollback()
        _log_audit(
            db=db,
            provider=provider,
            endpoint="POST /points/redeem",
            request=request,
            response_status=e.status_code,
            cuil=body.cuil,
            request_body=request_data,
            response_body={"detail": e.detail},
        )
        db.commit()
        raise
