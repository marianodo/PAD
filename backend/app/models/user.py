from sqlalchemy import Column, String, Date, DateTime, func, Enum
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid
import enum

from app.db.base import Base


class UserRole(str, enum.Enum):
    """Roles de usuario en el sistema"""
    ADMIN = "admin"  # Administrador - crea y gestiona encuestas
    CLIENT = "client"  # Cliente - visualiza dashboard y resultados
    USER = "user"  # Usuario - responde encuestas


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cuil = Column(String(11), unique=True, nullable=False, index=True)  # CUIL sin guiones
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)
    role = Column(Enum(UserRole, values_callable=lambda obj: [e.value for e in obj]), nullable=False, default=UserRole.USER, server_default="user")
    phone = Column(String(50))
    birth_date = Column(Date)
    address = Column(String)
    neighborhood = Column(String(255))
    city = Column(String(255))
    postal_code = Column(String(20))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    responses = relationship("SurveyResponse", back_populates="user")
    points = relationship("UserPoints", back_populates="user", uselist=False)
    point_transactions = relationship("PointTransaction", back_populates="user")
