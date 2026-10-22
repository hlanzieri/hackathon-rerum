import copy
import hashlib
import json
import math
from html.parser import HTMLParser
import pytest
from sqlalchemy import text
from app.engine_rules import load_base, canonical
from app.engine_solver import solve
from conftest import request_for


def test_api_documentation_assets_work_without_external_cdn(client):
    class Assets(HTMLParser):
        def __init__(self):
            super().__init__()
            self.urls = []

        def handle_starttag(self, tag, attributes):
            attrs = dict(attributes)
            if tag == "script" and attrs.get("src"):
                self.urls.append(attrs["src"])
            if tag == "link" and attrs.get("rel") == "stylesheet":
                self.urls.append(attrs["href"])

    response = client.get("/docs")
    assert response.status_code == 200
    assets = Assets()
    assets.feed(response.text)
    assert assets.urls
    for url in assets.urls:
        assert url.startswith("/"), f"Asset externo impede documentacao offline: {url}"
        assert client.get(url).status_code == 200
    operations = [
        operation["operationId"]
        for path in client.get("/openapi.json").json()["paths"].values()
        for operation in path.values()
        if isinstance(operation, dict) and "operationId" in operation
    ]
    assert len(operations) == len(set(operations))


def test_nasem_equation_and_inputs_are_explained(client):
    response = client.post(
        "/api/estimar-cms",
        json={
            "peso_kg": 650,
            "dias_lactacao": 100,
            "escore_corporal": 3,
            "fracao_multiparas": 1,
            "energia_leite_mcal_dia": 25,
            "raca": "Holandesa",
            "estado": "lactacao",
        },
    )
    assert response.status_code == 200
    data = response.json()
    expected = (3.7 + 5.7 + 0.305 * 25 + 0.022 * 650 + (-0.689 - 1.87) * 3) * (
        1 - (0.212 + 0.136) * math.exp(-0.053 * 100)
    )
    assert data["cms_kg_dia"] == pytest.approx(expected)
    assert data["equation_id"] == "NASEM2021-2-1"
    assert data["inputs"]["escore_corporal"] == 3
    assert data["source_url"].startswith("https://www.ncbi.nlm.nih.gov/")


def test_energy_corrected_milk_has_explicit_reference(client):
    body = {
        "peso_kg": 650,
        "dias_lactacao": 100,
        "escore_corporal": 3,
        "fracao_multiparas": 1,
        "leite_corrigido_kg_dia": 35,
        "energia_referencia_mcal_kg": 0.7,
        "raca": "Holandesa",
        "estado": "lactacao",
    }
    result = client.post("/api/estimar-cms", json=body)
    assert result.status_code == 200
    assert result.json()["milk_energy_mcal_dia"] == pytest.approx(24.5)
    body["energia_leite_mcal_dia"] = 25
    assert client.post("/api/estimar-cms", json=body).status_code == 422


def test_applied_estimate_is_recomputed_and_preserved(client):
    body = request_for(client)
    estimate_inputs = {
        "peso_kg": 650,
        "dias_lactacao": 100,
        "escore_corporal": 3,
        "fracao_multiparas": 1,
        "energia_leite_mcal_dia": 25,
        "raca": "Holandesa",
        "estado": "lactacao",
    }
    estimate = client.post("/api/estimar-cms", json=estimate_inputs).json()
    body.update(consumo_ms_kg=estimate["cms_kg_dia"], estimativa_cms=estimate_inputs)
    result = client.post("/api/formular", json=body)
    assert result.status_code == 200
    session = client.get(f"/api/sessoes/{result.json()['session_id']}").json()
    assert (
        session["snapshot"]["cms_estimate"]["model_sha256"] == estimate["model_sha256"]
    )
    estimate_inputs["peso_kg"] = 400
    assert client.post("/api/formular", json=body).status_code == 422


@pytest.mark.parametrize(
    "change", [{"raca": "Raca sem modelo"}, {"dias_lactacao": 400}]
)
def test_estimator_does_not_claim_unsupported_population(client, change):
    body = {
        "peso_kg": 650,
        "dias_lactacao": 100,
        "escore_corporal": 3,
        "fracao_multiparas": 1,
        "energia_leite_mcal_dia": 25,
        "raca": "Holandesa",
        "estado": "lactacao",
        **change,
    }
    response = client.post("/api/estimar-cms", json=body)
    assert response.status_code == 200
    assert response.json()["status"] == "fora_escopo"
    assert response.json()["cms_kg_dia"] is None


def formulate_and_verify(client):
    payload = request_for(client)
    formula = client.post("/api/formular", json=payload).json()
    for item in payload["itens"]:
        item["quantidade_kg_mn"] = next(
            i["quantidade_kg_mn"]
            for i in formula["items"]
            if i["insumo_id"] == item["insumo_id"]
        )
    manual = client.post("/api/verificar", json=payload).json()
    return payload, formula, manual


