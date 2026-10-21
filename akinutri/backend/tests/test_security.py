from datetime import datetime, timedelta, timezone
import jwt
import pytest
from app import main
from app.auth import create_user
from conftest import request_for


def account(client, email="owner@example.com"):
    response = client.post(
        "/api/auth/register",
        json={"nome": "Operador", "email": email, "senha": "senha-segura-123"},
    )
    assert response.status_code == 201
    return response.json()["user"]


@pytest.mark.parametrize(
    "path",
    [
        "/api/lotes",
        "/api/insumos",
        "/api/sessoes",
        "/api/grupos-producao",
        "/api/animais",
        "/api/regras",
    ],
)
def test_operational_routes_require_server_session(client, path):
    assert client.get(path).status_code == 401


def test_me_logout_and_expired_tokens(client):
    user = account(client)
    assert client.get("/api/auth/me").json()["user"]["id"] == user["id"]
    assert client.post("/api/auth/logout").status_code == 204
    assert client.get("/api/auth/me").status_code == 401
    token = jwt.encode(
        {
            "sub": str(user["id"]),
            "ver": 0,
            "iat": datetime.now(timezone.utc) - timedelta(hours=2),
            "exp": datetime.now(timezone.utc) - timedelta(hours=1),
        },
        "test-only-secret-key-at-least-32-bytes",
        algorithm="HS256",
    )
    client.cookies.set("access_token", token)
    assert client.get("/api/lotes").status_code == 401


def test_two_users_cannot_read_or_formulate_each_others_lots_and_sessions(client):
    account(client)
    request = request_for(client)
    result = client.post("/api/formular", json=request)
    assert result.status_code == 200, result.text
    session_id = result.json()["session_id"]
    assert client.get(f"/api/sessoes/{session_id}").status_code == 200
    client.cookies.clear()
    account(client, "other@example.com")
    assert client.get("/api/lotes").json() == []
    assert client.get("/api/sessoes").json() == []
    assert client.get(f"/api/sessoes/{session_id}").status_code == 404
    assert client.post("/api/formular", json=request).status_code == 404
    assert (
        client.post(
            f"/api/sessoes/{session_id}/batida", json={"batidas_dia": 1}
        ).status_code
        == 404
    )


def test_seed_is_idempotent_and_creates_audited_history(client):
    from app.seed import seed_demo
    from app.models import Lote, SessaoInferencia, UserAccount

    with main.SessionLocal() as db:
        seed_demo(db, "senha-seed-segura-123")
        counts = (
            db.query(UserAccount).count(),
            db.query(Lote).count(),
            db.query(SessaoInferencia).count(),
        )
        seed_demo(db, "outra-senha-nao-substitui")
        assert counts == (1, 3, 3)
        assert counts == (
            db.query(UserAccount).count(),
            db.query(Lote).count(),
            db.query(SessaoInferencia).count(),
        )
    response = client.post(
        "/api/auth/login",
        json={
            "email": "carlos@fazendaouroverde.com.br",
            "password": "senha-seed-segura-123",
        },
    )
    assert response.status_code == 200
    history = client.get("/api/sessoes").json()
    assert len(history) == 3
    for row in history:
        detail = client.get(f"/api/sessoes/{row['id']}")
        assert detail.status_code == 200, detail.text


def test_logout_revokes_cookie_replay_and_foreign_origin_writes(client):
    account(client)
    token = client.cookies.get("access_token")
    assert (
        client.post(
            "/api/auth/logout", headers={"Origin": "https://foreign.example"}
        ).status_code
        == 403
    )
    assert client.get("/api/auth/me").status_code == 200
    assert client.post("/api/auth/logout").status_code == 204
    client.cookies.set("access_token", token)
    assert client.get("/api/auth/me").status_code == 401


def test_private_catalog_and_lifecycle_records_are_isolated(client):
    account(client)
    ingredient = client.get("/api/insumos").json()[0]
    global_id = ingredient.pop("id")
    assert client.put(f"/api/insumos/{global_id}", json=ingredient).status_code == 403
    ingredient["nome"] = "Alimento exclusivo da primeira conta"
    custom = client.post("/api/insumos", json=ingredient)
    assert custom.status_code == 201
    identifier = custom.json()["id"]
    group = client.post(
        "/api/grupos-producao", json={"nome": "Grupo privado", "fase": "lactacao"}
    )
    assert group.status_code == 201
    group_id = group.json()["id"]
    client.cookies.clear()
    account(client, "other@example.com")
    assert identifier not in [i["id"] for i in client.get("/api/insumos").json()]
    assert client.put(f"/api/insumos/{identifier}", json=ingredient).status_code == 404
    assert client.get("/api/grupos-producao").json() == []
    assert client.get(f"/api/grupos-producao/{group_id}").status_code == 404
    assert client.delete(f"/api/grupos-producao/{group_id}").status_code == 404


