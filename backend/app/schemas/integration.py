from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID


class PointsQueryResponse(BaseModel):
    """Respuesta de consulta de puntos para integración"""
    cuil: str
    total_points: int
    available_points: int
    redeemed_points: int


class PointsRedeemRequest(BaseModel):
    """Request para canjear puntos desde el proveedor de pagos"""
    cuil: str = Field(..., min_length=11, max_length=11, pattern=r"^\d{11}$")
    points: int = Field(..., gt=0)
    reference_id: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=500)


class PointsRedeemResponse(BaseModel):
    """Respuesta de canjeo de puntos"""
    cuil: str
    points_redeemed: int
    available_points: int
    transaction_id: UUID
    reference_id: str
    already_processed: bool
