"""Group management routes"""
from typing import List

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..core.exceptions import NotFoundError, ValidationError
from ..services import AuditService
from ..models import User, Group

router = APIRouter(prefix="/groups", tags=["groups"])


def check_admin(current_user: User = Depends(get_current_user)):
    """Require admin role"""
    from ..core.exceptions import AuthorizationError
    if current_user.role != "admin":
        raise AuthorizationError("Action réservée aux administrateurs")
    return current_user


@router.post("", response_model=schemas.GroupRead, status_code=201)
async def create_group(
    group: schemas.GroupCreate,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Create a new group (admin only)"""
    # Check if name already exists
    existing = db.query(Group).filter(Group.name == group.name).first()
    if existing:
        raise ValidationError(f"Groupe '{group.name}' existe déjà", "DUPLICATE_NAME")
    
    db_group = Group(**group.model_dump())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    
    AuditService.log_action(db, current_user.id, "CREATE", "group", str(db_group.id))
    return schemas.GroupRead.model_validate(db_group)


@router.get("", response_model=List[schemas.GroupRead])
async def list_groups(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all groups"""
    groups = db.query(Group).all()
    return [schemas.GroupRead.model_validate(g) for g in groups]


@router.get("/{group_id}", response_model=schemas.GroupRead)
async def get_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific group"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise NotFoundError(f"Groupe {group_id} non trouvé", "GROUP_NOT_FOUND")
    
    return schemas.GroupRead.model_validate(group)


@router.put("/{group_id}", response_model=schemas.GroupRead)
async def update_group(
    group_id: int,
    group_update: schemas.GroupUpdate,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Update a group (admin only)"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise NotFoundError(f"Groupe {group_id} non trouvé", "GROUP_NOT_FOUND")
    
    # Update fields
    for key, value in group_update.model_dump(exclude_unset=True).items():
        setattr(group, key, value)
    
    db.commit()
    db.refresh(group)
    
    AuditService.log_action(db, current_user.id, "UPDATE", "group", str(group_id))
    return schemas.GroupRead.model_validate(group)


@router.delete("/{group_id}")
async def delete_group(
    group_id: int,
    current_user: User = Depends(check_admin),
    db: Session = Depends(get_db)
):
    """Delete a group (admin only)"""
    group = db.query(Group).filter(Group.id == group_id).first()
    if not group:
        raise NotFoundError(f"Groupe {group_id} non trouvé", "GROUP_NOT_FOUND")
    
    # Check if group has users
    if group.users:
        raise ValidationError(
            f"Impossible de supprimer le groupe: {len(group.users)} utilisateur(s) associé(s)",
            "GROUP_HAS_USERS"
        )
    
    db.delete(group)
    db.commit()
    
    AuditService.log_action(db, current_user.id, "DELETE", "group", str(group_id))
    return {"message": "Groupe supprimé"}
