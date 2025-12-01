"""User management routes"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..core.exceptions import NotFoundError, ValidationError, AuthorizationError, AuthenticationError
from ..services import UserService, AuditService
from ..models import User

router = APIRouter(prefix="/users", tags=["users"])


def check_admin(current_user: User = Depends(get_current_user)):
    """Require admin role"""
    if current_user.role != "admin":
        raise AuthorizationError("Action réservée aux administrateurs")
    return current_user


@router.post("", response_model=schemas.UserRead, status_code=201)
async def create_user(
    user: schemas.UserCreate,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Create a new user (admin only)"""
    # Check if email already exists
    existing = UserService.get_user_by_email(db, user.email)
    if existing:
        raise ValidationError(f"Email '{user.email}' déjà utilisé", "DUPLICATE_EMAIL")
    
    new_user = UserService.create_user(
        db,
        email=user.email,
        full_name=user.full_name,
        password=user.password,
        role=user.role,
        group_id=user.group_id
    )
    
    AuditService.log_action(db, current_user.id, "CREATE", "user", str(new_user.id))
    return schemas.UserRead.model_validate(new_user)


@router.get("", response_model=List[schemas.UserRead])
async def list_users(
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """List all users (admin only)"""
    users = UserService.list_users(db)
    return [schemas.UserRead.model_validate(u) for u in users]


@router.get("/{user_id}", response_model=schemas.UserRead)
async def get_user(
    user_id: int,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Get a specific user (admin only)"""
    user = UserService.get_user(db, user_id)
    if not user:
        raise NotFoundError(f"Utilisateur {user_id} non trouvé", "USER_NOT_FOUND")
    
    return schemas.UserRead.model_validate(user)


@router.put("/{user_id}", response_model=schemas.UserRead)
async def update_user(
    user_id: int,
    user_update: schemas.UserUpdate,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Update a user (admin only)"""
    updated = UserService.update_user(
        db,
        user_id,
        user_update.model_dump(exclude_unset=True)
    )
    
    if not updated:
        raise NotFoundError(f"Utilisateur {user_id} non trouvé", "USER_NOT_FOUND")
    
    AuditService.log_action(db, current_user.id, "UPDATE", "user", str(user_id))
    return schemas.UserRead.model_validate(updated)


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Delete a user (admin only)"""
    if user_id == current_user.id:
        raise ValidationError("Impossible de supprimer votre propre compte", "CANNOT_DELETE_SELF")
    
    # Delete associated records first to avoid foreign key constraint violations
    from ..models import AuditLog, UserSession, RevokedToken
    
    # Delete audit logs
    db.query(AuditLog).filter(AuditLog.user_id == user_id).delete()
    
    # Delete user sessions
    db.query(UserSession).filter(UserSession.user_id == user_id).delete()
    
    # Delete revoked tokens
    db.query(RevokedToken).filter(RevokedToken.user_id == user_id).delete()
    
    db.commit()
    
    success = UserService.delete_user(db, user_id)
    if not success:
        raise NotFoundError(f"Utilisateur {user_id} non trouvé", "USER_NOT_FOUND")
    
    AuditService.log_action(db, current_user.id, "DELETE", "user", str(user_id))
    return {"message": "Utilisateur supprimé"}




@router.put("/me/profile", response_model=schemas.UserRead)
async def update_own_profile(
    profile_update: schemas.UserProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update current user's own profile"""
    # Verify current password
    from ..core.security import verify_password
    if not verify_password(profile_update.current_password, current_user.hashed_password):
        raise AuthenticationError("Mot de passe actuel incorrect", "INVALID_PASSWORD")
    
    # Build update dict
    update_data = {}
    if profile_update.full_name is not None:
        update_data["full_name"] = profile_update.full_name
    if profile_update.email is not None:
        # Check if email is already taken by another user
        existing = UserService.get_user_by_email(db, profile_update.email)
        if existing and existing.id != current_user.id:
            raise ValidationError(f"Email '{profile_update.email}' déjà utilisé", "DUPLICATE_EMAIL")
        update_data["email"] = profile_update.email
    if profile_update.new_password is not None:
        update_data["password"] = profile_update.new_password
    
    # Update user
    updated = UserService.update_user(db, current_user.id, update_data)
    if not updated:
        raise NotFoundError("Utilisateur non trouvé", "USER_NOT_FOUND")
    
    AuditService.log_action(db, current_user.id, "UPDATE", "user", str(current_user.id))
    return schemas.UserRead.model_validate(updated)

