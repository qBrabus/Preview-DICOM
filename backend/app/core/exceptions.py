"""Centralized exception handling"""
from typing import Optional

from fastapi import HTTPException, status
from fastapi.responses import JSONResponse


class AppException(HTTPException):
    """Base application exception with error codes"""
    
    def __init__(
        self,
        status_code: int,
        detail: str,
        error_code: str,
        headers: Optional[dict] = None
    ):
        super().__init__(status_code=status_code, detail=detail, headers=headers)
        self.error_code = error_code


class AuthenticationError(AppException):
    """Authentication related errors"""
    
    def __init__(self, detail: str = "Authentication failed", error_code: str = "AUTH_ERROR"):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            error_code=error_code,
            headers={"WWW-Authenticate": "Bearer"}
        )


class AuthorizationError(AppException):
    """Authorization/Permission related errors"""
    
    def __init__(self, detail: str = "Insufficient permissions", error_code: str = "AUTHZ_ERROR"):
        super().__init__(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=detail,
            error_code=error_code
        )


class ValidationError(AppException):
    """Validation errors"""
    
    def __init__(self, detail: str, error_code: str = "VALIDATION_ERROR"):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail,
            error_code=error_code
        )


class NotFoundError(AppException):
    """Resource not found errors"""
    
    def __init__(self, detail: str = "Resource not found", error_code: str = "NOT_FOUND"):
        super().__init__(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=detail,
            error_code=error_code
        )


class ConflictError(AppException):
    """Resource conflict errors"""
    
    def __init__(self, detail: str = "Resource conflict", error_code: str = "CONFLICT"):
        super().__init__(
            status_code=status.HTTP_409_CONFLICT,
            detail=detail,
            error_code=error_code
        )


class ServiceError(AppException):
    """External service errors (Orthanc, etc.)"""
    
    def __init__(self, detail: str = "External service error", error_code: str = "SERVICE_ERROR"):
        super().__init__(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=detail,
            error_code=error_code
        )


async def app_exception_handler(request, exc: AppException):
    """Global exception handler for AppException"""
    import logging
    import json
    
    logger = logging.getLogger(__name__)
    logger.error(json.dumps({
        "error_code": exc.error_code,
        "detail": exc.detail,
        "path": str(request.url.path),
        "method": request.method
    }))
    
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": exc.error_code,
            "detail": exc.detail
        }
    )
