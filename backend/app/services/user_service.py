from sqlalchemy.orm import Session
from typing import Optional
from uuid import UUID

from app.models.user import User
from app.models.points import UserPoints, PointTransaction
from app.models.response import SurveyResponse
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

        # Crear registro de puntos en la entidad principal del ciudadano. Los
        # saldos son por entidad; si más adelante participa en otra, ese saldo se
        # crea solo al ganar los primeros puntos ahí.
        user_points = UserPoints(user_id=user.id, client_id=user.client_id)
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
    def get_user_points(
        db: Session,
        user_id: UUID,
        client_id: Optional[UUID] = None,
    ) -> Optional[UserPoints]:
        """Obtiene los puntos de un usuario.

        Con client_id devuelve el saldo de esa entidad. Sin client_id devuelve la
        suma de todas, para conservar la semántica de "puntos totales" que la API
        tenía antes de que los saldos fueran por entidad. El agregado es un objeto
        transitorio: no se agrega a la sesión ni se persiste.
        """
        if client_id is not None:
            return db.query(UserPoints).filter(
                UserPoints.user_id == user_id,
                UserPoints.client_id == client_id,
            ).first()

        rows = db.query(UserPoints).filter(UserPoints.user_id == user_id).all()
        if not rows:
            return None
        if len(rows) == 1:
            return rows[0]

        aggregate = UserPoints(
            user_id=user_id,
            client_id=None,
            total_points=sum(r.total_points or 0 for r in rows),
            available_points=sum(r.available_points or 0 for r in rows),
            redeemed_points=sum(r.redeemed_points or 0 for r in rows),
        )
        aggregate.updated_at = max(
            (r.updated_at for r in rows if r.updated_at is not None), default=None
        )
        return aggregate

    @staticmethod
    def delete_user(db: Session, user_id: UUID) -> None:
        """Elimina un usuario y todos sus datos relacionados"""
        user = UserService.get_by_id(db, user_id)
        if not user:
            raise ValueError("Usuario no encontrado")

        # Borrar transacciones de puntos (sin cascade en FK)
        db.query(PointTransaction).filter(PointTransaction.user_id == user_id).delete()

        # Borrar respuestas de encuestas (answers se eliminan en cascade por la relación)
        db.query(SurveyResponse).filter(SurveyResponse.user_id == user_id).delete()

        # Borrar el usuario (user_points se elimina en cascade por la FK)
        db.delete(user)
        db.commit()
