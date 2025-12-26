from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.models.user import User
from app.models.points import UserPoints
from app.schemas.user import UserCreate, UserUpdate


class UserService:
    """Servicio para gestionar usuarios"""

    @staticmethod
    def get_by_email(db: Session, email: str) -> Optional[User]:
        """Obtiene un usuario por email"""
        return db.query(User).filter(User.email == email).first()

    @staticmethod
    def get_by_id(db: Session, user_id: UUID) -> Optional[User]:
        """Obtiene un usuario por ID"""
        return db.query(User).filter(User.id == user_id).first()

    @staticmethod
    def create_user(db: Session, user_data: UserCreate) -> User:
        """Crea un nuevo usuario"""
        # Verificar si el usuario ya existe
        existing_user = UserService.get_by_email(db, user_data.email)
        if existing_user:
            raise ValueError("El email ya está registrado")

        # Crear usuario
        user = User(**user_data.model_dump())
        db.add(user)
        db.commit()
        db.refresh(user)

        # Crear registro de puntos
        user_points = UserPoints(user_id=user.id)
        db.add(user_points)
        db.commit()

        return user

    @staticmethod
    def update_user(db: Session, user_id: UUID, user_data: UserUpdate) -> User:
        """Actualiza un usuario"""
        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ValueError("Usuario no encontrado")

        # Actualizar solo los campos proporcionados
        update_data = user_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(user, field, value)

        db.commit()
        db.refresh(user)
        return user

    @staticmethod
    def get_user_points(db: Session, user_id: UUID) -> Optional[UserPoints]:
        """Obtiene los puntos de un usuario"""
        return db.query(UserPoints).filter(UserPoints.user_id == user_id).first()
