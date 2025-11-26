import hashlib
import json
import os
import time
from typing import List

import requests
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from . import models, schemas
from .database import Base, engine, get_db, SessionLocal

ORTHANC_URL = os.getenv("ORTHANC_URL", "http://orthanc:8042")

app = FastAPI(title="Preview DICOM Platform", version="0.1.0")

def wait_for_db(max_attempts: int = 10, delay_seconds: int = 2) -> None:
    """Wait for the database to accept connections before continuing startup."""

    for attempt in range(1, max_attempts + 1):
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            return
        except OperationalError:
            if attempt == max_attempts:
                raise
            time.sleep(delay_seconds)


# Initialize database tables and seed minimal data
wait_for_db()
Base.metadata.create_all(bind=engine)


def seed_initial_data():
    """
    Ensure the platform has a default administrator account and a test patient
    so the application never falls back to hard-coded demo data.
    """

    db = SessionLocal()
    try:
        admin_group = db.query(models.Group).filter(models.Group.name == "Administrateurs").first()
        if not admin_group:
            admin_group = models.Group(
                name="Administrateurs",
                description="Accès complet au système",
                can_edit_patients=True,
                can_export_data=True,
                can_manage_users=True,
                can_view_images=True,
            )
            db.add(admin_group)
            db.commit()
            db.refresh(admin_group)

        admin_user = db.query(models.User).filter(models.User.email == "admin@imagine.fr").first()
        if not admin_user:
            hashed = hashlib.sha256("Admin123!".encode()).hexdigest()
            admin_user = models.User(
                email="admin@imagine.fr",
                full_name="Administrateur",
                hashed_password=hashed,
                role="admin",
                status="active",
                group_id=admin_group.id,
            )
            db.add(admin_user)

        test_patient = db.query(models.Patient).filter(models.Patient.external_id == "patient_test_poc").first()
        if not test_patient:
            test_patient = models.Patient(
                external_id="patient_test_poc",
                first_name="Patient",
                last_name="POC",
                condition="Suivi clinique",
                date_of_birth="2000-01-01",
                last_visit="2024-01-01",
                dicom_study_uid=None,
                orthanc_patient_id=None,
            )
            db.add(test_patient)

        db.commit()
    finally:
        db.close()


seed_initial_data()

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


@app.post("/auth/login", response_model=schemas.UserRead, tags=["auth"])
def login(credentials: schemas.LoginRequest, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user:
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    hashed = hashlib.sha256(credentials.password.encode()).hexdigest()
    if hashed != user.hashed_password:
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    return user


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
    existing = db.query(models.Patient).filter(models.Patient.external_id == patient.external_id).first()
    if existing:
        raise HTTPException(status_code=409, detail="Patient already exists")

    db_patient = models.Patient(**patient.dict())
    db.add(db_patient)
    db.commit()
    db.refresh(db_patient)
    return db_patient


def _normalize_patient_payload(raw_payload: dict) -> schemas.PatientCreate:
    """Accept both snake_case and camelCase payloads and ensure required fields are present."""

    payload = raw_payload.copy()

    # Accept exported fields (camelCase) as well as API snake_case
    if "external_id" not in payload and "id" in payload:
        payload["external_id"] = payload.get("id")
    if "first_name" not in payload and "firstName" in payload:
        payload["first_name"] = payload.get("firstName")
    if "last_name" not in payload and "lastName" in payload:
        payload["last_name"] = payload.get("lastName")
    if "date_of_birth" not in payload and "dob" in payload:
        payload["date_of_birth"] = payload.get("dob")
    if "last_visit" not in payload and "lastVisit" in payload:
        payload["last_visit"] = payload.get("lastVisit")
    if "dicom_study_uid" not in payload and "dicomStudyUid" in payload:
        payload["dicom_study_uid"] = payload.get("dicomStudyUid")
    if "orthanc_patient_id" not in payload and "orthancPatientId" in payload:
        payload["orthanc_patient_id"] = payload.get("orthancPatientId")

    missing = [
        field
        for field in ("external_id", "first_name", "last_name")
        if not payload.get(field)
    ]
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Champs manquants pour le patient: {', '.join(missing)}",
        )

    try:
        return schemas.PatientCreate(**payload)
    except Exception as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@app.post("/patients/import", response_model=schemas.PatientRead, tags=["patients"])
async def import_patient(
    patient: str = Form(...),
    dicom_files: List[UploadFile] = File(default_factory=list),
    db: Session = Depends(get_db),
):
    """Import a patient record and forward attached DICOM files to Orthanc."""

    try:
        payload = json.loads(patient)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid patient payload")

    patient_in = _normalize_patient_payload(payload)

    db_patient = (
        db.query(models.Patient)
        .filter(models.Patient.external_id == patient_in.external_id)
        .first()
    )

    if db_patient:
        for field, value in patient_in.dict().items():
            setattr(db_patient, field, value)
    else:
        db_patient = models.Patient(**patient_in.dict())
        db.add(db_patient)

    db.commit()
    db.refresh(db_patient)

    orthanc_patient_id = db_patient.orthanc_patient_id
    dicom_study_uid = db_patient.dicom_study_uid

    for dicom_file in dicom_files:
        content = await dicom_file.read()
        try:
            response = requests.post(
                f"{ORTHANC_URL}/instances",
                data=content,
                headers={"Content-Type": "application/dicom"},
                timeout=15,
            )
            response.raise_for_status()
            orthanc_response = response.json()
            orthanc_patient_id = orthanc_patient_id or orthanc_response.get("ParentPatient")
            dicom_study_uid = (
                dicom_study_uid
                or orthanc_response.get("ParentStudy")
                or orthanc_response.get("MainDicomTags", {}).get("StudyInstanceUID")
            )
        except requests.RequestException as exc:
            raise HTTPException(
                status_code=502,
                detail=f"Failed to push DICOM to Orthanc: {exc}",
            )

    if (
        orthanc_patient_id != db_patient.orthanc_patient_id
        or dicom_study_uid != db_patient.dicom_study_uid
    ):
        db_patient.orthanc_patient_id = orthanc_patient_id
        db_patient.dicom_study_uid = dicom_study_uid
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
