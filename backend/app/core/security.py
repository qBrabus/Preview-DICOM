from datetime import datetime, timedelta
from typing import Optional
import uuid

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


def create_token(data: dict, expires_delta: timedelta, token_type: str = "access") -> tuple[str, str]:
    """
    Create a JWT token with a unique JTI (JWT ID) for revocation support.
    Returns (token, jti)
    """
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    jti = str(uuid.uuid4())
    
    to_encode.update({
        "exp": expire,
        "jti": jti,
        "type": token_type,
        "iat": datetime.utcnow()
    })
    
    encoded_jwt = jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)
    return encoded_jwt, jti


def decode_token(token: str) -> dict:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        return payload
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalide ou expiré",
            headers={"WWW-Authenticate": "Bearer"},
        )


def is_token_revoked(jti: str, db) -> bool:
    """Check if a token has been revoked"""
    from ..models import RevokedToken
    return db.query(RevokedToken).filter(RevokedToken.jti == jti).first() is not None


def revoke_token(jti: str, token_type: str, user_id: int, expires_at: datetime, db) -> None:
    """Revoke a token by adding it to the blacklist"""
    from ..models import RevokedToken
    revoked = RevokedToken(
        jti=jti,
        token_type=token_type,
        user_id=user_id,
        revoked_at=datetime.utcnow(),
        expires_at=expires_at
    )
    db.add(revoked)
    db.commit()


def cleanup_expired_tokens(db) -> None:
    """Remove expired tokens from the revocation table"""
    from ..models import RevokedToken
    db.query(RevokedToken).filter(RevokedToken.expires_at < datetime.utcnow()).delete()
    db.commit()


def generate_csrf_token() -> str:
    return token_urlsafe(32)
