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
RULE_PATH = Path(__file__).resolve().parents[1] / "rules" / "base_v0.2.0.json"


def canonical(data):
    return json.dumps(
        data, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False
    )


def load_base(path=RULE_PATH):
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    for item in (
        data["rules"]
        + data["profiles"]
        + data.get("inference_rules", [])
        + data.get("profile_adjustments", [])
    ):
        if data.get("inference_rules"):
            valid_cf(item["rule_cf"])
            if not isinstance(item.get("salience"), int):
                raise ValueError("Salience deve ser inteiro.")
            governance = item["governance"]
            if governance["status"] == "validado_por_especialista" and not all(
                governance.get(k)
                for k in ("reviewed_by", "review_date", "review_evidence")
            ):
                raise ValueError(
                    "Validacao exige revisor, data e evidencia documental."
                )
    production_rules = data.get("inference_rules", [])
    if len({r["id"] for r in production_rules}) != len(production_rules):
        raise ValueError("Regras de inferencia duplicadas.")
    for rule in production_rules:
        if not rule["conditions"] or any(
            c["op"] not in OPS for c in rule["conditions"]
        ):
            raise ValueError("Premissas invalidas na regra de inferencia.")
        if set(rule["assert"]) != {"fact", "value"}:
            raise ValueError("Conclusao de inferencia invalida.")
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
    for adjustment in data.get("profile_adjustments", []):
        action = adjustment["action"]
        if not adjustment["conditions"] or any(
            c["op"] not in OPS for c in adjustment["conditions"]
        ):
            raise ValueError("Premissas de ajuste invalidas.")
        if action["type"] == "maintenance_reserve":
            if (
                not math.isfinite(action["fraction"])
                or not 0 <= action["fraction"] <= 1
                or action["inputs"]
                != {
                    "pb_pct": "mantenca_pb_kg_dia",
                    "el_mcal_kg": "mantenca_el_mcal_dia",
                }
            ):
                raise ValueError("Reserva de mantenca invalida.")
        elif action["type"] == "minimum_floor":
            if not action["limits"] or any(
                k not in expected or not math.isfinite(v) or v < 0
                for k, v in action["limits"].items()
            ):
                raise ValueError("Piso de ajuste invalido.")
        else:
            raise ValueError("Acao de ajuste desconhecida.")
    digest = hashlib.sha256(canonical(data).encode("utf-8")).hexdigest()
    return data, digest


