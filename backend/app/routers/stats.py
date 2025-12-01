"""Stats and health check routes"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from .. import schemas
from ..database import get_db
from ..dependencies import get_current_user
from ..services import PatientService, UserService, OrthancClient, get_orthanc_client
from ..core.cache import cached
from ..models import User

router = APIRouter(tags=["system"])


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@cached(key_prefix="stats", ttl=300)  # Cache for 5 minutes
@router.get("/stats", response_model=schemas.StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
    orthanc: OrthancClient = Depends(get_orthanc_client)
):
    """Get system statistics (cached)"""
    total_patients = PatientService.count_patients(db)
    total_users = len(UserService.list_users(db))
    active_users = UserService.count_active_users(db)
    
    # Count DICOM instances from Orthanc
    total_instances = 0
    try:
        # Get all instances from Orthanc
        response = orthanc._client.get("/instances")
        response.raise_for_status()
        instances = response.json()
        total_instances = len(instances) if isinstance(instances, list) else 0
    except Exception as e:
        print(f"Warning: Could not fetch instance count from Orthanc: {e}")
        total_instances = 0
    
    return schemas.StatsResponse(
        total_patients=total_patients,
        total_instances=total_instances,
        total_users=total_users,
        active_users=active_users
    )
