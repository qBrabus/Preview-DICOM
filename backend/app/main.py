import io
import json
import os
import time
import zipfile
from datetime import datetime
from typing import AsyncIterator, List

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from . import models, schemas
from .core import security
from .core.config import settings
from .database import Base, engine, get_db, SessionLocal
from .services.orthanc import OrthancClient, get_orthanc_client

ORTHANC_URL = settings.orthanc_url

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


def ensure_schema_upgrades():
    """Apply minimal, idempotent upgrades for existing databases."""

    with engine.begin() as connection:
        connection.execute(
            text(
                """
                ALTER TABLE patients
                ADD COLUMN IF NOT EXISTS status VARCHAR DEFAULT 'À interpréter'
                """
            )
        )
        connection.execute(
            text(
                """
                UPDATE patients
                SET status = COALESCE(status, 'À interpréter')
                """
            )
        )


ensure_schema_upgrades()


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
            hashed = security.get_password_hash("Admin123!")
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
                status="À interpréter",
            )
            db.add(test_patient)

        db.commit()
    finally:
        db.close()


seed_initial_data()

# CORS for local dev and Docker overlay
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", tags=["system"])
def health_check():
    return {"status": "ok"}


@app.post("/auth/login", response_model=schemas.AuthResponse, tags=["auth"])
def login(credentials: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not security.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    access_token = security.create_token({"sub": user.id}, settings.access_token_ttl)
    refresh_token = security.create_token({"sub": user.id, "type": "refresh"}, settings.refresh_token_ttl)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=int(settings.refresh_token_ttl.total_seconds()),
    )
    _ = user.group
    return {"access_token": access_token, "token_type": "bearer", "user": user}


@app.post("/auth/refresh", response_model=schemas.AuthResponse, tags=["auth"])
def refresh_token(response: Response, request: Request, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="Token manquant")

    payload = security.decode_token(refresh_token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Token invalide")

    user = db.query(models.User).get(payload.get("sub"))
    if not user:
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    access_token = security.create_token({"sub": user.id}, settings.access_token_ttl)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=True,
        samesite="lax",
        max_age=int(settings.refresh_token_ttl.total_seconds()),
    )
    _ = user.group
    return {"access_token": access_token, "token_type": "bearer", "user": user}


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


@app.get("/groups/{group_id}", response_model=schemas.GroupRead, tags=["groups"])
def get_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@app.put("/groups/{group_id}", response_model=schemas.GroupRead, tags=["groups"])
def update_group(
    group_id: int, group_update: schemas.GroupUpdate, db: Session = Depends(get_db)
):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    for field, value in group_update.dict(exclude_unset=True).items():
        setattr(group, field, value)

    db.commit()
    db.refresh(group)
    return group


@app.delete("/groups/{group_id}", status_code=204, tags=["groups"])
def delete_group(group_id: int, db: Session = Depends(get_db)):
    group = db.query(models.Group).filter(models.Group.id == group_id).first()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")

    # Detach users from the group to allow deletion
    db.query(models.User).filter(models.User.group_id == group.id).update(
        {models.User.group_id: None}
    )
    db.delete(group)
    db.commit()


@app.post("/users", response_model=schemas.UserRead, tags=["users"])
def create_user(user: schemas.UserCreate, db: Session = Depends(get_db)):
    hashed = security.get_password_hash(user.password)
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


