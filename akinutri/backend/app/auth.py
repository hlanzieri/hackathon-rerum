import os
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .models import UserAccount

router = APIRouter(prefix="/api/auth", tags=["autenticacao"])
COOKIE_NAME = "access_token"
ACCESS_TOKEN_LIFETIME = timedelta(hours=1)
REMEMBERED_TOKEN_LIFETIME = timedelta(days=30)
COOKIE_SECURE = os.getenv("AKINUTRI_COOKIE_SECURE", "false").lower() == "true"
DUMMY_PASSWORD_HASH = bcrypt.hashpw(b"not-a-real-password", bcrypt.gensalt(rounds=12))


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)
    remember: bool = False

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower()

    @field_validator("password")
    @classmethod
    def check_password_size(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("A senha excede o limite suportado.")
        return value


class RegisterRequest(BaseModel):
    nome: str = Field(min_length=1, max_length=120)
    email: EmailStr
    senha: str = Field(min_length=12)

    @field_validator("nome")
    @classmethod
    def normalize_name(cls, value):
        value = value.strip()
        if not value:
            raise ValueError("Informe seu nome.")
        return value

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value):
        return value.strip().lower()

    @field_validator("senha")
    @classmethod
    def check_password_size(cls, value):
        if len(value.encode("utf-8")) > 72:
            raise ValueError("A senha excede o limite suportado.")
        return value


def password_hash(password: str) -> str:
    encoded = password.encode("utf-8")
    if len(encoded) > 72:
        raise ValueError("A senha excede o limite suportado pelo bcrypt.")
    return bcrypt.hashpw(encoded, bcrypt.gensalt(rounds=12)).decode("ascii")


def jwt_secret() -> str:
    secret = os.getenv("AKINUTRI_JWT_SECRET", "")
    if len(secret.encode("utf-8")) < 32:
        raise HTTPException(
            status_code=503,
            detail="Autenticação não configurada. Defina AKINUTRI_JWT_SECRET com pelo menos 32 bytes.",
        )
    return secret


def create_access_token(user: UserAccount, lifetime: timedelta) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode(
        {
            "sub": str(user.id),
            "email": user.email,
            "iat": now,
            "exp": now + lifetime,
        },
        jwt_secret(),
        algorithm="HS256",
    )


def set_auth_cookie(response: Response, user: UserAccount, lifetime: timedelta):
    token = create_access_token(user, lifetime)
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=int(lifetime.total_seconds()),
        httponly=True,
        secure=COOKIE_SECURE,
        samesite="lax",
        path="/api",
    )


@router.post("/login")
def login(data: LoginRequest, response: Response, db: Session = Depends(get_db)):
    jwt_secret()
    user = db.scalar(select(UserAccount).where(UserAccount.email == data.email))
    hash_to_check = user.password_hash.encode("ascii") if user else DUMMY_PASSWORD_HASH
    password_matches = bcrypt.checkpw(data.password.encode("utf-8"), hash_to_check)
    if user is None or not password_matches:
        raise HTTPException(status_code=401, detail="E-mail ou senha inválidos.")

    lifetime = REMEMBERED_TOKEN_LIFETIME if data.remember else ACCESS_TOKEN_LIFETIME
    set_auth_cookie(response, user, lifetime)
    return {"user": {"id": user.id, "email": user.email, "name": user.name}}


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(data: RegisterRequest, response: Response, db: Session = Depends(get_db)):
    jwt_secret()
    try:
        user = create_user(db, data.email, data.nome, data.senha)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    set_auth_cookie(response, user, ACCESS_TOKEN_LIFETIME)
    return {"user": {"id": user.id, "email": user.email, "name": user.name}}


def create_user(db: Session, email: str, name: str, password: str) -> UserAccount:
    user = UserAccount(
        email=email.strip().lower(),
        name=name.strip(),
        password_hash=password_hash(password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise ValueError("Já existe uma conta com esse e-mail.") from error
    db.refresh(user)
    return user
