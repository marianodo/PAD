from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import date


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[str] = None


class LoginRequest(BaseModel):
    cuil: str = Field(..., description="CUIL sin guiones o email")
    password: str = Field(..., min_length=6, max_length=72)


class RegisterRequest(BaseModel):
    """Schema para registro de usuarios ciudadanos"""
    cuil: str = Field(..., min_length=11, max_length=11, description="CUIL sin guiones")
    password: str = Field(..., min_length=6, max_length=72)
    email: str = Field(..., description="Email del usuario")
    name: str = Field(..., min_length=1, description="Nombre completo")
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None

    @field_validator('cuil')
    def validate_cuil(cls, v: str) -> str:
        """Validate CUIL format (only numbers)."""
        if not v.isdigit():
            raise ValueError('CUIL debe contener solo números')
        if len(v) != 11:
            raise ValueError('CUIL debe tener 11 dígitos')
        return v
