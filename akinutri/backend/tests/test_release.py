"""Integration coverage for the guided wizard and saved price scenarios."""

import copy
import pytest
from conftest import request_for


def test_group_facts_drive_formula_audit_verification_and_mixing(client):
    request = request_for(client)
    group = client.get("/api/grupos-producao").json()[0]
    fields = {
        key: group[key]
        for key in (
            "nome",
            "fase",
            "descricao",
            "numero_animais",
            "del_medio",
            "peso_medio_kg",
            "producao_media_l_dia",
            "ecc_medio",
            "fracao_multiparas",
        )
    }
    fields.update(
        numero_animais=7, producao_media_l_dia=15, peso_medio_kg=500, del_medio=160
    )
    assert (
        client.put(f"/api/grupos-producao/{group['id']}", json=fields).status_code
        == 200
    )
    request["consumo_ms_kg"] = 16
    response = client.post("/api/formular", json=request)
    assert response.status_code == 200, response.text
    formula = response.json()
    assert formula["status"] == "atende_perfil_demo"
    assert formula["profile"] == "lactacao_moderada"
    assert formula["totals"]["custo_lote_dia"] == pytest.approx(
        formula["totals"]["custo_animal_dia"] * 7
    )
    saved = client.get(f"/api/sessoes/{formula['session_id']}")
    assert saved.status_code == 200, saved.text
    assert saved.json()["integrity"]["status"] == "verificada"
    for item in request["itens"]:
        item["quantidade_kg_mn"] = next(
            i["quantidade_kg_mn"]
            for i in formula["items"]
            if i["insumo_id"] == item["insumo_id"]
        )
    verified = client.post("/api/verificar", json=request)
    assert verified.status_code == 200, verified.text
    assert verified.json()["totals"] == formula["totals"]
    comparison = client.post(
        "/api/comparar",
        json={
            "manual_session_id": verified.json()["session_id"],
            "formulated_session_id": formula["session_id"],
            "dias": 30,
        },
    )
    assert comparison.status_code == 200, comparison.text
    assert comparison.json()["quantidade_animais"] == 7
    assert comparison.json()["economia_periodo"] == 0
    mixing = client.post(
        f"/api/sessoes/{formula['session_id']}/batida", json={"batidas_dia": 2}
    )
    assert mixing.status_code == 200, mixing.text
    assert mixing.json()["animais"] == 7
    fields.update(numero_animais=8, producao_media_l_dia=35)
    assert (
        client.put(f"/api/grupos-producao/{group['id']}", json=fields).status_code
        == 200
    )
    historical = client.get(f"/api/sessoes/{formula['session_id']}")
    assert historical.status_code == 200
    assert historical.json()["snapshot"]["grupo"]["numero_animais"] == 7


def test_price_and_unavailability_scenarios_save_separate_audited_sessions(client):
    request = request_for(client)
    initial = client.post("/api/formular", json=request)
    assert initial.status_code == 200, initial.text
    initial_id = initial.json()["session_id"]
    saved = client.get(f"/api/sessoes/{initial_id}").json()
    catalog = client.get("/api/insumos").json()
    corn = next(i for i in catalog if i["nome"] == "Milho Moído Seco")
    soy = next(i for i in catalog if i["nome"] == "Farelo de Soja 46")
    for target, factor in ((corn, 1.2), (soy, 0.85)):
        scenario = copy.deepcopy(saved["snapshot"]["request"])
        for item in scenario["itens"]:
            original = next(i for i in catalog if i["id"] == item["insumo_id"])
            item["preco_kg_mn"] = original["preco_kg_mn"] * (
                factor if original["id"] == target["id"] else 1
            )
        response = client.post("/api/formular", json=scenario)
        assert response.status_code == 200, response.text
        assert response.json()["status"] == "atende_perfil_demo"
        details = client.get(f"/api/sessoes/{response.json()['session_id']}")
        assert details.status_code == 200, details.text
        assert details.json()["integrity"]["status"] == "verificada"
        assert next(
            i for i in details.json()["snapshot"]["insumos"] if i["id"] == target["id"]
        )["preco_kg_mn"] == pytest.approx(target["preco_kg_mn"] * factor)
    unavailable = copy.deepcopy(saved["snapshot"]["request"])
    unavailable["itens"] = [
        i for i in unavailable["itens"] if i["insumo_id"] != soy["id"]
    ]
    response = client.post("/api/formular", json=unavailable)
    assert response.status_code == 200, response.text
    assert response.json()["session_id"] != initial_id
    assert (
        client.get(f"/api/sessoes/{response.json()['session_id']}").status_code == 200
    )
    assert client.get(f"/api/sessoes/{initial_id}").json() == saved
    assert client.get("/api/insumos").json() == catalog


def test_formulation_requires_group_and_comparison_rejects_different_groups(client):
    request = request_for(client)
    invalid = {key: value for key, value in request.items() if key != "grupo_id"}
    assert client.post("/api/formular", json=invalid).status_code == 422
    formula = client.post("/api/formular", json=request).json()
    for item in invalid["itens"]:
        item["quantidade_kg_mn"] = next(
            i["quantidade_kg_mn"]
            for i in formula["items"]
            if i["insumo_id"] == item["insumo_id"]
        )
    manual = client.post("/api/verificar", json=invalid).json()
    response = client.post(
        "/api/comparar",
        json={
            "manual_session_id": manual["session_id"],
            "formulated_session_id": formula["session_id"],
            "dias": 30,
        },
    )
    assert response.status_code == 409


@pytest.mark.parametrize("scenario_index", [0, 1, 2])
def test_formulation_from_scratch_without_ration_quantities(client, scenario_index):
    from conftest import SCENARIOS

    payload = request_for(client, SCENARIOS[scenario_index])
    assert all("quantidade_kg_mn" not in item for item in payload["itens"])
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "atende_perfil_demo"
    assert result["items"] and result["shadow_prices"]
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_empty_verification_is_rejected_even_outside_supported_profile(client):
    payload = request_for(client)
    payload["particula_adequada"] = False
    response = client.post("/api/verificar", json=payload)
    assert response.status_code == 422


def test_verification_identifies_missing_minerals_and_protein(client):
    request = request_for(client)
    ingredient_id = request["itens"][0]["insumo_id"]
    ingredient = next(i for i in client.get("/api/insumos").json() if i["id"] == ingredient_id)
    payload = {key: value for key, value in ingredient.items() if key != "id"}
    payload.update(ca_pct=None, p_pct=None, pb_pct=None)
    created = client.post("/api/insumos", json=payload)
    assert created.status_code == 201, created.text
    ingredient_id = created.json()["id"]
    request["itens"][0].update(insumo_id=ingredient_id, quantidade_kg_mn=20)
    response = client.post("/api/verificar", json=request)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["status"] == "dados_insuficientes"
    pending = next(i for i in result["insumos_incompletos"] if i["insumo_id"] == ingredient_id)
    assert {"Cálcio", "Fósforo", "PB"}.issubset(pending["nutrientes_faltantes"])
