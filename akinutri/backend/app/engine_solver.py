"""LP variables are kg dry matter per animal per day. Prices arrive per kg as-fed."""

import math
import numpy as np
import scipy
from scipy.optimize import linprog
from .engine_rules import bounds_for


def solve(base, profile, ingredients, items, intake):
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
                value = ingredient[metric]
            if value is None and item["maximo_kg_ms"] > 0:
                return {
                    "status": "dados_insuficientes",
                    "message": f"{ingredient['nome']}: falta {metric}.",
                    "quantities": None,
                }
            vector.append(value or 0.0)
        # Weighted concentration constraint: sum((nutrient - limit) * x) <= 0.
        a.extend([[low - v for v in vector], [v - high for v in vector]])
        b.extend([0.0, 0.0])
        labels.extend([f"{rule['id']}:min", f"{rule['id']}:max"])
    bounds = [(i["minimo_kg_ms"], i["maximo_kg_ms"]) for i in items]
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
    }
