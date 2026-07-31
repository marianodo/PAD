from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID

from app.db.base import get_db
from app.models.client import Client
from app.models.merchant import Merchant
from app.models.user import User
from app.schemas.coupon import (
    CouponBalanceResponse,
    CouponCreateRequest,
    CouponRedeemResponse,
    CouponResponse,
    CouponRewardResponse,
    CouponValidationResponse,
)
from app.services.coupon_service import CouponService, CouponError
from app.api.dependencies import get_approved_merchant, get_current_regular_user

router = APIRouter()


def _raise(error: CouponError):
    """Traduce un error de dominio a HTTP.

    El detail lleva el código además del mensaje porque la pantalla del comercio
    necesita distinguir "ya consumido" de "vencido" para saber qué mostrar.
    """
    raise HTTPException(
        status_code=error.status_code,
        detail={"code": error.code, "message": error.message},
    )


def _coupon_to_response(coupon) -> CouponResponse:
    data = CouponResponse.model_validate(coupon)
    data.client_name = coupon.client.name if coupon.client else None
    data.reward_name = coupon.reward.name if coupon.reward else None
    data.redeemed_by_merchant_name = (
        coupon.redeemed_by_merchant.name if coupon.redeemed_by_merchant else None
    )
    return data


# --- Ciudadano ---

@router.get("/balances", response_model=List[CouponBalanceResponse])
def get_my_balances(
    user: User = Depends(get_current_regular_user),
    db: Session = Depends(get_db),
):
    """Saldos del ciudadano por entidad, con el catálogo de cada una.

    Es lo que alimenta la pantalla de cupones: en qué entidades tiene puntos y
    qué puede canjear en cada una.
    """
    balances = []

    for points in CouponService.get_balances(db, user.id):
        entity = db.query(Client).filter(Client.id == points.client_id).first()
        available = points.available_points or 0

        rewards = []
        for reward in CouponService.list_rewards(db, points.client_id):
            item = CouponRewardResponse.model_validate(reward)
            item.affordable = available >= reward.points_cost
            rewards.append(item)

        balances.append(CouponBalanceResponse(
            client_id=points.client_id,
            client_name=entity.name if entity else "Entidad desconocida",
            available_points=available,
            total_points=points.total_points or 0,
            rewards=rewards,
        ))

    return balances


@router.get("/me", response_model=List[CouponResponse])
def get_my_coupons(
    client_id: Optional[UUID] = None,
    user: User = Depends(get_current_regular_user),
    db: Session = Depends(get_db),
):
    """Cupones del ciudadano, del más nuevo al más viejo."""
    coupons = CouponService.list_user_coupons(db, user.id, client_id)
    return [_coupon_to_response(c) for c in coupons]


@router.post("", response_model=CouponResponse, status_code=201)
def create_coupon(
    body: CouponCreateRequest,
    user: User = Depends(get_current_regular_user),
    db: Session = Depends(get_db),
):
    """Canjea puntos por un cupón.

    Los puntos se debitan acá, no al consumirlo, y no se reintegran si el cupón
    vence: la UI tiene que confirmarlo explícitamente antes de llamar.
    """
    try:
        coupon = CouponService.generate(db, user.id, body.client_id, body.reward_id)
    except CouponError as e:
        _raise(e)

    return _coupon_to_response(coupon)


# --- Comercio ---

@router.get("/validate/{code}", response_model=CouponValidationResponse)
def validate_coupon(
    code: str,
    merchant: Merchant = Depends(get_approved_merchant),
    db: Session = Depends(get_db),
):
    """Verifica un cupón sin consumirlo."""
    try:
        coupon = CouponService.validate(db, code, merchant)
    except CouponError as e:
        _raise(e)

    return CouponValidationResponse(
        code=coupon.code,
        valid=True,
        discount_pct=float(coupon.discount_pct),
        expires_at=coupon.expires_at,
        reward_name=coupon.reward.name if coupon.reward else None,
    )


@router.post("/{code}/redeem", response_model=CouponRedeemResponse)
def redeem_coupon(
    code: str,
    merchant: Merchant = Depends(get_approved_merchant),
    db: Session = Depends(get_db),
):
    """Consume el cupón y lo deja marcado como usado."""
    try:
        coupon = CouponService.redeem(db, code, merchant)
    except CouponError as e:
        _raise(e)

    return CouponRedeemResponse(
        code=coupon.code,
        discount_pct=float(coupon.discount_pct),
        redeemed_at=coupon.redeemed_at,
        reward_name=coupon.reward.name if coupon.reward else None,
    )
