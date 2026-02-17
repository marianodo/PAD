from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from uuid import UUID

from typing import List

from app.db.base import get_db
from app.services.user_service import UserService
from app.schemas.user import UserCreate, UserResponse, UserUpdate, PasswordChange
from app.schemas.points import UserPointsResponse, PointTransactionResponse
from app.api.dependencies import get_current_user
from app.models.user import User
from app.models.points import PointTransaction
from app.core.security import verify_password, get_password_hash

router = APIRouter()


@router.post("/", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Crea un nuevo usuario"""
    try:
        user = UserService.create_user(db, user_data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: UUID, db: Session = Depends(get_db)):
    """Obtiene un usuario por ID"""
    user = UserService.get_by_id(db, user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.get("/email/{email}", response_model=UserResponse)
def get_user_by_email(email: str, db: Session = Depends(get_db)):
    """Obtiene un usuario por email"""
    user = UserService.get_by_email(db, email)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado")
    return user


@router.patch("/{user_id}", response_model=UserResponse)
def update_user(user_id: UUID, user_data: UserUpdate, db: Session = Depends(get_db)):
    """Actualiza un usuario"""
    try:
        user = UserService.update_user(db, user_id, user_data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/{user_id}/points", response_model=UserPointsResponse)
def get_user_points(user_id: UUID, db: Session = Depends(get_db)):
    """Obtiene los puntos de un usuario"""
    points = UserService.get_user_points(db, user_id)
    if not points:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Puntos no encontrados")
    return points


@router.get("/{user_id}/transactions", response_model=List[PointTransactionResponse])
def get_user_transactions(user_id: UUID, db: Session = Depends(get_db)):
    """Obtiene el historial de transacciones de puntos de un usuario."""
    transactions = db.query(PointTransaction).filter(
        PointTransaction.user_id == user_id
    ).order_by(PointTransaction.created_at.desc()).all()

    result = []
    for tx in transactions:
        data = PointTransactionResponse.model_validate(tx)
        if tx.related_response and tx.related_response.survey:
            data.survey_title = tx.related_response.survey.title
        result.append(data)
    return result


@router.put("/me", response_model=UserResponse)
def update_current_user(
    user_data: UserUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Actualiza el usuario actual"""
    try:
        user = UserService.update_user(db, current_user.id, user_data)
        return user
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.put("/change-password")
def change_password(
    password_data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Cambia la contraseña del usuario actual"""
    # Verify current password
    if not verify_password(password_data.current_password, current_user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Contraseña actual incorrecta"
        )

    # Validate new password length
    if len(password_data.new_password) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La nueva contraseña debe tener al menos 6 caracteres"
        )

    # Update password
    current_user.hashed_password = get_password_hash(password_data.new_password)
    db.commit()

    return {"message": "Contraseña actualizada exitosamente"}
