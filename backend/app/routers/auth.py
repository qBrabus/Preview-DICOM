from datetime import datetime

from fastapi import APIRouter, Cookie, Depends, HTTPException, Response, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from .. import models, schemas
from ..core import security
from ..core.config import settings
from ..database import get_db

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=schemas.Token)
def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
    response: Response = None,
):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Identifiants invalides")

    access_token = security.create_token({"sub": user.id}, settings.access_token_ttl)
    refresh_token = security.create_token({"sub": user.id, "type": "refresh"}, settings.refresh_token_ttl)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        **settings.refresh_cookie_params,
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/refresh", response_model=schemas.Token)
def refresh_token(
    response: Response,
    db: Session = Depends(get_db),
    refresh_token: str | None = Cookie(default=None),
):
    token = refresh_token
    if token is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token manquant")
    payload = security.decode_token(token)
    if payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Mauvais type de jeton")

    user = db.query(models.User).get(payload.get("sub"))
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Utilisateur introuvable")

    access_token = security.create_token({"sub": user.id}, settings.access_token_ttl)
    response.set_cookie(
        key="refresh_token",
        value=token,
        **settings.refresh_cookie_params,
    )
    return {"access_token": access_token, "token_type": "bearer"}