def test_price_override_audited_without_changing_catalog(client):
    body = request_for(client)
    before = client.get("/api/insumos").json()[0]
    body["itens"][0]["preco_kg_mn"] = 1.8
    result = client.post("/api/formular", json=body)
    assert result.status_code == 200
    session = client.get(f"/api/sessoes/{result.json()['session_id']}").json()
    assert session["snapshot"]["insumos"][0]["preco_kg_mn"] == 1.8
    assert client.get("/api/insumos").json()[0] == before


def test_snapshot_and_trace_integrity_proof(client):
    _, formula, _ = formulate_and_verify(client)
    session = client.get(f"/api/sessoes/{formula['session_id']}").json()
    assert session["integrity"]["status"] == "verificada"
    assert (
        session["result"]["audit"]["snapshot_sha256"]
        == hashlib.sha256(canonical(session["snapshot"]).encode()).hexdigest()
    )


def test_snapshot_updates_blocked_at_database(client):
    from app import main

    _, formula, _ = formulate_and_verify(client)
    with main.SessionLocal() as db:
        with pytest.raises(Exception, match="imutavel"):
            db.execute(
                text("UPDATE sessoes_inferencia SET snapshot = :s WHERE id = :id"),
                {"s": "{}", "id": formula["session_id"]},
            )
            db.commit()


def test_tampered_base_is_rejected_before_inference(client):
    from app import main
    from app.models import BaseConhecimento

    body = request_for(client)
    # ORM object tampering is simulated in memory: integrity check must detect it.
    from app.audit import verify_base

    with main.SessionLocal() as db:
        base = db.get(BaseConhecimento, main.app.state.base_id)
        corrupted = copy.deepcopy(base.conteudo)
        corrupted["profiles"][0]["limits"]["pb_pct"] = [1, 2]
        with pytest.raises(ValueError, match="integridade"):
            verify_base(corrupted, base.sha256)


def test_comparison_zero_delta_and_context_checks(client):
    body, formula, manual = formulate_and_verify(client)
    request = {
        "manual_session_id": manual["session_id"],
        "formulated_session_id": formula["session_id"],
        "dias": 30,
    }
    response = client.post("/api/comparar", json=request)
    assert response.status_code == 200
    data = response.json()
    assert data["economia_lote_dia"] == pytest.approx(0, abs=1e-7)
    assert data["economia_periodo"] == pytest.approx(0, abs=1e-5)
    body["itens"][0]["preco_kg_mn"] = 9
    other = client.post("/api/formular", json=body).json()
    request["formulated_session_id"] = other["session_id"]
    assert client.post("/api/comparar", json=request).status_code == 409


def test_mixing_totals_and_user_order(client):
    _, formula, _ = formulate_and_verify(client)
    active = [i["insumo_id"] for i in formula["items"] if i["quantidade_kg_mn"] > 1e-8]
    response = client.post(
        f"/api/sessoes/{formula['session_id']}/batida",
        json={"batidas_dia": 2, "ordem_insumos": list(reversed(active))},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["items"][0]["insumo_id"] == active[-1]
    from app.reports import round_to_scale

    expected = sum(
        round_to_scale(i["quantidade_kg_mn"] * 25 / 2, data["resolucao_balanca_kg"])
        for i in formula["items"]
    )
    assert data["total_kg_mn_dia"] == pytest.approx(expected * 2)
    assert data["total_kg_mn_batida"] * 2 == pytest.approx(data["total_kg_mn_dia"])
    assert sum(i["kg_mn_batida"] for i in data["items"]) == pytest.approx(
        data["total_kg_mn_batida"]
    )
    assert (
        client.post(
            f"/api/sessoes/{formula['session_id']}/batida",
            json={"batidas_dia": 2, "capacidade_kg": 1},
        ).status_code
        == 422
    )


def test_shadow_prices_match_perturbed_objective():
    base, _ = load_base()
    profile = copy.deepcopy(base["profiles"][0])
    ingredient = {
        "id": 1,
        "nome": "Completo",
        "ms_pct": 100,
        "categoria": "volumoso",
        "preco_kg_mn": 1,
        "pb_pct": 18,
        "fdn_pct": 30,
        "amido_pct": 25,
        "el_mcal_kg": 1.7,
        "ca_pct": 0.8,
        "p_pct": 0.4,
    }
    result = solve(
        base, profile, [ingredient], [{"minimo_kg_ms": 0, "maximo_kg_ms": 40}], 24
    )
    assert result["shadow_prices"]["equalities"][0][
        "marginal_brl_per_rhs_unit"
    ] == pytest.approx(1)
    assert result["shadow_prices"]["equalities"][0]["binding"] is True
    for row in result["shadow_prices"]["inequalities"]:
        assert row["binding"] == (abs(row["slack"]) <= base["numeric_tolerance"])
    perturbed = solve(
        base, profile, [ingredient], [{"minimo_kg_ms": 0, "maximo_kg_ms": 40}], 24.001
    )
    assert perturbed["objective_value"] - result["objective_value"] == pytest.approx(
        0.001
    )
