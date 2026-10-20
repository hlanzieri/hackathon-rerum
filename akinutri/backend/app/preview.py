"""Publish a finite, reproducible demo; no database access or browser-side nutrition."""

import json
from pathlib import Path
from .engine_rules import load_base, select_profile, totals, evaluate
from .engine_solver import solve
from .engine_intake import estimate_intake
from .schemas import CmsRequest
from .seed import SEED


def build_preview():
    base, digest = load_base()
    keys = [
        "nome",
        "categoria",
        "ms_pct",
        "pb_pct",
        "fdn_pct",
        "amido_pct",
        "el_mcal_kg",
        "ca_pct",
        "p_pct",
        "preco_kg_mn",
    ]
    ingredients = [dict(zip(keys, row), id=n + 1) for n, row in enumerate(SEED)]
    items = [
        dict(
            insumo_id=i["id"],
            minimo_kg_ms=0,
            maximo_kg_ms=0.5 if i["categoria"] == "mineral" else 40,
        )
        for i in ingredients
    ]
    assumptions = dict(
        estado="lactacao",
        producao_l_dia=35,
        dias_lactacao=100,
        sistema="tmr",
        particula_adequada=True,
        milho_seco_predominante=True,
        peso_kg=650,
        escore_corporal=3,
        fracao_multiparas=1,
        energia_referencia_mcal_kg=0.7,
        corrected_milk_is_not_raw_liters=True,
    )
    profile, _ = select_profile(base, assumptions)
    scenarios = []
    for milk in range(20, 46):
        intake = estimate_intake(
            CmsRequest(
                peso_kg=650,
                dias_lactacao=100,
                escore_corporal=3,
                fracao_multiparas=1,
                leite_corrigido_kg_dia=milk,
                energia_referencia_mcal_kg=0.7,
                raca="Holandesa",
                estado="lactacao",
            )
        )["cms_kg_dia"]
        solution = solve(base, profile, ingredients, items, intake)
        if solution["quantities"] is None:
            raise ValueError("Preview must contain only feasible demo scenarios.")
        values = totals(ingredients, solution["quantities"])
        status, _ = evaluate(base, profile, values, intake)
        scenarios.append(
            dict(
                milk_corrected_kg_day=milk,
                status=status,
                totals=values,
                items=[
                    dict(name=i["nome"], kg_mn=q, kg_ms=q * i["ms_pct"] / 100)
                    for i, q in zip(ingredients, solution["quantities"])
                    if q > 0.00001
                ],
            )
        )
    return dict(
        version=1,
        knowledge_sha256=digest,
        knowledge_version=base["version"],
        equation_id="NASEM2021-2-1",
        assumptions=assumptions,
        prices=[dict(name=i["nome"], price=i["preco_kg_mn"]) for i in ingredients],
        scenarios=scenarios,
    )


if __name__ == "__main__":
    target = (
        Path(__file__).resolve().parents[2] / "frontend/src/data/ration-preview.json"
    )
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        json.dumps(build_preview(), ensure_ascii=False, indent=2, allow_nan=False)
        + "\n",
        encoding="utf-8",
    )
    print(f"Published deterministic preview: {target}")
