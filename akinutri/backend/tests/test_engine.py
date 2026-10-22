"""T2 regression cases: units, sources, frozen policies and missing knowledge."""

import copy
import json
import os
from pathlib import Path
import subprocess
import sys
import pytest
from app.engine_rules import load_base, select_profile
from app.engine_intake import estimate_intake
from app.schemas import CmsRequest, FactEvidence
from app import main
from app.audit import digest
from app.models import BaseConhecimento
from conftest import request_for


@pytest.mark.parametrize("phase", ["call", "setup", "teardown"])
def test_watchdog_stops_hung_test_or_fixture(tmp_path, phase):
    script = tmp_path / "test_hang.py"
    fixture = {
        "call": "def test_hang():\n    time.sleep(10)\n",
        "setup": "@pytest.fixture\ndef stuck():\n    time.sleep(10)\n\ndef test_hang(stuck):\n    pass\n",
        "teardown": "@pytest.fixture\ndef stuck():\n    yield\n    time.sleep(10)\n\ndef test_hang(stuck):\n    pass\n",
    }[phase]
    script.write_text("import time, pytest\n" + fixture, encoding="utf-8")
    environment = os.environ.copy()
    backend = Path(__file__).resolve().parents[1]
    environment["PYTHONPATH"] = os.pathsep.join([str(backend / "tests"), str(backend)])
    child = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "-p",
            "conftest",
            "-q",
            "--test-timeout=0.4",
            str(script),
        ],
        cwd=backend,
        env=environment,
        capture_output=True,
        text=True,
        timeout=12,
    )
    assert child.returncode == 124, child.stdout + child.stderr
    assert "TIMEOUT:" in child.stderr
    assert "setup/teste/teardown" in child.stderr


def facts(**changes):
    return dict(
        estado="lactacao",
        producao_l_dia=35,
        dias_lactacao=100,
        sistema="tmr",
        particula_adequada=True,
        milho_seco_predominante=True,
        consumo_ms_kg=24,
        idade_meses=48,
        ordem_paricao=3,
        destinacao_economica="leite_fluido",
        **changes,
    )


@pytest.mark.parametrize("age,parity", [(36, 3), (48, 1), (24, 1)])
def test_growth_adds_ten_percent_of_maintenance_once(age, parity):
    base, _ = load_base()
    values = facts()
    values.update(
        idade_meses=age,
        ordem_paricao=parity,
        mantenca_pb_kg_dia=0.5,
        mantenca_el_mcal_dia=10,
        fonte_mantenca="Entrada sintetica de teste",
    )
    original = copy.deepcopy(base)
    profile, trace = select_profile(base, values)
    assert profile["limits"]["pb_pct"][0] == pytest.approx(17 + 0.10 * 0.5 / 24 * 100)
    assert profile["limits"]["el_mcal_kg"][0] == pytest.approx(1.6 + 0.10 * 10 / 24)
    assert len(profile["adjustments"]) == 1
    assert trace[-1]["adjustments"][0]["inputs"]["fonte_mantenca"]
    assert base == original


def test_growth_requires_maintenance_and_source():
    base, _ = load_base()
    values = facts()
    values["idade_meses"] = 30
    profile, trace = select_profile(base, values)
    assert profile is None
    assert set(trace[-1]["missing_inputs"]) == {
        "mantenca_pb_kg_dia",
        "mantenca_el_mcal_dia",
        "fonte_mantenca",
    }


def test_cheese_and_fluid_limits_and_dry_exclusion():
    base, _ = load_base()
    fluid, _ = select_profile(base, facts())
    cheese_facts = facts()
    cheese_facts["destinacao_economica"] = "queijo_artesanal"
    cheese, _ = select_profile(base, cheese_facts)
    assert fluid["limits"]["pb_pct"][0] == 17
    assert cheese["limits"]["pb_pct"][0] == 18
    assert cheese["limits"]["fdn_volumoso_pct"][0] == 21
    cheese_facts.update(estado="seca", dias_lactacao=None, dias_ate_parto=45)
    dry, _ = select_profile(base, cheese_facts)
    assert not dry.get("adjustments")


