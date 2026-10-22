"""Relational compatibility, closed API perimeter and complete supplied seed."""

import copy
from sqlalchemy import select, text
from app import main
from app.auth import PASSWORD_CONTEXT, password_hash, password_matches
from app.models import (
    Usuario,
    UserAccount,
    Insumo,
    InsumoAlimentar,
    Lote,
    SessaoInferencia,
)
from app.seed import INSUMOS_SEED, seed, seed_demo, ingredient_values
from conftest import request_for


def test_domain_aliases_share_tables_and_legacy_bcrypt_is_accepted():
    import bcrypt

    assert Usuario is UserAccount
    assert Insumo is InsumoAlimentar
    account = Usuario(nome="Pessoa", senha_hash="hash")
    assert account.name == "Pessoa" and account.password_hash == "hash"
    old_hash = bcrypt.hashpw(b"senha123", bcrypt.gensalt()).decode("ascii")
    assert password_matches("senha123", old_hash)
    assert PASSWORD_CONTEXT.identify(password_hash("senha123")) == "bcrypt"
    assert not password_matches("senha123", "hash corrompido")


def test_register_persists_role_and_farm(client):
    response = client.post(
        "/api/auth/register",
        json={
            "nome": "Tecnica",
            "email": "tecnica@example.com",
            "senha": "senha123",
            "cargo": "zootecnista",
            "fazenda_nome": " Fazenda Teste ",
        },
    )
    assert response.status_code == 201, response.text
    user = client.get("/api/auth/me").json()["user"]
    assert user["role"] == "zootecnista" and user["fazenda_nome"] == "Fazenda Teste"
    assert (
        client.post(
            "/api/auth/register",
            json={
                "nome": "X",
                "email": "x@example.com",
                "senha": "senha123",
                "cargo": "admin",
            },
        ).status_code
        == 422
    )


def test_all_api_routes_require_auth_but_spa_navigation_does_not(client):
    client.cookies.clear()
    for path in (
        "/api/health",
        "/api/lotes",
        "/api/racas",
        "/api/auth/me",
        "/api/rota-futura",
        "/api",
    ):
        response = client.get(path)
        assert response.status_code == 401, (path, response.text)
        assert response.headers["content-type"].startswith("application/json")
    assert client.post("/api/auth/logout").status_code == 401
    for path in ("/login", "/dashboard", "/dashboard/akibot"):
        assert client.get(path).status_code == 200


def test_lot_accepts_requested_domain_names_and_enforces_tmr(client):
    lot = {
        "nome": "Lote por nomes",
        "raca": "Holandesa",
        "peso_medio_kg": 600,
        "idade_meses": 48,
        "ordem_paricao": 3,
        "estado_produtivo": "lactacao",
        "destinacao_economica": "leite_fluido",
        "producao_litros_dia": 30,
        "dias_em_lactacao": 100,
        "tmr_habilitado": False,
    }
    response = client.post("/api/lotes", json=lot)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["peso_kg"] == 600 and saved["raca"] == "Holandesa"
    with main.SessionLocal() as db:
        record = db.get(Lote, saved["id"])
        assert record.peso_medio_kg == 600 and record.estado_produtivo == "lactacao"
        assert record.raca == "Holandesa" and record.dias_em_lactacao == 100
    request = request_for(client)
    request["lote_id"] = saved["id"]
    assert client.post("/api/formular", json=request).status_code == 422
    request["sistema"] = "outro"
    assert client.post("/api/formular", json=request).json()["status"] == "fora_escopo"
    lot["raca_id"] = 2
    assert client.post("/api/lotes", json=lot).status_code == 422


def test_complete_seed_has_exact_supplied_values_and_categories(client):
    catalog = {i["nome"]: i for i in client.get("/api/insumos").json()}
    keys = (
        "ms_pct",
        "pb_pct",
        "fdn_pct",
        "amido_pct",
        "ca_pct",
        "p_pct",
        "el_mcal_kg",
        "preco_kg_mn",
    )
    for item in INSUMOS_SEED:
        row = catalog[item["nome"]]
        assert all(row[k] is not None for k in keys)
        assert all(row[k] == value for k, value in ingredient_values(item).items())
        assert "nao comprovada" in row["fonte"]
    polpa = next(i for i in INSUMOS_SEED if i["nome"].startswith("Polpa"))
    assert polpa["amido_pct"] == 0


def test_private_duplicate_name_does_not_suppress_global_seed(client):
    item = INSUMOS_SEED[0]
    with main.SessionLocal() as db:
        owner = db.scalar(select(UserAccount))
        duplicate = InsumoAlimentar(
            usuario_id=owner.id, **ingredient_values(item), fonte="Privado"
        )
        db.add(duplicate)
        db.commit()
        global_row = db.scalar(
            select(InsumoAlimentar).where(
                InsumoAlimentar.nome == item["nome"],
                InsumoAlimentar.usuario_id.is_(None),
            )
        )
        db.delete(global_row)
        db.commit()
        seed(db)
        seed(db)
        rows = list(
            db.scalars(
                select(InsumoAlimentar).where(InsumoAlimentar.nome == item["nome"])
            )
        )
        assert len(rows) == 2 and sum(r.usuario_id is None for r in rows) == 1


def test_seed_account_and_private_seed_are_complete_without_reset(client):
    with main.SessionLocal() as db:
        seed_demo(db)
        user = db.scalar(
            select(Usuario).where(Usuario.email == "carlos@fazendaouroverde.com.br")
        )
        assert user.nome == "Dr. Carlos Eduardo de Moraes"
        assert user.cargo == "zootecnista" and user.fazenda_nome == "Fazenda Ouro Verde"
        assert user.conta_demo and password_matches("senha123", user.senha_hash)
        previous_hash = user.senha_hash
        seed_demo(db, "outra-senha-nao-substitui")
        assert user.senha_hash == previous_hash
        items = list(db.scalars(select(Insumo).where(Insumo.usuario_id == user.id)))
        assert len(items) == 6
        assert all(
            all(
                getattr(i, k) is not None
                for k in (
                    "pb_pct",
                    "fdn_pct",
                    "amido_pct",
                    "ca_pct",
                    "p_pct",
                    "el_mcal_kg",
                )
            )
            for i in items
        )


def test_session_relational_metadata_matches_snapshot_and_result(client):
    result = client.post("/api/formular", json=request_for(client)).json()
    detail = client.get(f"/api/sessoes/{result['session_id']}").json()
    metadata = detail["metadata"]
    with main.SessionLocal() as db:
        session = db.get(SessaoInferencia, result["session_id"])
        assert (
            session.base_versao
            == result["knowledge_version"]
            == metadata["base_versao"]
        )
        assert session.base_hash_sha256 == result["knowledge_sha256"]
        assert session.cf_global == result["global_cf"]
        assert session.dados_snapshot_json == detail["snapshot"]
        assert session.usuario_id == metadata["usuario_id"]


def test_mineral_aliases_and_new_concentrate_categories(client):
    for category in ("concentrado_energetico", "concentrado_proteico"):
        item = copy.deepcopy(INSUMOS_SEED[2])
        item.update(
            nome=f"Privado {category}", categoria=category, fonte="Cenario sintetico"
        )
        response = client.post("/api/insumos", json=item)
        assert response.status_code == 201, response.text
        assert response.json()["ca_pct"] == item["calcio_pct"]
        with main.SessionLocal() as db:
            row = db.get(Insumo, response.json()["id"])
            assert (
                row.calcio_pct == item["calcio_pct"]
                and row.fosforo_pct == item["fosforo_pct"]
            )
