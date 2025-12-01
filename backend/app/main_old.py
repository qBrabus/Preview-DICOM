import io
import json
import os
import time
import zipfile
from datetime import datetime
from typing import Iterator, List

from fastapi import Depends, FastAPI, File, Form, HTTPException, Request, Response, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from . import models, schemas
from .core import security
from .core.config import settings
from .database import Base, engine, get_db, SessionLocal
from .dependencies import enforce_csrf
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
        elif not security.is_supported_password_hash(admin_user.hashed_password):
            admin_user.hashed_password = security.get_password_hash("Admin123!")

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


@app.get("/stats", tags=["system"])
def get_stats(db: Session = Depends(get_db)):
    """Return system statistics for the dashboard."""
    orthanc = OrthancClient()
    
    # Count total patients
    total_patients = db.query(models.Patient).count()
    
    # Count total DICOM instances across all patients with orthanc_patient_id
    total_instances = 0
    patients_with_images = db.query(models.Patient).filter(
        models.Patient.orthanc_patient_id.isnot(None)
    ).all()
    
    for patient in patients_with_images:
        try:
            instances = orthanc.list_instances(patient.orthanc_patient_id)
            total_instances += len(instances)
        except HTTPException:
            # Patient has no instances in Orthanc
            continue
    
    return {
        "total_patients": total_patients,
        "total_instances": total_instances
    }



@app.post("/auth/login", response_model=schemas.AuthResponse, tags=["auth"])
def login(credentials: schemas.LoginRequest, response: Response, db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == credentials.email).first()
    if not user or not security.verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    access_token = security.create_token({"sub": str(user.id)}, settings.access_token_ttl)
    refresh_token = security.create_token({"sub": str(user.id), "type": "refresh"}, settings.refresh_token_ttl)
    csrf_token = security.generate_csrf_token()
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        **settings.refresh_cookie_params,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        **settings.csrf_cookie_params,
    )
    _ = user.group
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "csrf_token": csrf_token,
    }


@app.post("/auth/refresh", response_model=schemas.AuthResponse, tags=["auth"])
def refresh_token(
    response: Response,
    request: Request,
    db: Session = Depends(get_db),
):
    refresh_token = request.cookies.get("refresh_token")
    print(f"!!! DEBUG: refresh_token cookie: {refresh_token}", flush=True)
    if not refresh_token:
        print("!!! DEBUG: Missing refresh token", flush=True)
        print(f"!!! DEBUG: Cookies received: {request.cookies}", flush=True)
        raise HTTPException(status_code=401, detail="Token manquant")

    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token")
    print(f"!!! DEBUG: CSRF cookie: {csrf_cookie}, header: {csrf_header}", flush=True)
    if csrf_cookie and csrf_header and csrf_cookie != csrf_header:
        print("DEBUG: CSRF mismatch", flush=True)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Requête interdite: CSRF token invalide",
        )

    try:
        payload = security.decode_token(refresh_token)
    except Exception as e:
        print(f"DEBUG: Token decode error: {e}", flush=True)
        raise HTTPException(status_code=401, detail="Token invalide")
        
    if payload.get("type") != "refresh":
        print("DEBUG: Wrong token type", flush=True)
        raise HTTPException(status_code=401, detail="Token invalide")

    user_id = int(payload.get("sub"))
    user = db.query(models.User).get(user_id)
    if not user:
        print("DEBUG: User not found", flush=True)
        raise HTTPException(status_code=401, detail="Utilisateur introuvable")

    access_token = security.create_token({"sub": str(user.id)}, settings.access_token_ttl)
    csrf_token = csrf_cookie or security.generate_csrf_token()
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        **settings.refresh_cookie_params,
    )
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        **settings.csrf_cookie_params,
    )
    _ = user.group
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": user,
        "csrf_token": csrf_token,
    }


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
        update_data["hashed_password"] = security.get_password_hash(
            update_data.pop("password")
        )

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


def _iter_file(upload: UploadFile, chunk_size: int = 1024 * 1024) -> Iterator[bytes]:
    while True:
        chunk = upload.file.read(chunk_size)
        if not chunk:
            break
        yield chunk