@pytest.mark.parametrize(
    "breed,factor",
    [("Holandesa", 1), ("Girolando", 0.95), ("Gir Leiteiro", 0.88), ("Jersey", 1.05)],
)
def test_metabolic_breed_factors_are_explicit_and_not_attributed_to_nasem(
    breed, factor
):
    request = CmsRequest(
        peso_kg=650,
        dias_lactacao=100,
        escore_corporal=3,
        fracao_multiparas=1,
        energia_leite_mcal_dia=25,
        raca=breed,
        estado="lactacao",
    )
    result = estimate_intake(request)
    assert result["status"] == "estimado"
    assert result["adjusted_metabolic_weight"] == pytest.approx(factor * 650**0.75)
    assert result["equivalent_body_weight_kg"] == pytest.approx(
        (factor * 650**0.75) ** (1 / 0.75)
    )
    assert (result["equation_id"] == "NASEM2021-2-1") == (breed == "Holandesa")
    if breed != "Holandesa":
        assert result["source_url"] is None
        assert result["scientific_status"] == "experimental_nao_validado"


@pytest.mark.parametrize("days", [22, 45, 100])
def test_dry_intake_range_does_not_require_milk(days):
    result = estimate_intake(
        CmsRequest(
            peso_kg=600,
            dias_ate_parto=days,
            escore_corporal=3,
            fracao_multiparas=1,
            raca="Gir Leiteiro",
            estado="seca",
        )
    )
    assert result["cms_range_kg_dia"] == pytest.approx([11.82, 12.6])
    assert result["cms_kg_dia"] == pytest.approx(12.21)
    assert "milk_energy_mcal_dia" not in result


@pytest.mark.parametrize("days", [1, 21])
def test_transition_intake_is_blocked(days):
    result = estimate_intake(
        CmsRequest(
            peso_kg=600,
            dias_ate_parto=days,
            escore_corporal=3,
            fracao_multiparas=1,
            raca="Holandesa",
            estado="seca",
        )
    )
    assert result["cms_kg_dia"] is None


@pytest.mark.parametrize(
    "source,weight", [("laboratorio", 1), ("tabela", 0.85), ("usuario", 0.70)]
)
def test_source_default_and_ceiling(source, weight):
    assert FactEvidence(source=source).cf == weight
    if weight < 1:
        with pytest.raises(ValueError):
            FactEvidence(source=source, cf=1)


def test_sources_are_weighted_by_active_dry_matter_and_frozen(client):
    payload = request_for(client)
    for n, item in enumerate(payload["itens"]):
        item["evidencia_composicao"] = {
            "source": ["laboratorio", "tabela", "usuario"][n % 3]
        }
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["totals"]
    composition = result["reasoning"]["composition_evidence"]
    expected = sum(i["weight"] * i["cf"] for i in composition["items"])
    assert composition["cf"] == pytest.approx(expected)
    assert sum(i["weight"] for i in composition["items"]) == pytest.approx(1)
    assert all(i["kg_ms"] > 0 for i in composition["items"])
    assert result["global_cf"] == pytest.approx(
        min(result["reasoning"]["memory"]["perfil_selecionado"]["cf"], expected) * 0.95
    )
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_growth_and_cheese_api_and_audit(client):
    payload = request_for(client)
    lot = client.get("/api/lotes").json()[0]
    lot.pop("id")
    lot.update(
        nome="Primiparas queijo",
        idade_meses=30,
        ordem_paricao=1,
        destinacao_economica="queijo_artesanal",
        mantenca_pb_kg_dia=0.5,
        mantenca_el_mcal_dia=10,
        fonte_mantenca="Cenario sintetico",
    )
    payload["lote_id"] = client.post("/api/lotes", json=lot).json()["id"]
    result = client.post("/api/formular", json=payload)
    assert result.status_code == 200, result.text
    result = result.json()
    assert result["status"] == "atende_perfil_demo"
    assert len(result["reasoning"]["profile_adjustments"]) == 2
    trace = {r["id"]: r for r in result["trace"]}
    assert trace["PB-01"]["minimum"] == pytest.approx(18 + 0.10 * 0.5 / 24 * 100)
    assert trace["EL-01"]["minimum"] == pytest.approx(1.6 + 1 / 24)
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_growth_without_maintenance_returns_explained_missing_data(client):
    payload = request_for(client)
    lot = client.get("/api/lotes").json()[0]
    lot.pop("id")
    lot.update(nome="Jovens sem mantenca", idade_meses=30)
    payload["lote_id"] = client.post("/api/lotes", json=lot).json()["id"]
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "dados_insuficientes"
    assert result["global_cf"] is None and not result["items"]
    assert "mantenca_pb_kg_dia" in result["profile_trace"][-1]["missing_inputs"]
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_growth_conflicting_limits_are_not_relaxed(client):
    payload = request_for(client)
    lot = client.get("/api/lotes").json()[0]
    lot.pop("id")
    lot.update(
        nome="Limites conflitantes",
        idade_meses=30,
        mantenca_pb_kg_dia=5,
        mantenca_el_mcal_dia=10,
        fonte_mantenca="Entrada sintetica para inviabilidade",
    )
    payload["lote_id"] = client.post("/api/lotes", json=lot).json()["id"]
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "inviavel"
    assert result["global_cf"] is None and not result["items"]
    assert result["bottleneck"]["constraints"]


