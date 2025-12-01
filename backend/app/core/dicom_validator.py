"""DICOM file validation service"""
import io
from typing import Optional

from fastapi import HTTPException, UploadFile
import pydicom
from pydicom.errors import InvalidDicomError

from ..core.config import settings


class DicomValidator:
    """Validate DICOM files before processing"""
    
    @staticmethod
    async def validate_dicom_file(file: UploadFile) -> bool:
        """
        Validate that the uploaded file is a valid DICOM file.
        Returns True if valid, raises HTTPException otherwise.
        """
        # Check file size
        file_content = await file.read()
        file_size = len(file_content)
        
        if file_size > settings.max_dicom_file_size:
            raise HTTPException(
                status_code=413,
                detail=f"File too large. Maximum size is {settings.max_dicom_file_size / 1024 / 1024:.0f}MB"
            )
        
        if file_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Empty file uploaded"
            )
        
        # Validate DICOM format
        try:
            dicom_stream = io.BytesIO(file_content)
            dcm = pydicom.dcmread(dicom_stream, force=False)
            
            # Basic validation - check for required tags
            if not hasattr(dcm, 'PatientID'):
                raise HTTPException(
                    status_code=400,
                    detail="Invalid DICOM: Missing PatientID tag"
                )
            
            # Reset file pointer for further processing
            await file.seek(0)
            return True
            
        except InvalidDicomError as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid DICOM file: {str(e)}"
            )
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Error validating DICOM file: {str(e)}"
            )
    
    @staticmethod
    async def extract_patient_id(file: UploadFile) -> Optional[str]:
        """Extract PatientID from DICOM file"""
        try:
            file_content = await file.read()
            dicom_stream = io.BytesIO(file_content)
            dcm = pydicom.dcmread(dicom_stream, force=False)
            await file.seek(0)
            return str(dcm.PatientID) if hasattr(dcm, 'PatientID') else None
        except Exception:
            return None
    
    @staticmethod
    async def extract_study_uid(file: UploadFile) -> Optional[str]:
        """Extract StudyInstanceUID from DICOM file"""
        try:
            file_content = await file.read()
            dicom_stream = io.BytesIO(file_content)
            dcm = pydicom.dcmread(dicom_stream, force=False)
            await file.seek(0)
            return str(dcm.StudyInstanceUID) if hasattr(dcm, 'StudyInstanceUID') else None
        except Exception:
            return None


# Dependency injection
def get_dicom_validator() -> DicomValidator:
    return DicomValidator()
