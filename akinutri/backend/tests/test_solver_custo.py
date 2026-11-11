import pytest

from app.engine_intake import estimate_intake
from app.engine_rules import evaluate, load_base, select_profile, totals
from app.engine_solver import solve
from app.schemas import CmsRequest
from app.seed import INSUMOS_SEED, ingredient_values


def test_custo_lote_1_alta_lactacao():
    base, _ = load_base()
    profile, _ = select_profile(
        base,
        dict(
            estado="lactacao",
            producao_l_dia=35,
            dias_lactacao=100,
            sistema="tmr",
            particula_adequada=True,
            milho_seco_predominante=True,
        ),
    )
    assert profile["id"] == "lactacao_alta"
    intake = estimate_intake(
        CmsRequest(
            peso_kg=650,
            dias_lactacao=100,
            escore_corporal=3,
            fracao_multiparas=1,
            leite_corrigido_kg_dia=35,
            energia_referencia_mcal_kg=0.7,
            raca="Holandesa",
            estado="lactacao",
        )
    )["cms_kg_dia"]
    assert intake == pytest.approx(23.455, abs=0.001)

    ingredients = [ingredient_values(item) for item in INSUMOS_SEED]
    silage = ingredients[0]
    # Scenario price in R$/kg MN. The catalog remains an independent dataset.
    silage["preco_kg_mn"] = 0.30
    ingredients.append(
        dict(silage, nome="Silagem mais umida", ms_pct=25.0, preco_kg_mn=0.27)
    )
    items = [
        {"maximo_kg_ms": 0.5 if item["categoria"] == "mineral" else 40}
        for item in ingredients
    ]
    solution = solve(base, profile, ingredients, items, intake)
    assert solution["status"] == "otimo", solution["message"]
    assert solution["quantities"][0] > 0
    assert solution["quantities"][-1] == pytest.approx(0.0)

    values = totals(ingredients, solution["quantities"])
    assert values["ms_kg"] == pytest.approx(intake)
    assert evaluate(base, profile, values, intake)[0] == "atende_perfil_demo"
    assert solution["objective_value"] == pytest.approx(values["custo_animal_dia"])
    assert 14.0 < values["custo_animal_dia"] < 32.0
