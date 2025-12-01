"""Patient management routes"""
import io
import json
import zipfile
from typing import List

from fastapi import APIRouter, Depends, File, Form, UploadFile, HTTPException, Query, Response
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..core.dicom_validator import DicomValidator, get_dicom_validator
from ..core.exceptions import NotFoundError, ValidationError
from ..services import PatientService, AuditService, OrthancClient, get_orthanc_client
from ..models import User

router = APIRouter(prefix="/patients", tags=["patients"])


@router.post("", response_model=schemas.PatientRead, status_code=201)
async def create_patient(
    patient: schemas.PatientCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Create a new patient"""
    # Check if external_id already exists
    existing = PatientService.get_patient_by_external_id(db, patient.external_id)
    if existing:
        raise ValidationError(f"Patient avec external_id '{patient.external_id}' existe déjà", "DUPLICATE_ID")
    
    new_patient = PatientService.create_patient(db, patient)
    AuditService.log_action(db, current_user.id, "CREATE", "patient", str(new_patient.id))
    
    return schemas.PatientRead.model_validate(new_patient)


@router.post("/import", response_model=schemas.PatientRead)
async def import_patient(
    patient: str = Form(...),
    dicom_files: List[UploadFile] = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client),
    validator: DicomValidator = Depends(get_dicom_validator)
):
    """Import patient with DICOM files (with validation)"""
    import json
    
    # Parse patient data
    try:
        patient_data = json.loads(patient)
    except json.JSONDecodeError:
        raise ValidationError("Données patient invalides", "INVALID_JSON")
    
    # Validate and create patient
    patient_schema = schemas.PatientCreate(**patient_data)
    db_patient = PatientService.create_patient(db, patient_schema)
    
    uploaded_files = []
    try:
        import pydicom
        from io import BytesIO
        
        # Generate unique PatientID for this application patient
        unique_patient_id = f"APP_{db_patient.id}_{db_patient.external_id}"
        
        for file in dicom_files:
            # Validate DICOM file
            await validator.validate_dicom_file(file)
            
            # Read and modify DICOM file
            file_content = await file.read()
            
            try:
                # Parse DICOM and modify PatientID to prevent Orthanc auto-grouping
                ds = pydicom.dcmread(BytesIO(file_content))
                
                # Override PatientID with unique application-level ID
                ds.PatientID = unique_patient_id
                
                # Also update PatientName if desired (optional)
                patient_name = f"{db_patient.first_name} {db_patient.last_name}" if db_patient.first_name else unique_patient_id
                if hasattr(ds, 'PatientName'):
                    ds.PatientName = patient_name
                
                # Save modified DICOM
                modified_buffer = BytesIO()
                ds.save_as(modified_buffer)
                modified_content = modified_buffer.getvalue()
                
                # Upload modified DICOM to Orthanc
                result = orthanc.upload_stream(modified_content)
                uploaded_files.append(result)
            except Exception as e:
                print(f"Warning: Could not modify DICOM tags for {file.filename}: {e}")
                # Fallback: upload original if modification fails
                result = orthanc.upload_stream(file_content)
                uploaded_files.append(result)
            
            await file.seek(0)
        
        # Update patient with Orthanc info
        if uploaded_files:
            first_result = uploaded_files[0]
            updates = {
                "orthanc_patient_id": first_result.get("ParentPatient"),
                "dicom_study_uid": first_result.get("ParentStudy")
            }
            PatientService.update_patient(db, db_patient.id, updates)
            # Refresh to get updated fields
            db.refresh(db_patient)
        
        AuditService.log_action(db, current_user.id, "IMPORT", "patient", str(db_patient.id))
        
        return schemas.PatientRead.model_validate(db_patient)
    
    except Exception as e:
        # Rollback patient creation on error
        PatientService.delete_patient(db, db_patient.id)
        raise HTTPException(status_code=500, detail=f"Erreur lors de l'import: {str(e)}")


@router.get("", response_model=List[schemas.PatientRead])
async def list_patients(
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """List all patients with pagination"""
    patients = PatientService.list_patients(db, skip=skip, limit=limit)
    return [schemas.PatientRead.model_validate(p) for p in patients]


@router.get("/search", response_model=List[schemas.PatientRead])
async def search_patients(
    query: str = Query(None),
    condition: str = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Search patients by name, external_id, or condition"""
    patients = PatientService.search_patients(
        db,
        query=query,
        condition=condition,
        skip=skip,
        limit=limit
    )
    return [schemas.PatientRead.model_validate(p) for p in patients]


@router.get("/{patient_id}", response_model=schemas.PatientRead)
async def get_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get a specific patient"""
    patient = PatientService.get_patient(db, patient_id)
    if not patient:
        raise NotFoundError(f"Patient {patient_id} non trouvé", "PATIENT_NOT_FOUND")
    
    return schemas.PatientRead.model_validate(patient)


@router.put("/{patient_id}", response_model=schemas.PatientRead)
async def update_patient(
    patient_id: int,
    patient_update: schemas.PatientUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Update a patient"""
    updated = PatientService.update_patient(
        db,
        patient_id,
        patient_update.model_dump(exclude_unset=True)
    )
    
    if not updated:
        raise NotFoundError(f"Patient {patient_id} non trouvé", "PATIENT_NOT_FOUND")
    
    AuditService.log_action(db, current_user.id, "UPDATE", "patient", str(patient_id))
    return schemas.PatientRead.model_validate(updated)


@router.delete("/{patient_id}")
async def delete_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Delete a patient and associated DICOM data"""
    patient = PatientService.get_patient(db, patient_id)
    if not patient:
        raise NotFoundError(f"Patient {patient_id} non trouvé", "PATIENT_NOT_FOUND")
    
    # Delete from Orthanc if exists
    if patient.orthanc_patient_id:
        try:
            orthanc.delete_patient(patient.orthanc_patient_id)
        except Exception:
            pass  # Continue even if Orthanc deletion fails
    
    # Delete from database
    PatientService.delete_patient(db, patient_id)
    AuditService.log_action(db, current_user.id, "DELETE", "patient", str(patient_id))
    
    return {"message": "Patient supprimé"}


@router.get("/{patient_id}/images", response_model=List[schemas.DicomImage])
async def get_patient_images(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """List DICOM images for a patient"""
    patient = PatientService.get_patient(db, patient_id)
    if not patient or not patient.orthanc_patient_id:
        return []
    
    try:
        instances = orthanc.list_instances(patient.orthanc_patient_id)
        images = []
        for instance in instances:
            instance_id = instance.get('ID')
            if not instance_id:
                continue
                
            # Extract basic metadata if available
            tags = instance.get('MainDicomTags', {})
            description = tags.get('SeriesDescription') or "Image DICOM"
            date = tags.get('InstanceCreationDate') or tags.get('SeriesDate')
            
            # Construct URL for the proxy endpoint
            # Note: The frontend expects a full URL or relative path.
            # Since API_BASE is /api, we return a relative path from API root?
            # Or full path /api/patients/images/{id}
            url = f"/api/patients/images/{instance_id}"
            
            images.append(schemas.DicomImage(
                id=instance_id,
                url=url,
                description=description,
                date=date
            ))
        return images
    except Exception as e:
        print(f"Error fetching images from Orthanc: {e}")
        # Return empty list instead of error to avoid crashing frontend
        return []


from fastapi import Response

@router.get("/instances/{instance_id}/metadata")
async def get_instance_metadata(
    instance_id: str,
    current_user: User = Depends(get_current_user),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Get DICOM instance metadata from Orthanc"""
    try:
        metadata = orthanc.instance_metadata(instance_id)
        return metadata
    except Exception as e:
        print(f"Error fetching metadata for {instance_id}: {e}")
        raise HTTPException(status_code=404, detail="Métadonnées introuvables")


@router.get("/images/{instance_id}")
async def get_dicom_image(
    instance_id: str,
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Proxy to retrieve DICOM file from Orthanc (public access for cornerstone viewer)"""
    try:
        content = orthanc.stream_instance(instance_id)
        return Response(content=content, media_type="application/dicom")
    except Exception:
        raise HTTPException(status_code=404, detail="Image non trouvée")


def _add_patient_to_zip(zip_file: zipfile.ZipFile, patient, orthanc: OrthancClient):
    """Helper function to add a patient's data and DICOM files to a ZIP archive"""
    folder_name = f"Patient-{patient.external_id or patient.id}"
    
    # Add JSON metadata
    json_payload = {
        "id": patient.external_id or str(patient.id),
        "firstName": patient.first_name,
        "lastName": patient.last_name,
        "dob": patient.date_of_birth,
        "condition": patient.condition,
        "lastVisit": patient.last_visit,
        "dicomStudyUid": patient.dicom_study_uid,
        "orthancPatientId": patient.orthanc_patient_id,
    }
    zip_file.writestr(f"{folder_name}/{folder_name}.json", json.dumps(json_payload, indent=2))

    # Add DICOM files
    if patient.orthanc_patient_id:
        try:
            instance_objs = orthanc.list_instances(patient.orthanc_patient_id)
            
            for idx, instance_obj in enumerate(instance_objs, start=1):
                try:
                    instance_id = instance_obj.get("ID")
                    if not instance_id:
                        continue
                        
                    tags = instance_obj.get("MainDicomTags", {})
                    dicom_content = orthanc.stream_instance(instance_id)
                    
                    series = tags.get("SeriesNumber") or 1
                    instance_number = tags.get("InstanceNumber") or idx
                    file_name = f"{series}-{int(instance_number):02d}.dcm"
                    zip_file.writestr(f"{folder_name}/{file_name}", dicom_content)
                except Exception as e:
                    print(f"Error exporting instance {instance_obj.get('ID', 'unknown')}: {e}")
                    continue
        except Exception as e:
            print(f"Error listing instances for patient {patient.id}: {e}")


@router.get("/{patient_id}/export")
async def export_patient(
    patient_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Export a single patient with JSON metadata and DICOM files in a ZIP archive"""
    patient = PatientService.get_patient(db, patient_id)
    if not patient:
        raise NotFoundError(f"Patient {patient_id} non trouvé", "PATIENT_NOT_FOUND")

    export_buffer = io.BytesIO()
    with zipfile.ZipFile(export_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        _add_patient_to_zip(zip_file, patient, orthanc)

    export_buffer.seek(0)
    filename = f"Patient-{patient.external_id or patient.id}.zip"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }
    
    AuditService.log_action(db, current_user.id, "EXPORT", "patient", str(patient_id))
    return Response(content=export_buffer.getvalue(), media_type="application/zip", headers=headers)


@router.post("/export")
async def bulk_export_patients(
    request: schemas.PatientExportRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Export multiple patients with JSON metadata and DICOM files in a single ZIP archive"""
    # Get patients properly using the service
    patients = []
    for patient_id in request.patient_ids:
        patient = PatientService.get_patient(db, patient_id)
        if patient:
            patients.append(patient)
    
    if not patients:
        raise NotFoundError("Aucun patient trouvé", "PATIENTS_NOT_FOUND")

    export_buffer = io.BytesIO()
    with zipfile.ZipFile(export_buffer, "w", compression=zipfile.ZIP_DEFLATED) as zip_file:
        for patient in patients:
            _add_patient_to_zip(zip_file, patient, orthanc)

    export_buffer.seek(0)
    filename = f"export_patients_{len(patients)}.zip"
    headers = {
        "Content-Disposition": f"attachment; filename={filename}"
    }
    
    for patient_id in request.patient_ids:
        AuditService.log_action(db, current_user.id, "EXPORT", "patient", str(patient_id))
    
    return Response(content=export_buffer.getvalue(), media_type="application/zip", headers=headers)

