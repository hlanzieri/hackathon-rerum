"""Pure functions: no database, network, presentation or arbitrary expression evaluation."""

import copy
import hashlib
import json
import math
import operator
from pathlib import Path

OPS = {
    "eq": operator.eq,
    "gte": operator.ge,
    "gt": operator.gt,
    "lte": operator.le,
    "lt": operator.lt,
}
METRICS = ("pb_pct", "fdn_pct", "amido_pct", "el_mcal_kg", "ca_pct", "p_pct")
RULE_PATH = Path(__file__).resolve().parents[1] / "rules" / "base_v0.1.0.json"


def canonical(data):
    return json.dumps(
        data, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    )


def load_base(path=RULE_PATH):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    # Reject unknown operators/metrics at startup rather than execute expressions.
    if (
        not math.isfinite(data["numeric_tolerance"])
        or not 0 <= data["numeric_tolerance"] <= 0.001
    ):
        raise ValueError("Tolerancia numerica invalida.")
    if len({r["id"] for r in data["rules"]}) != len(data["rules"]):
        raise ValueError("Codigos de regra duplicados.")
    if len({p["id"] for p in data["profiles"]}) != len(data["profiles"]):
        raise ValueError("Perfis duplicados.")
    expected = {r["metric"] for r in data["rules"]}
    if expected != {*METRICS, "ms_kg", "fdn_volumoso_pct"} or len(expected) != len(
        data["rules"]
    ):
        raise ValueError("A base deve conter uma regra para cada metrica suportada.")
    for rule in data["rules"]:
        if (
            rule["metric"] not in (*METRICS, "ms_kg", "fdn_volumoso_pct")
            or rule["source"] not in data["sources"]
        ):
            raise ValueError("Regra desconhecida.")
        if (
            rule["if"]
            != {"fact": rule["metric"], "operator": "outside_inclusive_profile_range"}
            or rule["then"] != {"status": "violada"}
            or rule["else"] != {"status": "atendida"}
        ):
            raise ValueError("Condicao IF/THEN nao suportada pelo compilador LP.")
    for profile in data["profiles"]:
        if set(profile["limits"]) != expected:
            raise ValueError("Limites incompletos no perfil.")
        for condition in profile["conditions"]:
            if condition["op"] not in OPS:
                raise ValueError("Operador desconhecido.")
        for lo, hi in profile["limits"].values():
            if not all(math.isfinite(v) for v in (lo, hi)) or lo < 0 or lo > hi:
                raise ValueError("Limites invalidos.")
    digest = hashlib.sha256(canonical(data).encode("utf-8")).hexdigest()
    return data, digest


def select_profile(base, facts):
    matches, trace = [], []
    for profile in base["profiles"]:
        conditions = []
        for condition in profile["conditions"]:
            observed = facts.get(condition["fact"])
            status = (
                "dados_insuficientes"
                if observed is None
                else (
                    "atendida"
                    if OPS[condition["op"]](observed, condition["value"])
                    else "nao_atendida"
                )
            )
            conditions.append({**condition, "observed": observed, "status": status})
        trace.append({"profile_id": profile["id"], "conditions": conditions})
        if all(c["status"] == "atendida" for c in conditions):
            matches.append(profile)
    if len(matches) > 1:
        raise ValueError("Base ambigua: mais de um perfil aplicavel.")
    return (matches[0] if matches else None), trace


def bounds_for(rule, profile, intake):
    low, high = profile["limits"][rule["metric"]]
    scale = intake if rule.get("scale_by_intake") else 1
    return low * scale, high * scale


def totals(ingredients, quantities):
    ms = [q * i["ms_pct"] / 100 for i, q in zip(ingredients, quantities)]
    total = sum(ms)
    result = {"ms_kg": total}
    for metric in METRICS:
        active = [(i, m) for i, m in zip(ingredients, ms) if m > 0]
        result[metric] = (
            None
            if total <= 0 or any(i[metric] is None for i, _ in active)
            else sum(i[metric] * m for i, m in active) / total
        )
    forage = [
        (i, m)
        for i, m in zip(ingredients, ms)
        if m > 0 and i["categoria"] == "volumoso"
    ]
    result["fdn_volumoso_pct"] = (
        None
        if total <= 0 or any(i["fdn_pct"] is None for i, _ in forage)
        else sum(i["fdn_pct"] * m for i, m in forage) / total
    )
    result["custo_animal_dia"] = sum(
        q * i["preco_kg_mn"] for i, q in zip(ingredients, quantities)
    )
    return result


def evaluate(base, profile, values, intake):
    trace = []
    for rule in base["rules"]:
        low, high = bounds_for(rule, profile, intake)
        value = values[rule["metric"]]
        outside = (
            value is not None
            and not low - base["numeric_tolerance"]
            <= value
            <= high + base["numeric_tolerance"]
        )
        status = (
            "dados_insuficientes"
            if value is None
            else rule["then" if outside else "else"]["status"]
        )
        trace.append(
            {
                **copy.deepcopy(rule),
                "minimum": low,
                "maximum": high,
                "observed": value,
                "status": status,
                "source_url": base["sources"][rule["source"]],
                "message": f"{rule['label']}: {status.replace('_', ' ')}.",
            }
        )
    status = (
        "dados_insuficientes"
        if any(t["status"] == "dados_insuficientes" for t in trace)
        else (
            "restricoes_violadas"
            if any(t["status"] == "violada" for t in trace)
            else "atende_perfil_demo"
        )
    )
    return status, trace
