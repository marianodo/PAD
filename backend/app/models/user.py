from sqlalchemy import Column, String, Date, DateTime, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class User(Base):
    """Usuarios ciudadanos que responden encuestas"""
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cuil = Column(String(11), unique=True, nullable=False, index=True)  # CUIL sin guiones
    hashed_password = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    name = Column(String(255), nullable=False)

    # Información personal
    phone = Column(String(50))
    birth_date = Column(Date)

    # Dirección residencial (para análisis demográfico)
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
