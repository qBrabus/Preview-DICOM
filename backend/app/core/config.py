import os
from datetime import timedelta
from typing import List

from pydantic import BaseSettings, AnyHttpUrl


class Settings(BaseSettings):
    secret_key: str = os.getenv("SECRET_KEY", "change-this-secret")
    access_token_expire_minutes: int = 15
    refresh_token_expire_minutes: int = 60 * 24
    algorithm: str = "HS256"
    frontend_origin: AnyHttpUrl = os.getenv("FRONTEND_ORIGIN", "http://localhost:4173")
    orthanc_url: str = os.getenv("ORTHANC_URL", "http://orthanc:8042")
    orthanc_username: str | None = os.getenv("ORTHANC_USER")
    orthanc_password: str | None = os.getenv("ORTHANC_PASSWORD")
    postgres_user: str = os.getenv("POSTGRES_USER", "preview_dicom")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "preview_dicom")
    postgres_db: str = os.getenv("POSTGRES_DB", "preview_dicom")
    postgres_host: str = os.getenv("POSTGRES_HOST", "db")
    postgres_port: str = os.getenv("POSTGRES_PORT", "5432")

    @property
    def allow_origins(self) -> List[str]:
        return [str(self.frontend_origin)]

    @property
    def access_token_ttl(self) -> timedelta:
        return timedelta(minutes=self.access_token_expire_minutes)

    @property
    def refresh_token_ttl(self) -> timedelta:
        return timedelta(minutes=self.refresh_token_expire_minutes)


settings = Settings()