@app.post("/patients/import", response_model=schemas.PatientRead, tags=["patients"])
def import_patient(
    patient: str = Form(...),
    dicom_files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    """Import a patient record and forward attached DICOM files to Orthanc."""
    print(f"Importing patient: {patient}", flush=True)

    try:
        payload = json.loads(patient)
        # Handle list of patients (take first) or single object
        if isinstance(payload, list):
            payload = payload[0]
            
        patient_data = schemas.PatientCreate(
            external_id=payload.get("id") or payload.get("external_id"),
            first_name=payload.get("firstName") or payload.get("first_name"),
            last_name=payload.get("lastName") or payload.get("last_name"),
            condition=payload.get("condition"),
            date_of_birth=payload.get("dob") or payload.get("date_of_birth"),
            last_visit=payload.get("lastVisit") or payload.get("last_visit"),
            dicom_study_uid="",
            orthanc_patient_id="",
        )
    except (json.JSONDecodeError, IndexError, AttributeError) as e:
        print(f"JSON Error: {e}", flush=True)
        raise HTTPException(status_code=400, detail="Invalid JSON format")

    # 1. Upload all files and collect their temporary Instance IDs
    uploaded_instance_ids = []
    for dicom_file in dicom_files:
        try:
            orthanc_response = orthanc.upload_stream(_iter_file(dicom_file))
            print(f"Orthanc upload response: {orthanc_response}", flush=True)
            if "ID" in orthanc_response:
                uploaded_instance_ids.append(orthanc_response["ID"])
        except Exception as e:
            print(f"Error uploading file: {e}", flush=True)
            continue

    # 2. Modify each instance to enforce the correct PatientID
    final_orthanc_patient_id = None
    
    if not patient_data.external_id:
        # Fallback if no external ID provided (should not happen with correct JSON)
        print("Warning: No external_id found, skipping modification", flush=True)
    else:
        print(f"Forcing PatientID to: {patient_data.external_id}", flush=True)
        for instance_id in uploaded_instance_ids:
            try:
                # Modify the instance to set the correct PatientID
                # This returns the raw DICOM bytes of the NEW instance
                modified_bytes = orthanc.modify_instance(
                    instance_id, 
                    {
                        "Replace": {"PatientID": patient_data.external_id}, 
                        "Force": True,
                        "KeepSource": True # We delete it manually anyway
                    }
                )
                
                # Upload the modified DICOM to get its new ID and ParentPatient
                reupload_response = orthanc.upload_stream(modified_bytes)
                print(f"Re-upload response: {reupload_response}", flush=True)
                
                if "ParentPatient" in reupload_response:
                    final_orthanc_patient_id = reupload_response["ParentPatient"]
                
                # Delete the old instance (the one with the wrong PatientID)
                orthanc.delete_instance(instance_id)
                
            except Exception as e:
                print(f"Error modifying instance {instance_id}: {e}", flush=True)

    # If we didn't get a final ID (e.g. no files or modification failed), try to find it or leave empty
    if not final_orthanc_patient_id and uploaded_instance_ids:
         # Fallback: use the parent of the last uploaded file (if modification was skipped)
         pass 

    # Update patient data
    if final_orthanc_patient_id:
        patient_data.orthanc_patient_id = final_orthanc_patient_id
        
    # Check if patient exists in DB
    db_patient = (
        db.query(models.Patient)
        .filter(models.Patient.external_id == patient_data.external_id)
        .first()
    )

    if db_patient:
        # Update existing
        for key, value in patient_data.dict().items():
            setattr(db_patient, key, value)
    else:
        # Create new
        db_patient = models.Patient(**patient_data.dict())
        db.add(db_patient)

    db.commit()
    db.refresh(db_patient)

    # Update image count
    if db_patient.orthanc_patient_id:
        try:
            instance_ids = orthanc.list_instances(db_patient.orthanc_patient_id)
            db_patient.image_count = len(instance_ids)
            db_patient.has_images = db_patient.image_count > 0
        except HTTPException:
            db_patient.has_images = False
            db_patient.image_count = 0
    else:
        db_patient.has_images = False
        db_patient.image_count = 0

    db.commit()
    return db_patient


@app.get("/patients", response_model=List[schemas.PatientRead], tags=["patients"])
def list_patients(db: Session = Depends(get_db), orthanc: OrthancClient = Depends(get_orthanc_client)):
    patients = db.query(models.Patient).all()
    for patient in patients:
        if patient.orthanc_patient_id:
            try:
                instance_ids = orthanc.list_instances(patient.orthanc_patient_id)
                patient.image_count = len(instance_ids)
                patient.has_images = patient.image_count > 0
            except HTTPException:
                patient.has_images = False
                patient.image_count = 0
        else:
            patient.has_images = False
            patient.image_count = 0
    return patients


@app.get("/patients/{patient_id}", response_model=schemas.PatientRead, tags=["patients"])
def get_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.orthanc_patient_id:
        try:
            instance_ids = orthanc.list_instances(patient.orthanc_patient_id)
            patient.image_count = len(instance_ids)
            patient.has_images = patient.image_count > 0
        except HTTPException:
            patient.has_images = False
            patient.image_count = 0
    else:
        patient.has_images = False
        patient.image_count = 0
    return patient


@app.delete("/patients/{patient_id}", status_code=204, tags=["patients"])
def delete_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if patient.orthanc_patient_id:
        try:
            orthanc.delete_patient(patient.orthanc_patient_id)
        except HTTPException:
            pass

    db.delete(patient)
    db.commit()


@app.get(
    "/patients/{patient_id}/images",
    response_model=List[schemas.DicomImage],
    tags=["patients"],
)
def list_patient_images(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if not patient.orthanc_patient_id:
        print(f"No Orthanc ID for patient {patient_id}", flush=True)
        return []

    try:
        print(f"Listing instances for Orthanc ID: {patient.orthanc_patient_id}", flush=True)
        # orthanc.list_instances returns a list of dictionaries with metadata
        instance_objs = orthanc.list_instances(patient.orthanc_patient_id)
        print(f"Found {len(instance_objs)} instances", flush=True)
    except HTTPException as e:
        print(f"Error listing instances: {e}", flush=True)
        return []

    images: List[schemas.DicomImage] = []
    for obj in instance_objs:
        try:
            instance_id = obj.get("ID")
            if not instance_id:
                continue
                
            tags = obj.get("MainDicomTags", {})
            
            images.append(
                schemas.DicomImage(
                    id=instance_id,
                    url=f"/api/dicom/instances/{instance_id}",
                    description=tags.get("SeriesDescription")
                    or tags.get("StudyDescription")
                    or "Image DICOM",
                    date=tags.get("InstanceCreationDate")
                )
            )
        except Exception as e:
            print(f"Error processing instance: {e}", flush=True)
            continue
            
    return images




def _add_patient_to_zip(zip_file: zipfile.ZipFile, patient: models.Patient, orthanc: OrthancClient):
    folder_name = f"Patient-{patient.external_id or patient.id}"
    
    # Add JSON
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

    # Add DICOMs
    if patient.orthanc_patient_id:
        try:
            # orthanc.list_instances returns a list of dicts: [{"ID": "...", "MainDicomTags": {...}}, ...]
            instance_objs = orthanc.list_instances(patient.orthanc_patient_id)
            
            for idx, instance_obj in enumerate(instance_objs, start=1):
                try:
                    instance_id = instance_obj.get("ID")
                    if not instance_id:
                        continue
                        
                    # Use tags from the listing if available, otherwise fetch them (though listing usually has them)
                    tags = instance_obj.get("MainDicomTags", {})
                    if not tags:
                         # Fallback if tags are missing in the listing
                         try:
                             tags = orthanc.instance_metadata(instance_id).get("MainDicomTags", {})
                         except:
                             pass

                    dicom_content = orthanc.stream_instance(instance_id)
                    
                    series = tags.get("SeriesNumber") or 1
                    instance_number = tags.get("InstanceNumber") or idx
                    file_name = f"{series}-{int(instance_number):02d}.dcm"
                    zip_file.writestr(f"{folder_name}/{file_name}", dicom_content)
                except Exception as e:
                    print(f"Error exporting instance {instance_obj.get('ID', 'unknown')}: {e}", flush=True)
                    continue
        except Exception as e:
            print(f"Error listing instances for patient {patient.id}: {e}", flush=True)


@app.get("/patients/{patient_id}/export")
def export_patient(
    patient_id: int,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patient = db.query(models.Patient).filter(models.Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    export_buffer = io.BytesIO()
    with zipfile.ZipFile(export_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        _add_patient_to_zip(zip_file, patient, orthanc)

    export_buffer.seek(0)
    filename = f"Patient-{patient.external_id or patient.id}.zip"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }
    return Response(content=export_buffer.getvalue(), media_type="application/zip", headers=headers)


@app.post("/patients/export")
def bulk_export_patients(
    request: schemas.PatientExportRequest,
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
):
    patients = db.query(models.Patient).filter(models.Patient.id.in_(request.patient_ids)).all()
    if not patients:
        raise HTTPException(status_code=404, detail="Aucun patient trouvé")

    export_buffer = io.BytesIO()
    with zipfile.ZipFile(export_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for patient in patients:
            _add_patient_to_zip(zip_file, patient, orthanc)

    export_buffer.seek(0)
    filename = f"export_patients_{len(patients)}.zip"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }
    return Response(content=export_buffer.getvalue(), media_type="application/zip", headers=headers)



@app.get("/dicom/instances/{instance_id}/metadata")
def get_dicom_metadata(instance_id: str, orthanc: OrthancClient = Depends(get_orthanc_client)):
    """Return DICOM metadata for a specific instance."""
    try:
        metadata = orthanc.instance_metadata(instance_id)
        return metadata
    except HTTPException:
        raise HTTPException(status_code=404, detail="Instance DICOM introuvable")


@app.get("/dicom/instances/{instance_id}")
def proxy_dicom_file(instance_id: str, orthanc: OrthancClient = Depends(get_orthanc_client)):
    content = orthanc.stream_instance(instance_id)
    return Response(content=content, media_type="application/dicom")
