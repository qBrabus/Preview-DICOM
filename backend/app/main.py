"""
Simplified FastAPI application with modular routers
This replaces the monolithic main.py with a clean architecture
"""
import time
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.exc import OperationalError
from sqlalchemy import text

from .database import Base, engine, SessionLocal
from .core.config import settings
from .core import security
from .core.exceptions import app_exception_handler, AppException
from . import models

# Import routers
from .routers import auth, users, groups, patients, stats

# Initialize FastAPI
app = FastAPI(
    title="Preview DICOM Platform",
    version="0.2.0",
    description="Plateforme de prévisualisation DICOM avec gestion sécurisée"
)

# Exception handlers
app.add_exception_handler(AppException, app_exception_handler)


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


def ensure_schema_upgrades():
    """Apply minimal, idempotent upgrades for existing databases."""
    with engine.begin() as connection:
        # Add status column if not exists
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


def seed_initial_data():
    """
    Ensure the platform has a default administrator account and a test patient
    so the application never falls back to hard-coded demo data.
    """
    db = SessionLocal()
    try:
        # Create admin group
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

        # Create admin user
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

        # Create test patient
        test_patient = db.query(models.Patient).filter(
            models.Patient.external_id == "patient_test_poc"
        ).first()
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


# Initialize database
wait_for_db()
Base.metadata.create_all(bind=engine)
ensure_schema_upgrades()
seed_initial_data()

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allow_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],  # More restrictive
    allow_headers=["*"],
)

# Mount routers
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(groups.router)
app.include_router(patients.router)
app.include_router(stats.router)

# Lifecycle events
@app.on_event("startup")
async def startup_event():
    """Initialize services on startup"""
    from .core.cache import cache
    await cache.connect()
    print("✅ Application démarrée - Cache Redis connecté")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown"""
    from .core.cache import cache
    from .core.security import cleanup_expired_tokens
    from .database import SessionLocal
    
    await cache.disconnect()
    
    # Cleanup expired tokens
    db = SessionLocal()
    try:
        cleanup_expired_tokens(db)
    finally:
        db.close()
    
    print("✅ Application arrêtée proprement")


# Root endpoint
@app.get("/", tags=["system"])
async def root():
    return {
        "message": "Preview DICOM Platform API",
        "version": "0.2.0",
        "docs": "/docs"
    }