def select_profile(base, facts, evidence=None):
    chain = forward_chain(base, facts, evidence)
    facts = {k: v["value"] for k, v in chain["memory"].items()}
    if chain["blocked"]:
        return None, [
            {
                "profile_id": "conflito",
                "conditions": [],
                "conflicts": chain["conflicts"],
            }
        ]
    matches, trace = [], []
    for profile in base["profiles"]:
        conditions = []
        for condition in profile["conditions"]:
            observed = facts.get(condition["fact"])
            status = (
                "dados_insuficientes"
                if observed is None
                or chain["memory"].get(condition["fact"], {}).get("cf", 0) <= 0
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
        matches.sort(
            key=lambda p: (len(p["conditions"]), p.get("salience", 0)), reverse=True
        )
        rank = lambda p: (len(p["conditions"]), p.get("salience", 0))
        if rank(matches[0]) == rank(matches[1]):
            return None, trace + [
                {
                    "profile_id": "conflito",
                    "conditions": [],
                    "conflicting_profiles": [
                        p["id"] for p in matches if rank(p) == rank(matches[0])
                    ],
                }
            ]

    if not matches:
        return None, trace
    profile, adjustments, missing = adjusted_profile(base, matches[0], chain)
    if adjustments or missing:
        trace.append(
            {
                "profile_id": "ajustes_t2",
                "conditions": [],
                "adjustments": adjustments,
                "missing_inputs": missing,
            }
        )
    return (None if missing else profile), trace


def adjusted_profile(base, profile, chain):
    """Apply JSON policies once to a copy; never mutate a published profile.

    Maintenance is an explicit technical input, not inferred from whole-diet
    density. Conversion: kg PB/day -> % DM; Mcal/day -> Mcal/kg DM.
    """
    profile = copy.deepcopy(profile)
    memory = chain["memory"]
    applied, missing = [], []
    for adjustment in base.get("profile_adjustments", []):
        if not all(
            c["fact"] in memory
            and memory[c["fact"]]["cf"] > 0
            and OPS[c["op"]](memory[c["fact"]]["value"], c["value"])
            for c in adjustment["conditions"]
        ):
            continue
        action = adjustment["action"]
        before = copy.deepcopy(profile["limits"])
        inputs = {}
        if action["type"] == "maintenance_reserve":
            required = [
                *action["inputs"].values(),
                action["source_fact"],
                "consumo_ms_kg",
            ]
            absent = [
                k
                for k in required
                if k not in memory or not memory[k]["value"] or memory[k]["cf"] <= 0
            ]
            missing.extend(absent)
            if absent:
                continue
            inputs = {k: memory[k]["value"] for k in required}
            intake = inputs["consumo_ms_kg"]
            for metric, fact in action["inputs"].items():
                delta = action["fraction"] * inputs[fact] / intake
                if metric == "pb_pct":
                    delta *= 100
                profile["limits"][metric][0] += delta
        else:
            for metric, floor in action["limits"].items():
                profile["limits"][metric][0] = max(profile["limits"][metric][0], floor)
        # Incompatible nutrient minima/maxima remain strict constraints. The LP
        # compiles them as separate inequalities and diagnoses infeasibility.
        premise_cf = min(memory[c["fact"]]["cf"] for c in adjustment["conditions"])
        if inputs:
            premise_cf = min(premise_cf, *(memory[k]["cf"] for k in inputs))
        applied.append(
            {
                "rule_id": adjustment["id"],
                "before": before,
                "after": copy.deepcopy(profile["limits"]),
                "inputs": inputs,
                "cf": premise_cf * adjustment["rule_cf"],
                "governance": adjustment["governance"],
            }
        )
    if applied:
        profile["adjustments"] = applied
    return profile, applied, sorted(set(missing))


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


def valid_cf(value):
    if (
        isinstance(value, bool)
        or not isinstance(value, (int, float))
        or not math.isfinite(value)
        or not -1 <= value <= 1
    ):
        raise ValueError("CF deve ser finito e pertencer a [-1, 1].")
    return float(value)


def combine_cf(a, b):
    """MYCIN combination, only appropriate for independent evidence."""
    a, b = valid_cf(a), valid_cf(b)
    if a >= 0 and b >= 0:
        return a + b * (1 - a)
    if a <= 0 and b <= 0:
        return a + b * (1 + a)
    denominator = 1 - min(abs(a), abs(b))
    if denominator == 0:
        raise ValueError("Evidencias opostas com certeza absoluta.")
    return (a + b) / denominator


def forward_chain(base, facts, evidence=None):
    """Synchronous rounds; conservative support for correlated derivations.

    Negative CF is evidence against the stored proposition and cannot satisfy
    a positive premise. Each round recomputes derived facts from active rules,
    so a more specific conclusion retracts obsolete downstream conclusions.
    """
    evidence = evidence or {}
    memory = {
        k: {
            "value": v,
            "cf": valid_cf(evidence.get(k, {}).get("cf", 1)),
            "source": evidence.get(k, {}).get("source", "declarado_pelo_usuario"),
            "rules": [],
        }
        for k, v in facts.items()
        if v is not None
    }
    initial = copy.deepcopy(memory)
    rules = base.get("inference_rules", [])
    trace, conflicts, seen = [], [], set()
    for round_number in range(1, 129):
        proposals = {}
        for rule in rules:
            premises = rule["conditions"]
            if not all(
                c["fact"] in memory
                and memory[c["fact"]]["cf"] > 0
                and OPS[c["op"]](memory[c["fact"]]["value"], c["value"])
                for c in premises
            ):
                continue
            support = min(memory[c["fact"]]["cf"] for c in premises) * valid_cf(
                rule["rule_cf"]
            )
            conclusion = rule["assert"]
            proposal = {
                "rule": rule,
                "cf": support,
                "premises": {
                    c["fact"]: copy.deepcopy(memory[c["fact"]]) for c in premises
                },
            }
            proposals.setdefault(conclusion["fact"], []).append(proposal)
        updated = copy.deepcopy(initial)
        current_conflicts = []
        for fact, candidates in sorted(proposals.items()):
            rank = lambda p: (
                len(p["rule"]["conditions"]),
                p["rule"].get("salience", 0),
            )
            best_rank = max(map(rank, candidates))
            winners = [p for p in candidates if rank(p) == best_rank]
            values = {canonical(p["rule"]["assert"]["value"]) for p in winners}
            if fact in initial or len(values) > 1:
                current_conflicts.append(
                    {
                        "fact": fact,
                        "rules": [p["rule"]["id"] for p in winners],
                        "message": "Contradicao: revisar fatos ou prioridade/especificidade das regras.",
                    }
                )
                continue
            winner = sorted(winners, key=lambda p: p["rule"]["id"])[0]
            updated[fact] = {
                "value": winner["rule"]["assert"]["value"],
                "cf": min(p["cf"] for p in winners),
                "source": "inferencia",
                "rules": [p["rule"]["id"] for p in winners],
            }
            for candidate in winners:
                event = {
                    "round": round_number,
                    "rule_id": candidate["rule"]["id"],
                    "premises": candidate["premises"],
                    "conclusion": fact,
                    "value": updated[fact]["value"],
                    "cf": candidate["cf"],
                    "rule_cf": candidate["rule"]["rule_cf"],
                }
                if memory.get(fact) != updated[fact]:
                    trace.append(event)
        conflicts = current_conflicts
        if updated == memory:
            break
        signature = canonical(updated)
        if signature in seen:
            conflicts.append(
                {"message": "Ciclo de inferencia sem ponto fixo; revisar regras."}
            )
            memory = updated
            break
        seen.add(signature)
        memory = updated
    else:
        conflicts.append({"message": "Limite de rodadas excedido; revisar regras."})
    return {
        "initial_facts": initial,
        "memory": memory,
        "steps": trace,
        "conflicts": conflicts,
        "blocked": bool(conflicts),
        "policy": "especificidade, salience; empate contraditorio bloqueia; suporte correlacionado usa minimo",
    }
