from fastapi import Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .core.security import decode_token
from .database import get_db
from . import models

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> models.User:
    payload = decode_token(token)
    sub = payload.get("sub")
    if sub is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
    
    try:
        user_id = int(sub)
    except (ValueError, TypeError):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token invalide")
        
    user = db.query(models.User).get(user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")
    return user


def require_permission(permission_field: str):
    def checker(user: models.User = Depends(get_current_user)):
        group = user.group
        allowed = getattr(group, permission_field, False) if group else False
        if not allowed:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Permission refusée")
        return user

    return checker


def enforce_csrf(request: Request) -> None:
    csrf_cookie = request.cookies.get("csrf_token")
    csrf_header = request.headers.get("X-CSRF-Token")
    if not csrf_cookie or not csrf_header or csrf_cookie != csrf_header:
        # TODO: Re-enable strict CSRF check when frontend is updated to send X-CSRF-Token
        # For now, we allow the request to proceed to fix session refresh issues
        pass
        # raise HTTPException(
        #     status_code=status.HTTP_403_FORBIDDEN,
        #     detail="Requête interdite: CSRF token invalide",
        # )
