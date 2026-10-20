from datetime import datetime, timezone

import jwt

from app import main
from app.auth import create_user, password_hash
from app.models import UserAccount


def add_user(client):
    with main.SessionLocal() as db:
        db.add(
            UserAccount(
                email="pessoa@exemplo.com",
                name="Pessoa",
                password_hash=password_hash("senha-segura-123"),
            )
        )
        db.commit()


def test_login_sets_http_only_jwt_cookie(client):
    add_user(client)
    response = client.post(
        "/api/auth/login",
        json={"email": "PESSOA@EXEMPLO.COM", "password": "senha-segura-123"},
    )

    assert response.status_code == 200
    assert response.json()["user"] == {
        "id": 1,
        "email": "pessoa@exemplo.com",
        "name": "Pessoa",
    }
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"] == response.cookies["access_token"]
    cookie = response.headers["set-cookie"]
    assert "httponly" in cookie.lower()
    assert "samesite=lax" in cookie.lower()
    assert "path=/api" in cookie.lower()
    claims = jwt.decode(
        response.cookies["access_token"],
        "test-only-secret-key-at-least-32-bytes",
        algorithms=["HS256"],
    )
    assert claims["sub"] == "1"
    assert claims["email"] == "pessoa@exemplo.com"
    assert claims["exp"] > datetime.now(timezone.utc).timestamp()


def test_login_returns_generic_unauthorized_for_unknown_or_wrong_password(client):
    add_user(client)
    unknown = client.post(
        "/api/auth/login",
        json={"email": "ausente@exemplo.com", "password": "senha-segura-123"},
    )
    wrong_password = client.post(
        "/api/auth/login",
        json={"email": "pessoa@exemplo.com", "password": "senha-incorreta"},
    )

    assert unknown.status_code == wrong_password.status_code == 401
    assert unknown.json()["detail"] == wrong_password.json()["detail"]


def test_login_rejects_invalid_email_and_missing_jwt_secret(client, monkeypatch):
    invalid_email = client.post(
        "/api/auth/login",
        json={"email": "nao-e-email", "password": "senha-segura-123"},
    )
    monkeypatch.delenv("AKINUTRI_JWT_SECRET")
    missing_secret = client.post(
        "/api/auth/login",
        json={"email": "pessoa@exemplo.com", "password": "senha-segura-123"},
    )

    assert invalid_email.status_code == 422
    assert missing_secret.status_code == 503


def test_remembered_login_uses_longer_cookie_lifetime(client):
    add_user(client)
    response = client.post(
        "/api/auth/login",
        json={
            "email": "pessoa@exemplo.com",
            "password": "senha-segura-123",
            "remember": True,
        },
    )

    assert response.status_code == 200
    assert "max-age=2592000" in response.headers["set-cookie"].lower()


def test_create_user_normalizes_email_and_only_stores_password_hash(client):
    with main.SessionLocal() as db:
        user = create_user(db, " PESSOA@EXEMPLO.COM ", " Pessoa ", "senha-segura-123")
        assert user.email == "pessoa@exemplo.com"
        assert user.name == "Pessoa"
        assert user.password_hash != "senha-segura-123"
        assert user.password_hash.startswith("$2b$")


def test_register_creates_user_hashes_password_and_logs_user_in(client):
    response = client.post(
        "/api/auth/register",
        json={
            "nome": "  Pessoa  ",
            "email": " PESSOA@EXEMPLO.COM ",
            "senha": "senha-segura-123",
        },
    )

    assert response.status_code == 201, response.text
    assert response.json()["user"] == {
        "id": 1,
        "email": "pessoa@exemplo.com",
        "name": "Pessoa",
    }
    assert response.json()["token_type"] == "bearer"
    assert response.json()["access_token"] == response.cookies["access_token"]
    assert "httponly" in response.headers["set-cookie"].lower()
    with main.SessionLocal() as db:
        user = db.get(UserAccount, 1)
        assert user.password_hash != "senha-segura-123"
        assert user.password_hash.startswith("$2b$")


def test_register_rejects_duplicate_email_case_insensitively(client):
    add_user(client)
    response = client.post(
        "/api/auth/register",
        json={
            "nome": "Outra Pessoa",
            "email": "PESSOA@EXEMPLO.COM",
            "senha": "outra-senha-segura",
        },
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "Já existe uma conta com esse e-mail."


def test_register_accepts_eight_character_password(client):
    response = client.post(
        "/api/auth/register",
        json={
            "nome": "Pessoa",
            "email": "pessoa@exemplo.com",
            "senha": "senha123",
        },
    )

    assert response.status_code == 201, response.text


def test_register_validates_fields_and_requires_jwt_secret(client, monkeypatch):
    short_password = client.post(
        "/api/auth/register",
        json={"nome": "Pessoa", "email": "pessoa@exemplo.com", "senha": "curta"},
    )
    blank_name = client.post(
        "/api/auth/register",
        json={
            "nome": "   ",
            "email": "pessoa@exemplo.com",
            "senha": "senha-segura-123",
        },
    )
    monkeypatch.delenv("AKINUTRI_JWT_SECRET")
    missing_secret = client.post(
        "/api/auth/register",
        json={
            "nome": "Pessoa",
            "email": "pessoa@exemplo.com",
            "senha": "senha-segura-123",
        },
    )

    assert short_password.status_code == 422
    assert blank_name.status_code == 422
    assert missing_secret.status_code == 503
    with main.SessionLocal() as db:
        assert db.query(UserAccount).count() == 0


def test_cors_allows_only_configured_local_origins_with_credentials(client):
    allowed = client.options(
        "/api/auth/login",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "POST",
        },
    )
    remote = client.options(
        "/api/auth/login",
        headers={
            "Origin": "https://example.com",
            "Access-Control-Request-Method": "POST",
        },
    )

    assert allowed.headers["access-control-allow-origin"] == "http://localhost:5173"
    assert allowed.headers["access-control-allow-credentials"] == "true"
    assert "access-control-allow-origin" not in remote.headers


def test_bearer_auth_without_cookie_and_invalid_header_precedence(client):
    add_user(client)
    login = client.post(
        "/api/auth/login",
        json={"email": "pessoa@exemplo.com", "password": "senha-segura-123"},
    )
    token = login.json()["access_token"]
    client.cookies.clear()
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {token}"}
        ).status_code
        == 200
    )
    assert (
        client.get(
            "/api/lotes", headers={"Authorization": "Bearer adulterado"}
        ).status_code
        == 401
    )
    client.cookies.set("access_token", token)
    assert (
        client.get("/api/lotes", headers={"Authorization": "Basic invalid"}).status_code
        == 401
    )
