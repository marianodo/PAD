from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserPointsResponse(BaseModel):
    """Schema de respuesta para puntos de usuario.

    id/client_id/updated_at son opcionales porque la consulta sin entidad
    devuelve la suma de todos los saldos, que no corresponde a ninguna fila.
    """
    id: Optional[UUID] = None
    user_id: UUID
    client_id: Optional[UUID] = None
    total_points: int
    available_points: int
    redeemed_points: int
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PointTransactionResponse(BaseModel):
    """Schema de respuesta para transacción de puntos"""
    id: UUID
    user_id: UUID
    client_id: Optional[UUID] = None
    transaction_type: str
    amount: int
    description: Optional[str] = None
    related_response_id: Optional[UUID] = None
    survey_title: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
