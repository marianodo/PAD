from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, func, Numeric, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
import uuid

from app.db.base import Base


class UserPoints(Base):
    __tablename__ = "user_points"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, unique=True)
    total_points = Column(Integer, default=0)
    available_points = Column(Integer, default=0)  # Puntos disponibles para canjear
    redeemed_points = Column(Integer, default=0)   # Puntos ya canjeados
    updated_at = Column(DateTime(timezone=True), onupdate=func.now(), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="points")


class PointTransaction(Base):
    __tablename__ = "point_transactions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=False)
    transaction_type = Column(String(50), nullable=False)  # earned, redeemed, expired
    amount = Column(Integer, nullable=False)
    description = Column(Text)
    related_response_id = Column(UUID(as_uuid=True), ForeignKey("survey_responses.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user = relationship("User", back_populates="point_transactions")