def test_authenticated_responses_are_not_cached(client):
    account(client)
    response = client.get("/api/lotes")
    assert response.headers.get("cache-control") == "no-store"


def test_legacy_migration_preserves_snapshot_and_keeps_it_unassigned(tmp_path):
    from sqlalchemy import create_engine, text
    from app.database import migrate_ownership, install_immutability_guards
    from app.models import Base

    legacy = create_engine(f"sqlite:///{(tmp_path / 'legacy.db').as_posix()}")
    with legacy.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE users (id INTEGER PRIMARY KEY, email TEXT, name TEXT, password_hash TEXT, criada_em TEXT)"
            )
        )
        connection.execute(
            text(
                "CREATE TABLE sessoes_inferencia (id INTEGER PRIMARY KEY, lote_id INTEGER, base_id INTEGER, modo TEXT, snapshot JSON, criada_em TEXT)"
            )
        )
        connection.execute(
            text(
                "INSERT INTO sessoes_inferencia VALUES (1,1,1,'formular',:snapshot,'2026-10-01')"
            ),
            {"snapshot": '{"original":true}'},
        )
    Base.metadata.create_all(legacy)
    install_immutability_guards(legacy)
    migrate_ownership(legacy)
    migrate_ownership(legacy)
    with legacy.connect() as connection:
        row = connection.execute(
            text("SELECT snapshot, usuario_id FROM sessoes_inferencia WHERE id=1")
        ).one()
        assert tuple(row) == ('{"original":true}', None)
    legacy.dispose()


def test_relative_database_url_is_independent_of_launch_directory(tmp_path):
    import os
    from pathlib import Path
    import subprocess
    import sys

    backend = Path(main.__file__).resolve().parents[1]
    environment = {
        **os.environ,
        "PYTHONPATH": str(backend),
        "AKINUTRI_DATABASE_URL": "sqlite:///./akinutri.db",
    }
    result = subprocess.run(
        [
            sys.executable,
            "-c",
            "from app.database import engine; print(engine.url.database)",
        ],
        cwd=tmp_path,
        env=environment,
        capture_output=True,
        text=True,
        check=True,
    )
    assert Path(result.stdout.strip()) == backend / "akinutri.db"


@pytest.mark.parametrize(
    "path",
    [
        "/",
        "/login",
        "/dashboard",
        "/dashboard/akibot",
        "/dashboard/comparacao",
        "/dashboard/batida",
        "/dashboard/insumos",
        "/dashboard/regras",
        "/dashboard/historico",
        "/dashboard/animais",
        "/dashboard/resultado",
    ],
)
def test_clean_spa_routes_support_refresh(client, path):
    response = client.get(path)
    assert response.status_code == 200
    assert '<div id="root">' in response.text


def test_spa_fallback_does_not_return_html_for_missing_api_or_assets(client):
    response = client.get("/api/does-not-exist")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert client.get("/assets/missing.js").status_code == 404
    assert client.get("/api").status_code == 404


def test_default_seed_credentials_are_available_without_resetting_other_accounts(
    client,
):
    from app.seed import seed_demo

    with main.SessionLocal() as db:
        seed_demo(db)
    response = client.post(
        "/api/auth/login",
        json={"email": "carlos@fazendaouroverde.com.br", "password": "senha123"},
    )
    assert response.status_code == 200


def test_explicit_seed_password_reset_revokes_previous_tokens_and_preserves_history(
    client,
):
    from app.seed import seed_demo
    from app.models import UserAccount, SessaoInferencia

    with main.SessionLocal() as db:
        seed_demo(db, "previous-password-123")
    old = client.post(
        "/api/auth/login",
        json={
            "email": "carlos@fazendaouroverde.com.br",
            "password": "previous-password-123",
        },
    ).json()["access_token"]
    with main.SessionLocal() as db:
        before = [s.id for s in db.query(SessaoInferencia).all()]
        seed_demo(db, reset_password=True)
        assert before == [s.id for s in db.query(SessaoInferencia).all()]
        assert db.query(UserAccount).count() == 1
    assert (
        client.get(
            "/api/auth/me", headers={"Authorization": f"Bearer {old}"}
        ).status_code
        == 401
    )
    assert (
        client.post(
            "/api/auth/login",
            json={"email": "carlos@fazendaouroverde.com.br", "password": "senha123"},
        ).status_code
        == 200
    )
