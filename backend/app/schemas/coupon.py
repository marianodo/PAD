from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from uuid import UUID


class CouponRewardResponse(BaseModel):
    """Un tier del catálogo de una entidad."""
    id: UUID
    client_id: UUID
    name: str
    points_cost: int
    discount_pct: float
    # Calculado contra el saldo del ciudadano en esta entidad.
    affordable: Optional[bool] = None

    class Config:
        from_attributes = True


class CouponBalanceResponse(BaseModel):
    """Saldo del ciudadano en una entidad, con su catálogo."""
    client_id: UUID
    client_name: str
    available_points: int
    total_points: int
    rewards: List[CouponRewardResponse] = []


class CouponCreateRequest(BaseModel):
    client_id: UUID = Field(..., description="Entidad de cuyos puntos sale el cupón")
    reward_id: UUID = Field(..., description="Tier del catálogo a canjear")


class CouponResponse(BaseModel):
    """Cupón emitido. `code` es lo que el ciudadano le muestra al comercio."""
    id: UUID
    code: str
    client_id: UUID
    reward_id: UUID
    discount_pct: float
    points_spent: int
    status: str
    created_at: Optional[datetime] = None
    expires_at: datetime
    redeemed_at: Optional[datetime] = None
    client_name: Optional[str] = None
    reward_name: Optional[str] = None
    # Solo se expone al dueño del cupón, en su propio historial.
    redeemed_by_merchant_name: Optional[str] = None

    class Config:
        from_attributes = True


class CouponValidationResponse(BaseModel):
    """Resultado de validar un cupón en el mostrador.

    No incluye datos del ciudadano: el comercio solo necesita saber si el cupón
    sirve y qué descuento aplicar.
    """
    code: str
    valid: bool
    discount_pct: float
    expires_at: datetime
    reward_name: Optional[str] = None


class CouponRedeemResponse(BaseModel):
    code: str
    discount_pct: float
    redeemed_at: datetime
    reward_name: Optional[str] = None
