"""LP variables are kg dry matter per animal per day. Prices arrive per kg as-fed."""

import math
import time
import numpy as np
import scipy
from scipy.optimize import linprog
from .engine_rules import bounds_for


def solve(
    base, profile, ingredients, items, intake, excluded_ids=None, *, group_context=None
):
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
    for rule in sorted(base["rules"], key=lambda rule: rule["id"]):
        metric = rule["metric"]
        if metric == "ms_kg":
            continue
        for index, (ingredient, item) in enumerate(zip(ingredients, items)):
            key = ingredient.get("id", item.get("insumo_id", index))
            composition_key = "fdn_pct" if metric == "fdn_volumoso_pct" else metric
            applicable = (
                metric != "fdn_volumoso_pct" or ingredient["categoria"] == "volumoso"
            )
            if (
                applicable
                and ingredient.get(composition_key) is None
                and item["maximo_kg_ms"] > 0
            ):
                incomplete_ids.add(key)
                if key not in excluded_ids:
                    pending = missing.setdefault(
                        key,
                        {
                            "insumo_id": key,
                            "nome": ingredient["nome"],
                            "nutrientes_faltantes": [],
                        },
                    )["nutrientes_faltantes"]
                    nutrient = {
                        "pb_pct": "PB",
                        "fdn_pct": "FDN",
                        "amido_pct": "Amido",
                        "el_mcal_kg": "EL",
                        "ca_pct": "Cálcio",
                        "p_pct": "Fósforo",
                    }.get(composition_key, composition_key)
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
                for (ingredient, item), quantity in zip(
                    remaining, optimized["quantities"]
                )
            }
            optimized["quantities"] = [
                (
                    0.0
                    if ingredient.get("id", item.get("insumo_id")) in excluded_ids
                    else by_id[ingredient.get("id", item.get("insumo_id"))]
                )
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
                {
                    "insumo_id": entry["insumo_id"],
                    "nome": entry["nome"],
                    "nutrientes": entry["nutrientes_faltantes"],
                }
                for entry in missing.values()
            ],
            "excluded_ingredients": excluded,
            "quantities": None,
        }
    for ingredient in ingredients:
        ms_pct = ingredient.get("ms_pct")
        price = ingredient.get("preco_kg_mn")
        if (
            not isinstance(ms_pct, (int, float))
            or not math.isfinite(ms_pct)
            or ms_pct <= 0
            or not isinstance(price, (int, float))
            or not math.isfinite(price)
            or price < 0
        ):
            return {
                "status": "falha_solver",
                "message": f"MS ou preco invalido para {ingredient.get('nome', 'insumo')}.",
                "quantities": None,
            }
    try:
        costs = [i["preco_kg_mn"] / (i["ms_pct"] / 100) for i in ingredients]
    except (ZeroDivisionError, OverflowError):
        return {
            "status": "falha_solver",
            "message": "Falha na conversao numerica do custo por kg de MS.",
            "quantities": None,
        }
    if not all(math.isfinite(cost) for cost in costs):
        return {
            "status": "falha_solver",
            "message": "Custo por kg de MS fora da faixa numerica.",
            "quantities": None,
        }
    a, b, eq, rhs, labels, equality_labels = [], [], [], [], [], []
    for rule in sorted(base["rules"], key=lambda rule: rule["id"]):
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
                value = (
                    ingredient["fdn_pct"]
                    if metric == "fdn_volumoso_pct"
                    else ingredient[metric]
                )
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
        "constraint_ids": labels + equality_labels,
        "constraints": [
            {"id": name, "coefficients": row, "rhs": value, "relation": relation}
            for names, rows, values, relation in [
                (labels, a, b, "lte"),
                (equality_labels, eq, rhs, "eq"),
            ]
            for name, row, value in zip(names, rows, values)
        ],
        "ingredient_bounds": [
            {
                "insumo_id": ingredient.get("id", index),
                "minimum_kg_ms": lo,
                "maximum_kg_ms": hi,
            }
            for index, (ingredient, (lo, hi)) in enumerate(zip(ingredients, bounds))
        ],
        "group_context": group_context,
    }
    if not result.success:
        bottleneck = None
        if result.status == 2:
            bottleneck = irreducible_conflict(
                a, b, eq, rhs, labels, equality_labels, bounds, ingredients
            )
        return {
            "bottleneck": bottleneck,
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
                "binding": abs(float(slack)) <= base["numeric_tolerance"],
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
                "binding": abs(float(residual)) <= base["numeric_tolerance"],
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


def irreducible_conflict(a, b, eq, rhs, labels, equality_labels, bounds, ingredients):
    """Deletion filter returns one IIS, never claims a unique causal constraint.

    Separate bounded diagnostic budget; unknown status stops certification.
    """
    rows = [(label, "ub", row, value) for label, row, value in zip(labels, a, b)]
    rows += [
        (label, "eq", row, value) for label, row, value in zip(equality_labels, eq, rhs)
    ]
    for index, (lo, hi) in enumerate(bounds):
        name = ingredients[index].get("id", index)
        row = [0.0] * len(bounds)
        row[index] = 1.0
        rows.extend(
            [
                (f"INCLUSAO-{name}:max", "ub", row, hi),
                (f"INCLUSAO-{name}:min", "ub", [-v for v in row], -lo),
            ]
        )
    active = list(rows)
    complete = True
    deadline = time.monotonic() + 3
    for candidate in rows:
        if time.monotonic() >= deadline:
            complete = False
            break
        trial = [r for r in active if r[0] != candidate[0]]
        ub = [r for r in trial if r[1] == "ub"]
        equal = [r for r in trial if r[1] == "eq"]
        check = linprog(
            [0.0] * len(bounds),
            A_ub=[r[2] for r in ub] or None,
            b_ub=[r[3] for r in ub] or None,
            A_eq=[r[2] for r in equal] or None,
            b_eq=[r[3] for r in equal] or None,
            bounds=[(None, None)] * len(bounds),
            method="highs-ds",
            options={"time_limit": 0.1, "primal_feasibility_tolerance": 1e-9},
        )
        if check.status == 2:
            active = trial
        elif check.status != 0:
            complete = False
            break
    return {
        "method": "deletion_filter",
        "certified_irreducible": complete,
        "constraints": [
            {"id": r[0], "coefficients": r[2], "rhs": r[3], "relation": r[1]}
            for r in active
        ],
        "message": "Estas restricoes sao conjuntamente inviaveis. O conjunto pode nao ser unico; nao indica uma unica causa nem autoriza relaxamento automatico.",
    }
