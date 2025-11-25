import hashlib
from typing import List

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from . import models, schemas
from .database import Base, engine, get_db

app = FastAPI(title="Preview DICOM Platform", version="0.1.0")

# Initialize database tables
Base.metadata.create_all(bind=engine)

# CORS for local dev and Docker overlay
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/groups", response_model=schemas.GroupRead, tags=["groups"])
def create_group(group: schemas.GroupCreate, db: Session = Depends(get_db)):
    db_group = models.Group(**group.dict())
    db.add(db_group)
    db.commit()
    db.refresh(db_group)
    return db_group


@app.get("/groups", response_model=List[schemas.GroupRead], tags=["groups"])
def list_groups(db: Session = Depends(get_db)):
    return db.query(models.Group).all()


@app.post("/users", response_model=schemas.UserRead, tags=["users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed = hashlib.sha256(user.password.encode()).hexdigest()
    db_user = models.User(
        email=user.email,
        full_name=user.full_name,
        hashed_password=hashed,
        role=user.role,
        status=user.status,
        expiration_date=user.expiration_date,
        group_id=user.group_id,
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@app.get("/users", response_model=List[schemas.UserRead], tags=["users"])
def list_users(db: Session = Depends(get_db)):
    return db.query(models.User).all()


@app.post("/patients", response_model=schemas.PatientRead, tags=["patients"])
def create_patient(patient: schemas.PatientCreate, db: Session = Depends(get_db)):
    db_patient = models.Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


@app.get("/patients", response_model=List[schemas.PatientRead], tags=["patients"])
def list_patients(db: Session = Depends(get_db)):
    return db.query(models.Patient).all()


@app.get("/patients/{patient_id}", response_model=schemas.PatientRead, tags=["patients"])
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return patient
