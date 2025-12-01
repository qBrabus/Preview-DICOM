"""Audit trail service"""
from datetime import datetime
from sqlalchemy.orm import Session

from ..models import AuditLog


class AuditService:
    """Service for logging user actions"""
    
    @staticmethod
    def log_action(
        db: Session,
        user_id: int,
        action: str,
        resource_type: str = None,
        resource_id: str = None
    ) -> AuditLog:
        """Log a user action to the audit trail"""
        audit = AuditLog(
            user_id=user_id,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            timestamp=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        db.refresh(audit)
        return audit
    
    @staticmethod
    def get_user_actions(
        db: Session,
        user_id: int,
        limit: int = 100
    ) -> list[AuditLog]:
        """Get recent actions for a user"""
        return db.query(AuditLog).filter(
            AuditLog.user_id == user_id
        ).order_by(
            AuditLog.timestamp.desc()
        ).limit(limit).all()
    
    @staticmethod
    def get_resource_history(
        db: Session,
        resource_type: str,
        resource_id: str,
        limit: int = 100
    ) -> list[AuditLog]:
        """Get audit history for a specific resource"""
        return db.query(AuditLog).filter(
            AuditLog.resource_type == resource_type,
            AuditLog.resource_id == resource_id
        ).order_by(
            AuditLog.timestamp.desc()
        ).limit(limit).all()
