"""User service - Business logic for user management"""
from typing import Optional
from sqlalchemy.orm import Session

from ..models import User
from ..core.security import get_password_hash, verify_password, is_supported_password_hash


class UserService:
    """Service for user-related operations"""
    
    @staticmethod
    def create_user(
        db: Session,
        email: str,
        full_name: str,
        password: str,
        role: str = "user",
        group_id: Optional[int] = None
    ) -> User:
        """Create a new user"""
        user = User(
            email=email,
            full_name=full_name,
            hashed_password=get_password_hash(password),
            role=role,
            status="active",
            group_id=group_id
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def get_user(db: Session, user_id: int) -> Optional[User]:
        """Get a user by ID"""
        return db.query(User).filter(User.id == user_id).first()
    
    @staticmethod
    def get_user_by_email(db: Session, email: str) -> Optional[User]:
        """Get a user by email"""
        return db.query(User).filter(User.email == email).first()
    
    @staticmethod
    def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
        """Authenticate a user"""
        user = UserService.get_user_by_email(db, email)
        if not user:
            return None
        
        if not is_supported_password_hash(user.hashed_password):
            return None
        
        if not verify_password(password, user.hashed_password):
            return None
        
        if user.status != "active":
            return None
        
        return user
    
    @staticmethod
    def update_password(db: Session, user_id: int, new_password: str) -> bool:
        """Update user password"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        user.hashed_password = get_password_hash(new_password)
        db.commit()
        return True
    
    @staticmethod
    def update_user(db: Session, user_id: int, updates: dict) -> Optional[User]:
        """Update user information"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return None
        
        for key, value in updates.items():
            if key == "password":
                user.hashed_password = get_password_hash(value)
            elif hasattr(user, key):
                setattr(user, key, value)
        
        db.commit()
        db.refresh(user)
        return user
    
    @staticmethod
    def delete_user(db: Session, user_id: int) -> bool:
        """Delete a user"""
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            return False
        
        db.delete(user)
        db.commit()
        return True
    
    @staticmethod
    def list_users(db: Session) -> list[User]:
        """List all users"""
        return db.query(User).all()
    
    @staticmethod
    def count_active_users(db: Session) -> int:
        """Count active users"""
        return db.query(User).filter(User.status == "active").count()