def test_dry_estimate_can_be_applied_and_frozen(client):
    from conftest import SCENARIOS

    payload = request_for(client, SCENARIOS[2])
    inputs = {
        "peso_kg": 550,
        "dias_ate_parto": 45,
        "escore_corporal": 3,
        "fracao_multiparas": 1,
        "raca": "Girolando",
        "estado": "seca",
    }
    estimate = client.post("/api/estimar-cms", json=inputs).json()
    payload.update(consumo_ms_kg=estimate["cms_kg_dia"], estimativa_cms=inputs)
    result = client.post("/api/formular", json=payload)
    assert result.status_code == 200, result.text
    session = client.get(f"/api/sessoes/{result.json()['session_id']}").json()
    assert (
        session["snapshot"]["cms_estimate"]["equation_id"] == "T2-SECA-EXPERIMENTAL-1"
    )


def test_unused_ingredient_has_no_weight_and_negative_used_evidence_blocks(client):
    payload = request_for(client)
    for item in payload["itens"]:
        item["evidencia_composicao"] = {"source": "laboratorio"}
    payload["itens"][1].update(
        maximo_kg_ms=0, evidencia_composicao={"source": "usuario", "cf": -0.5}
    )
    result = client.post("/api/formular", json=payload).json()
    assert result["reasoning"]["composition_evidence"]["cf"] == 1
    assert payload["itens"][1]["insumo_id"] not in {
        i["insumo_id"] for i in result["reasoning"]["composition_evidence"]["items"]
    }
    for item in payload["itens"]:
        item["evidencia_composicao"] = {"source": "usuario", "cf": -0.5}
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "dados_insuficientes" and result["global_cf"] is None
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_legacy_base_sessions_remain_auditable(client, monkeypatch):
    new_id = main.app.state.base_id
    old = json.loads(
        (Path(__file__).parents[1] / "rules/base_v0.2.0_original.json").read_text(
            encoding="utf-8"
        )
    )
    with main.SessionLocal() as db:
        record = BaseConhecimento(
            versao=old["version"], sha256=digest(old), conteudo=old
        )
        db.add(record)
        db.commit()
        old_id = record.id
    monkeypatch.setattr(main.app.state, "base_id", old_id)
    payload = request_for(client)
    result = client.post("/api/formular", json=payload).json()
    monkeypatch.setattr(main.app.state, "base_id", new_id)
    assert result["knowledge_version"] == "0.2.0"
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200
    assert (
        client.post("/api/formular", json=payload).json()["knowledge_version"]
        == "0.2.0+recalibracao.1"
    )


def test_sqlite_migration_preserves_old_lot_columns(tmp_path):
    from sqlalchemy import create_engine, text
    from app.database import Base, migrate_ownership

    engine = create_engine(f"sqlite:///{tmp_path / 'legacy.db'}")
    try:
        Base.metadata.create_all(engine)
        with engine.begin() as connection:
            for col in (
                "destinacao_economica",
                "mantenca_pb_kg_dia",
                "mantenca_el_mcal_dia",
                "fonte_mantenca",
            ):
                connection.execute(text(f'ALTER TABLE lotes DROP COLUMN "{col}"'))
        migrate_ownership(engine)
        migrate_ownership(engine)
        with engine.connect() as connection:
            cols = {r[1] for r in connection.execute(text("PRAGMA table_info(lotes)"))}
        assert {
            "destinacao_economica",
            "mantenca_pb_kg_dia",
            "mantenca_el_mcal_dia",
            "fonte_mantenca",
        } <= cols
    finally:
        engine.dispose()
