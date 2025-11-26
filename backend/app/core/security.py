from datetime import datetime, timedelta
from typing import Optional

from datetime import datetime, timedelta
from secrets import token_urlsafe

from fastapi import HTTPException, status
from jose import JWTError, jwt
from passlib.context import CryptContext
from passlib.exc import UnknownHashError

from .config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return pwd_context.verify(plain_password, hashed_password)
    except UnknownHashError:
        return False


def is_supported_password_hash(hashed_password: str) -> bool:
    """
    Return True when the stored password hash matches one of the configured
    hashing schemes. This guards against legacy/plaintext values that would
    otherwise raise an UnknownHashError during verification.
    """

    if not hashed_password:
        return False

    try:
        return pwd_context.identify(hashed_password) is not None
    except UnknownHashError:
        return False


def create_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt


def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


def generate_csrf_token() -> str:
    return token_urlsafe(32)