@app.get("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def get_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.put("/users/{user_id}", response_model=schemas.UserRead, tags=["users"])
def update_user(
    user_id: int, user_update: schemas.UserUpdate, db: Session = Depends(get_db)
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.dict(exclude_unset=True)
    if "password" in update_data:
        update_data["hashed_password"] = hashlib.sha256(
            update_data.pop("password").encode()
        ).hexdigest()

    for field, value in update_data.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return user


@app.delete("/users/{user_id}", status_code=204, tags=["users"])
def delete_user(user_id: int, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()


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


async def _chunk_reader(upload: UploadFile, chunk_size: int = 1024 * 1024) -> AsyncIterator[bytes]:
    while True:
        chunk = await upload.read(chunk_size)
        if not chunk:
            break
        yield chunk


@app.post("/patients/import", response_model=schemas.PatientRead, tags=["patients"])
async def import_patient(
    patient: str = Form(...),
    dicom_files: List[UploadFile] = File(default_factory=list),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
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
        try:
            orthanc_response = await orthanc.upload_stream(_chunk_reader(dicom_file))
            orthanc_patient_id = orthanc_patient_id or orthanc_response.get("ParentPatient")
            dicom_study_uid = (
                dicom_study_uid
                or orthanc_response.get("ParentStudy")
                or orthanc_response.get("MainDicomTags", {}).get("StudyInstanceUID")
            )
        except HTTPException as exc:
            raise exc

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


@app.delete("/patients/{patient_id}", status_code=204, tags=["patients"])
async def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.orthanc_patient_id:
        try:
            await orthanc.delete_patient(patient.orthanc_patient_id)
        except HTTPException:
            pass

    db.delete(patient)
    db.commit()


@app.get(
    "/patients/{patient_id}/images",
    response_model=List[schemas.DicomImage],
    tags=["patients"],
)
async def list_patient_images(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.orthanc_patient_id:
        return []

    try:
        instance_ids = await orthanc.list_instances(patient.orthanc_patient_id)
    except HTTPException:
        return []

    images: List[schemas.DicomImage] = []
    for instance_id in instance_ids:
        try:
            meta = await orthanc.instance_metadata(instance_id)
            tags = meta.get("MainDicomTags", {})
        except HTTPException:
            continue

        images.append(
            schemas.DicomImage(
                id=instance_id,
                url=f"/api/dicom/instances/{instance_id}",
                description=tags.get("SeriesDescription")
                or tags.get("StudyDescription")
                or "Image DICOM",
                date=tags.get("InstanceCreationDate")
                or tags.get("StudyDate"),
            )
        )

    return images


@app.get("/patients/{patient_id}/export")
async def export_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.orthanc_patient_id:
        raise HTTPException(status_code=404, detail="Aucun DICOM disponible pour ce patient")

    try:
        instance_ids = await orthanc.list_instances(patient.orthanc_patient_id)
    except HTTPException:
        raise HTTPException(status_code=502, detail="Impossible de récupérer les instances DICOM")

    folder_name = f"Patient-{patient.external_id or patient.id}"
    export_buffer = io.BytesIO()

    with zipfile.ZipFile(export_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        json_payload = {
            "id": patient.external_id or patient.id,
            "firstName": patient.first_name,
            "lastName": patient.last_name,
            "dob": patient.date_of_birth,
            "condition": patient.condition,
            "lastVisit": patient.last_visit,
            "dicomStudyUid": patient.dicom_study_uid,
            "orthancPatientId": patient.orthanc_patient_id,
        }
        zip_file.writestr(f"{folder_name}/{folder_name}.json", json.dumps(json_payload, indent=2))

        for idx, instance_id in enumerate(instance_ids, start=1):
            try:
                tags = (await orthanc.instance_metadata(instance_id)).get("MainDicomTags", {})
                dicom_content = await orthanc.stream_instance(instance_id)
            except HTTPException:
                continue

            series = tags.get("SeriesNumber") or 1
            instance_number = tags.get("InstanceNumber") or idx
            file_name = f"{series}-{int(instance_number):02d}.dcm"
            zip_file.writestr(f"{folder_name}/{file_name}", dicom_content)

    export_buffer.seek(0)
    headers = {
        "Content-Disposition": f"attachment; filename={folder_name}.zip"
    }
    return Response(content=export_buffer.getvalue(), media_type="application/zip", headers=headers)


@app.get("/dicom/instances/{instance_id}")
async def proxy_dicom_file(
    instance_id: str, orthanc: OrthancClient = Depends(get_orthanc_client)
):
    content = await orthanc.stream_instance(instance_id)
    return Response(content=content, media_type="application/dicom")
