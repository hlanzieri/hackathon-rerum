from datetime import date, timedelta

import pytest

from app import main
from app.models import Animal, GrupoProducao, HistoricoDietaGP
from conftest import request_for


def create_group(client, name="Bezerras", phase="bezerril"):
    response = client.post(
        "/api/grupos-producao",
        json={"nome": name, "fase": phase, "descricao": "Grupo de teste"},
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_animal(client, group_id, start_date=None):
    response = client.post(
        "/api/animais",
        json={
            "brinco": "AN-001",
            "nome": "Mimosa",
            "data_nascimento": (date.today() - timedelta(days=120)).isoformat(),
            "sexo": "femea",
            "grupo_producao_id": group_id,
            "data_inicio_gp": (start_date or date.today()).isoformat(),
        },
    )
    assert response.status_code == 201, response.text
    return response.json()


def create_formula(client):
    response = client.post("/api/formular", json=request_for(client))
    assert response.status_code == 200, response.text
    assert response.json()["status"] == "atende_perfil_demo"
    return response.json()


def test_group_and_animal_crud_tracks_current_group_and_archives(client):
    group = create_group(client)
    animal = create_animal(client, group["id"])

    listed_groups = client.get("/api/grupos-producao").json()
    listed_animals = client.get("/api/animais").json()
    assert listed_groups[0]["id"] == group["id"]
    assert listed_animals[0]["grupo_producao"]["fase"] == "bezerril"

    updated_group = client.put(
        f"/api/grupos-producao/{group['id']}",
        json={"nome": "Recria 1", "fase": "recria", "descricao": None},
    )
    updated_animal = client.put(
        f"/api/animais/{animal['id']}",
        json={
            "brinco": "AN-002",
            "nome": "Mimosa II",
            "data_nascimento": animal["data_nascimento"],
            "sexo": "femea",
        },
    )
    assert updated_group.status_code == 200
    assert updated_group.json()["fase"] == "recria"
    assert updated_animal.status_code == 200
    assert updated_animal.json()["brinco"] == "AN-002"
    lifecycle = client.get(
        f"/api/animais/{animal['id']}/historico-nutricional"
    ).json()
    assert lifecycle["linha_tempo"][0]["grupo_producao"]["fase"] == "bezerril"

    assert client.delete(f"/api/animais/{animal['id']}").status_code == 204
    assert client.get("/api/animais").json() == []
    assert client.get("/api/animais?include_inativos=true").json()[0]["ativo"] is False
    assert client.delete(f"/api/grupos-producao/{group['id']}").status_code == 204
    assert client.get("/api/grupos-producao").json() == []
    assert client.get("/api/grupos-producao?include_inativos=true").json()[0]["ativo"] is False


def test_animal_movement_closes_previous_group_and_rejects_invalid_move(client):
    first_group = create_group(client)
    second_group = create_group(client, "Lactação", "lactacao")
    animal = create_animal(client, first_group["id"], date.today() - timedelta(days=10))
    movement_date = date.today() - timedelta(days=2)

    moved = client.post(
        f"/api/animais/{animal['id']}/movimentacoes",
        json={"grupo_producao_id": second_group["id"], "data_inicio": movement_date.isoformat()},
    )
    assert moved.status_code == 201, moved.text
    assert moved.json()["data_inicio"] == movement_date.isoformat()
    history = client.get(
        f"/api/animais/{animal['id']}/historico-nutricional"
    ).json()
    assert [entry["grupo_producao"]["nome"] for entry in history["linha_tempo"]] == [
        first_group["nome"],
        second_group["nome"],
    ]
    assert history["movimentacoes"][0]["data_fim"] == (
        movement_date - timedelta(days=1)
    ).isoformat()

    duplicate = client.post(
        f"/api/animais/{animal['id']}/movimentacoes",
        json={"grupo_producao_id": second_group["id"], "data_inicio": date.today().isoformat()},
    )
    assert duplicate.status_code == 409


def test_assign_diet_requires_a_successful_saved_formulation(client):
    group = create_group(client)
    formula = create_formula(client)
    manual_payload = request_for(client)
    quantities = {
        item["insumo_id"]: item["quantidade_kg_mn"] for item in formula["items"]
    }
    for item in manual_payload["itens"]:
        item["quantidade_kg_mn"] = quantities[item["insumo_id"]]
    manual_response = client.post("/api/verificar", json=manual_payload)
    assert manual_response.status_code == 200, manual_response.text
    manual = manual_response.json()
    invalid = client.post(
        f"/api/grupos-producao/{group['id']}/atribuir-dieta",
        json={"sessao_id": manual["session_id"], "data_inicio": date.today().isoformat()},
    )
    nonexistent = client.post(
        f"/api/grupos-producao/{group['id']}/atribuir-dieta",
        json={"sessao_id": 9999, "data_inicio": date.today().isoformat()},
    )

    assert invalid.status_code == 422
    assert nonexistent.status_code == 404


def test_diet_history_and_animal_timeline_accumulate_cost_across_groups(client):
    first_group = create_group(client)
    second_group = create_group(client, "Lactação", "lactacao")
    today = date.today()
    animal = create_animal(client, first_group["id"], today - timedelta(days=15))
    formula_one = create_formula(client)
    formula_two = create_formula(client)
    formula_three = create_formula(client)

    def assign(group_id, formula, start):
        return client.post(
            f"/api/grupos-producao/{group_id}/atribuir-dieta",
            json={"sessao_id": formula["session_id"], "data_inicio": start.isoformat()},
        )

    starts = [today - timedelta(days=10), today - timedelta(days=5)]
    first_assignment = assign(first_group["id"], formula_one, starts[0])
    second_assignment = assign(first_group["id"], formula_two, starts[1])
    transfer_date = today - timedelta(days=3)
    movement = client.post(
        f"/api/animais/{animal['id']}/movimentacoes",
        json={
            "grupo_producao_id": second_group["id"],
            "data_inicio": transfer_date.isoformat(),
        },
    )
    third_assignment = assign(second_group["id"], formula_three, today - timedelta(days=2))
    assert first_assignment.status_code == second_assignment.status_code == 201
    assert movement.status_code == third_assignment.status_code == 201

    gp_history = client.get("/api/grupos-producao").json()
    assert next(gp for gp in gp_history if gp["id"] == first_group["id"])["dieta_ativa"] == formula_two["session_id"]
    with main.SessionLocal() as db:
        first_diet = db.query(HistoricoDietaGP).filter_by(sessao_id=formula_one["session_id"]).one()
        assert first_diet.data_fim == starts[1] - timedelta(days=1)

    response = client.get(f"/api/animais/{animal['id']}/historico-nutricional")
    assert response.status_code == 200, response.text
    history = response.json()
    timeline = history["linha_tempo"]
    assert [period["grupo_producao"]["id"] for period in timeline] == [
        first_group["id"],
        first_group["id"],
        first_group["id"],
        second_group["id"],
        second_group["id"],
    ]
    assert [period["dias"] for period in timeline] == [5, 5, 2, 1, 3]
    assert [period["dieta"]["sessao_id"] if period["dieta"] else None for period in timeline] == [
        None,
        formula_one["session_id"],
        formula_two["session_id"],
        None,
        formula_three["session_id"],
    ]
    assert timeline[-1]["dieta"]["ingredientes"]
    assert timeline[-1]["dieta"]["ingredientes"][0]["nome"]
    expected_total = (
        formula_one["totals"]["custo_animal_dia"] * 5
        + formula_two["totals"]["custo_animal_dia"] * 2
        + formula_three["totals"]["custo_animal_dia"] * 3
    )
    assert history["custo_diario_acumulado"] == pytest.approx(expected_total, abs=0.01)
    assert timeline[-1]["custo_acumulado"] == pytest.approx(expected_total, abs=0.01)


def test_group_and_animal_reject_bad_fields_and_duplicate_identifiers(client):
    invalid_group = client.post(
        "/api/grupos-producao",
        json={"nome": "Inválido", "fase": "desconhecida"},
    )
    group = create_group(client)
    animal = create_animal(client, group["id"])
    duplicate_animal = client.post(
        "/api/animais",
        json={
            "brinco": animal["brinco"],
            "nome": "Outra",
            "data_nascimento": animal["data_nascimento"],
            "sexo": "femea",
            "grupo_producao_id": group["id"],
        },
    )
    assert invalid_group.status_code == 422
    assert duplicate_animal.status_code == 409
