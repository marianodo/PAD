from pydantic import BaseModel, Field, field_validator
from typing import Optional
from datetime import datetime
from uuid import UUID


class MerchantRegisterRequest(BaseModel):
    """Alta de un comercio. Queda pendiente de habilitación manual."""
    client_id: UUID = Field(..., description="Entidad a la que se adhiere")
    email: str = Field(..., description="Email del comercio")
    password: str = Field(..., min_length=8, max_length=72)
    name: str = Field(..., min_length=1, description="Nombre del comercio")
    cuit: Optional[str] = Field(None, description="CUIT sin guiones")
    address: Optional[str] = None
    phone: Optional[str] = None

    @field_validator('cuit')
    def validate_cuit(cls, v: Optional[str]) -> Optional[str]:
        if v is None or v == "":
            return None
        if not v.isdigit():
            raise ValueError('CUIT debe contener solo números')
        if len(v) != 11:
            raise ValueError('CUIT debe tener 11 dígitos')
        return v


class MerchantLoginRequest(BaseModel):
    email: str
    password: str = Field(..., min_length=6, max_length=72)


class MerchantResponse(BaseModel):
    """Datos del comercio. `status` es lo que la UI usa para decidir si puede
    mostrar el validador o el aviso de cuenta en revisión."""
    id: UUID
    client_id: UUID
    email: str
    name: str
    cuit: Optional[str] = None
    address: Optional[str] = None
    phone: Optional[str] = None
    status: str
    client_name: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True
