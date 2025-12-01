import os
from datetime import timedelta
from typing import List

from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Security
    secret_key: str = os.getenv("SECRET_KEY", "change-this-secret")
    access_token_expire_minutes: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "15"))
    refresh_token_expire_minutes: int = int(os.getenv("REFRESH_TOKEN_EXPIRE_MINUTES", str(60 * 24)))
    algorithm: str = "HS256"
    
    # Frontend
    frontend_origin: AnyHttpUrl = os.getenv("FRONTEND_ORIGIN", "http://localhost:4173")
    
    # Orthanc
    orthanc_url: str = os.getenv("ORTHANC_URL", "http://orthanc:8042")
    orthanc_username: str | None = os.getenv("ORTHANC_USER")
    orthanc_password: str | None = os.getenv("ORTHANC_PASSWORD")
    
    # Database
    postgres_user: str = os.getenv("POSTGRES_USER", "preview_dicom")
    postgres_password: str = os.getenv("POSTGRES_PASSWORD", "preview_dicom")
    postgres_db: str = os.getenv("POSTGRES_DB", "preview_dicom")
    postgres_host: str = os.getenv("POSTGRES_HOST", "db")
    postgres_port: str = os.getenv("POSTGRES_PORT", "5432")
    
    # Redis
    redis_host: str = os.getenv("REDIS_HOST", "redis")
    redis_port: int = int(os.getenv("REDIS_PORT", "6379"))
    redis_db: int = int(os.getenv("REDIS_DB", "0"))
    
    # Cookie Configuration
    cookie_secure: bool = os.getenv("COOKIE_SECURE", "true").lower() == "true"
    cookie_samesite: str = os.getenv("COOKIE_SAMESITE", "lax")
    cookie_domain: str | None = os.getenv("COOKIE_DOMAIN")
    
    # File Upload
    max_dicom_file_size: int = int(os.getenv("MAX_DICOM_FILE_SIZE", str(500 * 1024 * 1024)))  # 500MB
    max_batch_files: int = int(os.getenv("MAX_BATCH_FILES", "100"))
    
    # Pagination
    default_page_size: int = int(os.getenv("DEFAULT_PAGE_SIZE", "20"))
    max_page_size: int = int(os.getenv("MAX_PAGE_SIZE", "100"))
    
    # Cache
    cache_default_ttl: int = int(os.getenv("CACHE_DEFAULT_TTL", "300"))  # 5 minutes

    @field_validator("secret_key")
    @classmethod
    def validate_secret_key(cls, v):
        if v == "change-this-secret":
            import sys
            if "pytest" not in sys.modules:  # Allow in tests
                raise ValueError(
                    "SECRET_KEY must be changed in production! "
                    "Generate one with: openssl rand -hex 32"
                )
        if len(v) < 32:
            raise ValueError("SECRET_KEY must be at least 32 characters long")
        return v

    @property
    def allow_origins(self) -> List[str]:
        return [str(self.frontend_origin)]

    @property
    def access_token_ttl(self) -> timedelta:
        return timedelta(minutes=self.access_token_expire_minutes)

    @property
    def refresh_token_ttl(self) -> timedelta:
        return timedelta(minutes=self.refresh_token_expire_minutes)

    @property
    def refresh_cookie_params(self) -> dict:
        return {
            "httponly": True,
            "secure": self.cookie_secure,
            "samesite": self.cookie_samesite,
            "max_age": int(self.refresh_token_ttl.total_seconds()),
            "domain": self.cookie_domain,
            "path": "/",
        }

    @property
    def csrf_cookie_params(self) -> dict:
        return {
            "httponly": False,
            "secure": self.cookie_secure,
            "samesite": self.cookie_samesite,
            "max_age": int(self.refresh_token_ttl.total_seconds()),
            "domain": self.cookie_domain,
            "path": "/",
        }
    
    @property
    def redis_url(self) -> str:
        return f"redis://{self.redis_host}:{self.redis_port}/{self.redis_db}"


settings = Settings()
