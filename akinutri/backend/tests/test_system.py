import copy
import pytest
from app.engine_rules import load_base, totals, evaluate
from app.engine_solver import solve
from conftest import SCENARIOS, request_for


@pytest.mark.parametrize("scenario", SCENARIOS, ids=["holandesa", "gir", "seca"])
def test_scenarios_optimal_reproducible_and_reverified(client, scenario):
    payload = request_for(client, scenario)
    first = client.post("/api/formular", json=payload)
    assert first.status_code == 200, first.text
    result = first.json()
    assert result["status"] == "atende_perfil_demo", result
    assert result["profile"] == scenario[-1]
    assert result["solver"]["numeric_status"] == 0
    assert result["totals"]["ms_kg"] == pytest.approx(scenario[-2], abs=1e-7)
    assert all(t["status"] == "atendida" for t in result["trace"])
    second = client.post("/api/formular", json=payload).json()
    assert result["items"] == second["items"]
    assert result["totals"] == second["totals"]
    for item in payload["itens"]:
        item["quantidade_kg_mn"] = next(
            x["quantidade_kg_mn"]
            for x in result["items"]
            if x["insumo_id"] == item["insumo_id"]
        )
    verified = client.post("/api/verificar", json=payload).json()
    assert verified["status"] == "atende_perfil_demo"
    assert verified["totals"] == result["totals"]


def test_infeasible_not_relaxed(client):
    payload = request_for(client)
    for item in payload["itens"]:
        item["maximo_kg_ms"] = 0
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "inviavel"
    assert result["totals"] is None
    assert result["items"] == []


def test_missing_composition_not_assumed_zero(client):
    payload = request_for(client)
    ingredient = client.get("/api/insumos").json()[0]
    id = ingredient.pop("id")
    ingredient["pb_pct"] = None
    assert client.put(f"/api/insumos/{id}", json=ingredient).status_code == 200
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "dados_insuficientes"
    payload["itens"][0]["quantidade_kg_mn"] = 40
    verified = client.post("/api/verificar", json=payload).json()
    assert verified["totals"]["pb_pct"] is None
    assert (
        next(t for t in verified["trace"] if t["id"] == "PB-01")["status"]
        == "dados_insuficientes"
    )


@pytest.mark.parametrize(
    "condition,value",
    [
        ("particula_adequada", None),
        ("milho_seco_predominante", False),
        ("sistema", "outro"),
    ],
)
def test_unsupported_management(client, condition, value):
    payload = request_for(client)
    payload[condition] = value
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "fora_escopo"
    assert result["profile_trace"]


def test_closeup_not_treated_as_faroff(client):
    scenario = list(SCENARIOS[2])
    scenario[6] = 20
    payload = request_for(client, scenario)
    assert client.post("/api/formular", json=payload).json()["status"] == "fora_escopo"


def test_snapshot_remains_after_price_change(client):
    payload = request_for(client)
    result = client.post("/api/formular", json=payload).json()
    before = client.get(f"/api/sessoes/{result['session_id']}").json()
    ingredient = client.get("/api/insumos").json()[0]
    id = ingredient.pop("id")
    ingredient["preco_kg_mn"] = 999
    client.put(f"/api/insumos/{id}", json=ingredient)
    after = client.get(f"/api/sessoes/{result['session_id']}").json()
    assert before == after
    assert after["snapshot"]["base_sha256"] == result["knowledge_sha256"]
    assert after["snapshot"]["base"]["version"] == "0.1.0"


@pytest.mark.parametrize(
    "mutate",
    [
        lambda p: p.update(consumo_ms_kg=0),
        lambda p: p.update(itens=[]),
        lambda p: p["itens"].append(p["itens"][0].copy()),
        lambda p: p["itens"][0].update(minimo_kg_ms=10, maximo_kg_ms=1),
        lambda p: p["itens"][0].update(quantidade_kg_mn=-1),
        lambda p: p.update(sistema="invalid"),
    ],
)
def test_invalid_input(client, mutate):
    payload = request_for(client)
    mutate(payload)
    assert client.post("/api/formular", json=payload).status_code == 422


def test_missing_foreign_key_and_empty_diet(client):
    payload = request_for(client)
    assert client.post("/api/verificar", json=payload).status_code == 422
    payload["lote_id"] = 999
    assert client.post("/api/formular", json=payload).status_code == 404
    assert client.get("/api/sessoes/999").status_code == 404


def test_dry_with_milk_rejected(client):
    payload = {
        "nome": "Inconsistente",
        "raca_id": 1,
        "quantidade": 1,
        "peso_kg": 500,
        "idade_meses": 48,
        "ordem_paricao": 2,
        "estado": "seca",
        "producao_l_dia": 10,
        "dias_ate_parto": 40,
    }
    assert client.post("/api/lotes", json=payload).status_code == 422


def test_matter_conversion_and_forage_denominator():
    i = {
        "ms_pct": 50,
        "categoria": "volumoso",
        "preco_kg_mn": 2,
        "pb_pct": 10,
        "fdn_pct": 40,
        "amido_pct": 20,
        "el_mcal_kg": 1.5,
        "ca_pct": 1,
        "p_pct": 0.3,
    }
    c = {**i, "categoria": "concentrado", "fdn_pct": 10, "ms_pct": 100}
    t = totals([i, c], [10, 5])
    assert t["ms_kg"] == 10
    assert t["fdn_pct"] == 25
    assert t["fdn_volumoso_pct"] == 20
    assert t["custo_animal_dia"] == 30


def test_json_change_controls_evaluator():
    base, _ = load_base()
    profile = copy.deepcopy(base["profiles"][0])
    values = {
        r["metric"]: sum(profile["limits"][r["metric"]]) / 2 for r in base["rules"]
    }
    values["ms_kg"] = 24
    assert evaluate(base, profile, values, 24)[0] == "atende_perfil_demo"
    profile["limits"]["pb_pct"] = [30, 40]
    assert evaluate(base, profile, values, 24)[0] == "restricoes_violadas"


def test_solver_known_optimum_and_rule_change():
    base, _ = load_base()
    profile = copy.deepcopy(base["profiles"][0])
    ingredient = {
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
    expensive = {**ingredient, "nome": "Caro", "preco_kg_mn": 3}
    items = [{"minimo_kg_ms": 0, "maximo_kg_ms": 40}] * 2
    result = solve(base, profile, [ingredient, expensive], items, 24)
    assert result["objective_value"] == pytest.approx(24)
    assert result["quantities"] == pytest.approx([24, 0])
    assert result["optimization_trace"][1][
        "marginal_minimo_brl_kg_ms"
    ] == pytest.approx(2)
    profile["limits"]["pb_pct"] = [20, 25]
    assert (
        solve(base, profile, [ingredient, expensive], items, 24)["status"] == "inviavel"
    )


def test_inclusion_limits_verification(client):
    payload = request_for(client)
    payload["itens"][0].update(quantidade_kg_mn=40, maximo_kg_ms=1)
    result = client.post("/api/verificar", json=payload).json()
    assert (
        next(t for t in result["trace"] if t["id"] == "INCLUSAO-1")["status"]
        == "violada"
    )


def test_health_and_catalog_conflict(client):
    assert client.get("/api/health").json()["engine"] == "deterministic"
    ingredient = client.get("/api/insumos").json()[0]
    ingredient.pop("id")
    assert client.post("/api/insumos", json=ingredient).status_code == 409
