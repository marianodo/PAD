from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from uuid import UUID


class UserPointsResponse(BaseModel):
    """Schema de respuesta para puntos de usuario"""
    id: UUID
    user_id: UUID
    total_points: int
    available_points: int
    redeemed_points: int
    updated_at: datetime

    class Config:
        from_attributes = True


class PointTransactionResponse(BaseModel):
    """Schema de respuesta para transacción de puntos"""
    id: UUID
    user_id: UUID
    transaction_type: str
    amount: int
    description: Optional[str] = None
    related_response_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True
