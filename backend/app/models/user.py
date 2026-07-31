from sqlalchemy import Column, String, Date, DateTime, Boolean, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class User(Base):
    """Usuarios ciudadanos que responden encuestas"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cuil = Column(String(11), unique=True, nullable=False, index=True)  # CUIL sin guiones
    dni = Column(String(9), nullable=True, index=True)  # DNI derivado del CUIL, para match con el padrón
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)

    # Vinculación con municipio (nullable hasta que se confirme en padrón)
    client_id = Column(UUID(as_uuid=True), ForeignKey("clients.id"), nullable=True)

    # Información personal
    phone = Column(String(50))
    birth_date = Column(Date)
    gender = Column(String(20))

    # Dirección residencial (para análisis demográfico)
    address = Column(String)
    neighborhood = Column(String(255))
    city = Column(String(255))
    postal_code = Column(String(20))

    # Estado de la cuenta — si es False, no puede loguearse ni responder consultas
    is_active = Column(Boolean, nullable=False, server_default="true", default=True)

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    client = relationship("Client", back_populates="users")
    client_memberships = relationship("UserClient", back_populates="user", cascade="all, delete-orphan")
    responses = relationship("SurveyResponse", back_populates="user")
    # Un saldo por entidad en la que el ciudadano participa, no uno solo.
    points = relationship("UserPoints", back_populates="user")
    point_transactions = relationship("PointTransaction", back_populates="user")
