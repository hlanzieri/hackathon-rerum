"""LP variables are kg dry matter per animal per day. Prices arrive per kg as-fed."""

import math
import numpy as np
import scipy
from scipy.optimize import linprog
from .engine_rules import bounds_for


def solve(base, profile, ingredients, items, intake, excluded_ids=None, *, group_context=None):
    excluded_ids = set(excluded_ids or ())
    excluded = [
        {"insumo_id": ingredient.get("id", index), "nome": ingredient["nome"]}
        for index, (ingredient, item) in enumerate(zip(ingredients, items))
        if ingredient.get("id", item.get("insumo_id", index)) in excluded_ids
    ]
    # Validate the complete composition before building any LP rows. Unknown values
    # are reported as missing data; they are never interpreted as zero.
    missing = {}
    incomplete_ids = set()
    for rule in base["rules"]:
        metric = rule["metric"]
        if metric == "ms_kg":
            continue
        for index, (ingredient, item) in enumerate(zip(ingredients, items)):
            key = ingredient.get("id", item.get("insumo_id", index))
            composition_key = "fdn_pct" if metric == "fdn_volumoso_pct" else metric
            applicable = metric != "fdn_volumoso_pct" or ingredient["categoria"] == "volumoso"
            if applicable and ingredient.get(composition_key) is None and item["maximo_kg_ms"] > 0:
                incomplete_ids.add(key)
                if key not in excluded_ids:
                    pending = missing.setdefault(key, {"insumo_id": key, "nome": ingredient["nome"], "nutrientes_faltantes": []})["nutrientes_faltantes"]
                    nutrient = {"pb_pct": "PB", "fdn_pct": "FDN", "amido_pct": "Amido", "el_mcal_kg": "EL", "ca_pct": "Cálcio", "p_pct": "Fósforo"}.get(composition_key, composition_key)
                    if nutrient not in pending:
                        pending.append(nutrient)
    invalid_exclusions = excluded_ids - incomplete_ids
    if invalid_exclusions:
        return {
            "status": "falha_solver",
            "message": f"Exclusao explicita requer composicao incompleta; insumo(s) invalido(s): {sorted(invalid_exclusions)}.",
            "missing_composition": [],
            "quantities": None,
        }
    if excluded_ids:
        for ingredient, item in zip(ingredients, items):
            key = ingredient.get("id", item.get("insumo_id"))
            if key in excluded_ids and item["minimo_kg_ms"] > 0:
                return {
                    "status": "dados_insuficientes",
                    "message": f"{ingredient['nome']}: exclusao conflita com minimo de inclusao positivo.",
                    "insumos_incompletos": [],
                    "excluded_ingredients": excluded,
                    "quantities": None,
                }
        remaining = [
            (ingredient, item)
            for ingredient, item in zip(ingredients, items)
            if ingredient.get("id", item.get("insumo_id")) not in excluded_ids
        ]
        if not remaining:
            return {
                "status": "inviavel",
                "message": "A exclusao removeu todos os insumos da formulação.",
                "excluded_ingredients": excluded,
                "quantities": None,
            }
        optimized = solve(
            base,
            profile,
            [ingredient for ingredient, _ in remaining],
            [item for _, item in remaining],
            intake,
            group_context=group_context,
        )
        if optimized.get("quantities") is not None:
            by_id = {
                ingredient.get("id", item.get("insumo_id")): quantity
                for (ingredient, item), quantity in zip(remaining, optimized["quantities"])
            }
            optimized["quantities"] = [
                0.0 if ingredient.get("id", item.get("insumo_id")) in excluded_ids
                else by_id[ingredient.get("id", item.get("insumo_id"))]
                for ingredient, item in zip(ingredients, items)
            ]
        optimized["excluded_ingredients"] = excluded
        return optimized
    if missing:
        return {
            "status": "dados_insuficientes",
            "message": "Composição nutricional incompleta em insumos selecionados.",
            "mensagem": "Composição nutricional incompleta em insumos selecionados.",
            "insumos_incompletos": list(missing.values()),
            "missing_composition": [
                {"insumo_id": entry["insumo_id"], "nome": entry["nome"],
                 "nutrientes": entry["nutrientes_faltantes"]}
                for entry in missing.values()
            ],
            "excluded_ingredients": excluded,
            "quantities": None,
        }
    costs = [i["preco_kg_mn"] / (i["ms_pct"] / 100) for i in ingredients]
    a, b, eq, rhs, labels, equality_labels = [], [], [], [], [], []
    for rule in base["rules"]:
        metric = rule["metric"]
        low, high = bounds_for(rule, profile, intake)
        if metric == "ms_kg":
            if low == high:
                eq.append([1.0] * len(ingredients))
                rhs.append(low)
                equality_labels.append(f"{rule['id']}:igualdade")
            else:
                a.extend([[-1.0] * len(ingredients), [1.0] * len(ingredients)])
                b.extend([-low, high])
                labels.extend([f"{rule['id']}:min", f"{rule['id']}:max"])
            continue
        vector = []
        for ingredient, item in zip(ingredients, items):
            if metric == "fdn_volumoso_pct":
                value = (
                    ingredient["fdn_pct"]
                    if ingredient["categoria"] == "volumoso"
                    else 0.0
                )
            else:
                value = ingredient["fdn_pct"] if metric == "fdn_volumoso_pct" else ingredient[metric]
            vector.append(0.0 if value is None else value)
        # Weighted concentration constraint: sum((nutrient - limit) * x) <= 0.
        a.extend([[low - v for v in vector], [v - high for v in vector]])
        b.extend([0.0, 0.0])
        labels.extend([f"{rule['id']}:min", f"{rule['id']}:max"])
    bounds = [(item["minimo_kg_ms"], item["maximo_kg_ms"]) for item in items]
    try:
        result = linprog(
            costs,
            A_ub=a or None,
            b_ub=b or None,
            A_eq=eq or None,
            b_eq=rhs or None,
            bounds=bounds,
            method="highs-ds",
            options={
                "presolve": True,
                "time_limit": 10.0,
                "dual_feasibility_tolerance": 1e-9,
                "primal_feasibility_tolerance": 1e-9,
            },
        )
    except (ValueError, FloatingPointError, OverflowError) as error:
        return {
            "status": "falha_solver",
            "message": f"Entradas numericas invalidas: {error}",
            "quantities": None,
        }
    meta = {
        "method": "highs-ds",
        "scipy_version": scipy.__version__,
        "variable_unit": "kg MS/animal/dia",
        "objective": "min BRL/animal/dia",
        "numeric_status": result.status,
        "constraint_ids": labels,
        "group_context": group_context,
    }
    if not result.success:
        return {
            "status": "inviavel" if result.status == 2 else "falha_solver",
            "message": (
                "Nao existe dieta para estas restricoes e limites de inclusao."
                if result.status == 2
                else result.message
            ),
            "quantities": None,
            "solver": meta,
            "excluded_ingredients": excluded,
        }
    if not np.isfinite(result.x).all() or not math.isfinite(float(result.fun)):
        return {
            "status": "falha_solver",
            "message": "Solucionador retornou valores nao finitos.",
            "quantities": None,
            "solver": meta,
        }
    quantities = [
        max(0.0, float(x)) / (i["ms_pct"] / 100) for x, i in zip(result.x, ingredients)
    ]
    explanation = []
    for index, ingredient in enumerate(ingredients):
        x = max(0.0, float(result.x[index]))
        lower_marginal = float(result.lower.marginals[index])
        upper_marginal = float(result.upper.marginals[index])
        reason = (
            "Participa da solucao de menor custo sujeita ao conjunto completo de restricoes."
            if x > base["numeric_tolerance"]
            else "Quantidade zero no otimo; isso nao significa alimento inadequado."
        )
        if (
            x <= base["numeric_tolerance"]
            and lower_marginal > base["numeric_tolerance"]
        ):
            reason += " A inclusao forcada aumenta o custo marginal local do modelo."
        elif x <= base["numeric_tolerance"]:
            reason += " Pode haver empate ou limite de disponibilidade; nao ha ganho marginal de custo indicado."
        explanation.append(
            {
                "insumo_id": ingredient["id"] if "id" in ingredient else index,
                "nome": ingredient["nome"],
                "kg_ms": x,
                "custo_kg_ms": costs[index],
                "marginal_minimo_brl_kg_ms": lower_marginal,
                "marginal_maximo_brl_kg_ms": upper_marginal,
                "reason": reason,
            }
        )
    shadow_prices = {
        "inequalities": [
            {
                "constraint_id": label,
                "slack": float(slack),
                "marginal_brl_per_rhs_unit": float(marginal),
            }
            for label, slack, marginal in zip(
                labels, result.ineqlin.residual, result.ineqlin.marginals
            )
        ],
        "equalities": [
            {
                "constraint_id": label,
                "residual": float(residual),
                "marginal_brl_per_rhs_unit": float(marginal),
            }
            for label, residual, marginal in zip(
                equality_labels, result.eqlin.residual, result.eqlin.marginals
            )
        ],
        "notice": "Derivadas locais do custo por animal/dia em relacao ao lado direito da restricao linear, mantendo a base otima. As restricoes percentuais estao na forma soma((teor-limite)*kgMS)<=0; marginal por RHS nao e marginal por ponto percentual. Nao sao economias garantidas fora da vizinhanca local.",
    }
    return {
        "status": "otimo",
        "quantities": quantities,
        "solver": meta,
        "shadow_prices": shadow_prices,
        "optimization_trace": explanation,
        "objective_value": float(result.fun),
        "message": "Menor custo encontrado para o perfil demonstrativo, sem relaxar restricoes.",
        "excluded_ingredients": excluded,
    }
