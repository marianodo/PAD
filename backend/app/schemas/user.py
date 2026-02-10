from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from datetime import date, datetime
from uuid import UUID


class UserBase(BaseModel):
    """Schema base para usuarios ciudadanos"""
    email: EmailStr
    name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None


class UserCreate(UserBase):
    """Schema para crear un usuario"""
    pass


class UserUpdate(BaseModel):
    """Schema para actualizar un usuario"""
    email: Optional[EmailStr] = None
    name: Optional[str] = None
    phone: Optional[str] = None
    birth_date: Optional[date] = None
    gender: Optional[str] = None
    address: Optional[str] = None
    neighborhood: Optional[str] = None
    city: Optional[str] = None
    postal_code: Optional[str] = None


class UserResponse(UserBase):
    """Schema de respuesta de usuario ciudadano"""
    id: UUID
    cuil: str
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class PasswordChange(BaseModel):
    """Schema para cambiar contraseña"""
    current_password: str
    new_password: str
