"""Failure paths and repeatable presentation data."""

import copy
from types import SimpleNamespace
import pytest
from sqlalchemy import select, func
from app import main, engine_solver
from app.models import (
    UserAccount,
    Lote,
    GrupoProducao,
    InsumoAlimentar,
    SessaoInferencia,
)
from app.auth import password_matches
from conftest import request_for
from seed_apresentacao import seed_apresentacao, INSUMOS_SEED_OFICIAL


@pytest.mark.parametrize("field", ["itens", "insumos_ids"])
def test_empty_selection_is_friendly_400(client, field):
    payload = request_for(client)
    payload.pop("itens")
    payload[field] = []
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 400
    assert response.json()["code"] == "DADOS_INSUFICIENTES"


def test_ids_alias_and_exorbitant_bounds(client):
    payload = request_for(client)
    payload["insumos_ids"] = [item["insumo_id"] for item in payload.pop("itens")]
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 200, response.text
    payload = request_for(client)
    payload["itens"][0]["maximo_kg_ms"] = 500.01
    assert client.post("/api/formular", json=payload).status_code == 422
    payload["itens"][0]["maximo_kg_ms"] = 500
    assert client.post("/api/formular", json=payload).status_code == 200


def test_timeout_returns_408_and_explicit_budget(client, monkeypatch):
    payload = request_for(client)

    def timeout(*args, **kwargs):
        assert kwargs["method"] == "highs"
        assert kwargs["options"]["time_limit"] == 3.0
        assert kwargs["options"]["presolve"] is True
        return SimpleNamespace(status=1, success=False)

    monkeypatch.setattr(engine_solver, "linprog", timeout)
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 408
    assert "Tempo" in response.json()["detail"]


def test_unexpected_solver_exception_is_not_500(client, monkeypatch):
    payload = request_for(client)

    def crash(*args, **kwargs):
        raise RuntimeError("private internal detail")

    monkeypatch.setattr(engine_solver, "linprog", crash)
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "falha_solver"
    assert "private internal detail" not in response.text


def test_seed_repeats_without_cross_account_changes_and_preserves_audit(client):
    from app.demo_seed import seed_demo

    with main.SessionLocal() as db:
        seed_demo(db)
        user = db.scalar(
            select(UserAccount).where(
                UserAccount.email == "carlos@fazendaouroverde.com.br"
            )
        )
        owner = user.id
        before_audit = [
            (s.id, copy.deepcopy(s.snapshot))
            for s in db.scalars(
                select(SessaoInferencia).where(SessaoInferencia.usuario_id == owner)
            )
        ]
        other_lots = [
            (lot.id, lot.nome)
            for lot in db.scalars(select(Lote).where(Lote.usuario_id != owner))
        ]
        first = seed_apresentacao(db)
        second = seed_apresentacao(db)
        assert first == second
        assert password_matches("senha123", user.password_hash)
        assert [
            (s.id, s.snapshot)
            for s in db.scalars(
                select(SessaoInferencia).where(SessaoInferencia.usuario_id == owner)
            )
        ] == before_audit
        assert [
            (lot.id, lot.nome)
            for lot in db.scalars(select(Lote).where(Lote.usuario_id != owner))
        ] == other_lots
        groups = db.scalars(
            select(GrupoProducao).where(
                GrupoProducao.usuario_id == owner, GrupoProducao.ativo.is_(True)
            )
        ).all()
        assert len(groups) == 4
        assert sum(g.numero_animais for g in groups) == 115
        lots = db.scalars(
            select(Lote).where(Lote.usuario_id == owner).order_by(Lote.id)
        ).all()
        assert [lot.tmr_habilitado for lot in lots] == [True, True, False, False]
        assert lots[-1].estado == "recria"
        ingredients = db.scalars(
            select(InsumoAlimentar).where(InsumoAlimentar.usuario_id == owner)
        ).all()
        assert len(ingredients) == 5
        for ingredient in ingredients:
            if ingredient.nome.startswith("Feno de Teste"):
                assert ingredient.ca_pct is None and ingredient.p_pct is None
                assert ingredient.ms_pct == 85
            else:
                assert all(
                    getattr(ingredient, key) is not None
                    for key in (
                        "ms_pct",
                        "pb_pct",
                        "fdn_pct",
                        "amido_pct",
                        "el_mcal_kg",
                        "ca_pct",
                        "p_pct",
                    )
                )


def test_incomplete_source_rejected_before_seed_mutates(client):
    values = copy.deepcopy(INSUMOS_SEED_OFICIAL[:4])
    values[0]["calcio_pct"] = None
    with main.SessionLocal() as db:
        before = db.scalar(select(func.count()).select_from(Lote))
        with pytest.raises(ValueError, match="incompleta"):
            seed_apresentacao(db, values)
        assert db.scalar(select(func.count()).select_from(Lote)) == before
