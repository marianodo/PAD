from sqlalchemy import Column, String, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class Client(Base):
    __tablename__ = "clients"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String(255), nullable=False)

    # Datos de la organización/municipalidad
    name = Column(String(255), nullable=False)  # Nombre de la organización
    cuit = Column(String(11), unique=True, nullable=True, index=True)  # CUIT sin guiones

    # Información de contacto
    phone = Column(String(50))
    contact_person = Column(String(255))  # Persona de contacto
    contact_position = Column(String(255))  # Cargo de la persona de contacto

    # Dirección institucional
    address = Column(String)
    city = Column(String(255))
    postal_code = Column(String(20))

    # Información adicional
    website = Column(String(255))
    description = Column(String)  # Descripción de la organización

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    surveys = relationship("Survey", back_populates="client")
