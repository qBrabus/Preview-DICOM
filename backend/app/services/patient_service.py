"""Patient service - Business logic for patient management"""
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import or_

from ..models import Patient
from .. import schemas


class PatientService:
    """Service for patient-related operations"""
    
    @staticmethod
    def create_patient(db: Session, patient: schemas.PatientCreate) -> Patient:
        """Create a new patient"""
        db_patient = Patient(**patient.dict())
        db.add(db_patient)
        db.commit()
        db.refresh(db_patient)
        return db_patient
    
    @staticmethod
    def get_patient(db: Session, patient_id: int) -> Optional[Patient]:
        """Get a patient by ID"""
        return db.query(Patient).filter(Patient.id == patient_id).first()
    
    @staticmethod
    def get_patient_by_external_id(db: Session, external_id: str) -> Optional[Patient]:
        """Get a patient by external ID"""
        return db.query(Patient).filter(Patient.external_id == external_id).first()
    
    @staticmethod
    def list_patients(
        db: Session,
        skip: int = 0,
        limit: int = 100
    ) -> list[Patient]:
        """List all patients with pagination"""
        return db.query(Patient).offset(skip).limit(limit).all()
    
    @staticmethod
    def search_patients(
        db: Session,
        query: Optional[str] = None,
        condition: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> list[Patient]:
        """Search patients by name, ID, or condition"""
        db_query = db.query(Patient)
        
        if query:
            search_pattern = f"%{query}%"
            db_query = db_query.filter(
                or_(
                    Patient.first_name.ilike(search_pattern),
                    Patient.last_name.ilike(search_pattern),
                    Patient.external_id.ilike(search_pattern)
                )
            )
        
        if condition:
            db_query = db_query.filter(Patient.condition.ilike(f"%{condition}%"))
        
        return db_query.offset(skip).limit(limit).all()
    
    @staticmethod
    def update_patient(
        db: Session,
        patient_id: int,
        updates: dict
    ) -> Optional[Patient]:
        """Update a patient"""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return None
        
        for key, value in updates.items():
            if hasattr(patient, key):
                setattr(patient, key, value)
        
        db.commit()
        db.refresh(patient)
        return patient
    
    @staticmethod
    def delete_patient(db: Session, patient_id: int) -> bool:
        """Delete a patient"""
        patient = db.query(Patient).filter(Patient.id == patient_id).first()
        if not patient:
            return False
        
        db.delete(patient)
        db.commit()
        return True
    
    @staticmethod
    def count_patients(db: Session) -> int:
        """Count total patients"""
        return db.query(Patient).count()
