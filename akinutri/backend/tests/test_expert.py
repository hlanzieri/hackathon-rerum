import copy
import pytest
from app.engine_rules import forward_chain, combine_cf, load_base, select_profile
from conftest import request_for


def production(code, fact, value, conditions, cf=0.95, salience=0):
    return {
        "id": code,
        "conditions": [{"fact": k, "op": "eq", "value": v} for k, v in conditions],
        "assert": {"fact": fact, "value": value},
        "rule_cf": cf,
        "salience": salience,
    }


def test_three_rounds_cf_and_provenance():
    rules = [
        production("a", "phase", "transition", [("raw", True)]),
        production("b", "risk", "high", [("phase", "transition")]),
        production("c", "restriction", "review", [("risk", "high")]),
    ]
    result = forward_chain(
        {"inference_rules": rules},
        {"raw": True},
        {"raw": {"cf": 0.75, "source": "tabela"}},
    )
    assert not result["blocked"]
    assert result["memory"]["restriction"]["cf"] == pytest.approx(0.75 * 0.95**3)
    assert [x["round"] for x in result["steps"]] == [1, 2, 3]
    assert result["steps"][2]["premises"]["risk"]["rules"] == ["b"]


def test_conflict_specificity_and_salience():
    a = production("a", "answer", "first", [("raw", True)])
    b = production("b", "answer", "second", [("raw", True)])
    base = {"inference_rules": [a, b]}
    assert forward_chain(base, {"raw": True})["blocked"]
    b["salience"] = 1
    assert forward_chain(base, {"raw": True})["memory"]["answer"]["value"] == "second"
    a["conditions"].append({"fact": "extra", "op": "eq", "value": True})
    assert (
        forward_chain(base, {"raw": True, "extra": True})["memory"]["answer"]["value"]
        == "first"
    )


def test_cf_arithmetic_and_invalid_values():
    assert combine_cf(0.6, 0.4) == pytest.approx(0.76)
    assert combine_cf(-0.6, -0.4) == pytest.approx(-0.76)
    assert combine_cf(0.6, -0.4) == pytest.approx(1 / 3)
    for cf in [float("nan"), float("inf"), 1.1, -1.1, True]:
        with pytest.raises(ValueError):
            forward_chain({}, {"x": 1}, {"x": {"cf": cf}})
    with pytest.raises(ValueError):
        combine_cf(1, -1)
    rule = production("a", "y", 2, [("x", 1)])
    assert (
        "y"
        not in forward_chain(
            {"inference_rules": [rule]}, {"x": 1}, {"x": {"cf": -0.5}}
        )["memory"]
    )


def test_physiology_and_transition_block():
    base, _ = load_base()
    postpartum = forward_chain(base, {"estado": "lactacao", "dias_lactacao": 10})
    assert postpartum["memory"]["fase_fisiologica"]["value"] == "transicao_pos_parto"
    prenatal = forward_chain(
        base, {"estado": "seca", "dias_ate_parto": 15, "dcad_meq_100g": 10}
    )
    assert (
        prenatal["memory"]["restricao_transicao"]["value"]
        == "revisao_obrigatoria_dieta_anionica_e_calcio"
    )
    assert select_profile(base, {"estado": "seca", "dias_ate_parto": 15})[0] is None


def test_explanation_endpoints_and_cf_snapshot(client):
    payload = request_for(client)
    payload["evidence"] = {"composicao": {"cf": 0.6, "source": "tabela"}}
    response = client.post("/api/formular", json=payload)
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["reasoning"]["steps"]
    assert result["global_cf"] == pytest.approx(0.6 * 0.95)
    session = result["session_id"]
    assert client.get(f"/api/sessoes/{session}").status_code == 200
    assert (
        "FDN-01"
        in client.get(
            "/api/explicacao/por-que-pergunta?fato=particula_adequada"
        ).json()["message"]
    )
    for kind in ["por-que-perfil", "como-concluiu", "gargalo-formulacao"]:
        assert (
            client.get(f"/api/explicacao/{kind}?sessao_id={session}").status_code == 200
        )
        assert client.get(f"/api/explicacao/{kind}?sessao_id=99999").status_code == 404
    payload["evidence"]["composicao"]["cf"] = 2
    assert client.post("/api/formular", json=payload).status_code == 422


def test_infeasibility_iis_names_bounds(client):
    payload = request_for(client)
    for item in payload["itens"]:
        item["maximo_kg_ms"] = 0
    result = client.post("/api/formular", json=payload).json()
    conflict = result["bottleneck"]
    assert conflict["certified_irreducible"]
    assert any(c["id"].startswith("INCLUSAO-") for c in conflict["constraints"])
    assert any(c["id"] == "MS-01:igualdade" for c in conflict["constraints"])
    assert result["global_cf"] is None


def test_no_fabricated_review():
    base, _ = load_base()
    for rule in base["rules"] + base["inference_rules"] + base["profiles"]:
        assert rule["governance"]["status"] == "pendente_revisao_especialista"
        assert rule["governance"]["reviewed_by"] is None


def test_cycle_is_blocked_and_negative_evidence_not_used(client):
    base = {
        "inference_rules": [
            production("a", "derived", 1, [("raw", True)]),
            production("b", "derived", 2, [("derived", 1)], salience=1),
        ]
    }
    assert forward_chain(base, {"raw": True})["blocked"]
    payload = request_for(client)
    payload["evidence"] = {"composicao": {"cf": -0.5, "source": "tabela"}}
    result = client.post("/api/formular", json=payload).json()
    assert result["status"] == "dados_insuficientes"
    assert result["items"] == [] and result["global_cf"] is None
    assert client.get(f"/api/sessoes/{result['session_id']}").status_code == 200


def test_explanations_cannot_read_another_account_session(client):
    result = client.post("/api/formular", json=request_for(client)).json()
    assert client.post("/api/auth/logout").status_code == 204
    assert (
        client.get(
            "/api/explicacao/por-que-pergunta?fato=particula_adequada"
        ).status_code
        == 401
    )
    client.post(
        "/api/auth/register",
        json={
            "nome": "Outra conta",
            "email": "other@example.com",
            "senha": "senha-segura-123",
        },
    )
    assert (
        client.get(
            f"/api/explicacao/como-concluiu?sessao_id={result['session_id']}"
        ).status_code
        == 404
    )


def test_governance_validation_requires_documentary_evidence(tmp_path):
    base, _ = load_base()
    base["rules"][0]["governance"].update(
        status="validado_por_especialista",
        reviewed_by="Nome declarado",
        review_date="2026-10-21",
    )
    import json

    path = tmp_path / "base.json"
    path.write_text(json.dumps(base), encoding="utf-8")
    with pytest.raises(ValueError, match="evidencia"):
        load_base(path)
