"""Deterministic explanations derived exclusively from frozen facts and traces."""

import copy
from .engine_rules import forward_chain


def attach_reasoning(result, base, chain, profile, evidence):
    reasoning = copy.deepcopy(chain)
    reasoning["profile"] = result["profile"]
    reasoning["profile_conditions"] = result["profile_trace"]
    reasoning["constraints_sent_to_solver"] = result.get("solver", {}).get(
        "constraint_ids", []
    )
    reasoning["lp_model"] = result.get("solver", {})
    reasoning["governance_status"] = base.get("status")
    support = []
    if profile:
        profile_cf = min(
            reasoning["memory"][c["fact"]]["cf"] for c in profile["conditions"]
        ) * profile.get("rule_cf", 1)
        support.append(profile_cf)
        reasoning["memory"]["perfil_selecionado"] = {
            "value": profile["id"],
            "cf": profile_cf,
            "source": "inferencia",
            "rules": [profile["id"]],
        }
        composition_cf = evidence.get("composicao", {}).get("cf", 0.75)
        intake_cf = evidence.get("consumo_ms_kg", {}).get("cf", 1)
        reasoning["composition_evidence"] = {
            "cf": composition_cf,
            "source": evidence.get("composicao", {}).get(
                "source", "tabela_demonstrativa"
            ),
        }
        for entry in result["trace"]:
            cf = min(profile_cf, composition_cf, intake_cf) * entry.get("rule_cf", 1)
            if entry["status"] == "dados_insuficientes":
                cf = 0
            support.append(cf)
            reasoning["memory"][f"avaliacao:{entry['id']}"] = {
                "value": entry["status"],
                "cf": cf,
                "source": "inferencia",
                "rules": [entry["id"]],
            }
    reasoning["verdict"] = {
        "status": result["status"],
        "message": result.get("message"),
    }
    conflict_profiles = [
        p for p in result["profile_trace"] if p["profile_id"] == "conflito"
    ]
    if conflict_profiles:
        reasoning["blocked"] = True
        reasoning["conflicts"].extend(conflict_profiles)
    if profile and result.get("totals"):
        raw = {k: v["value"] for k, v in chain["initial_facts"].items()}
        enriched_evidence = copy.deepcopy(evidence)
        for entry in result["trace"]:
            key = f"avaliacao:{entry['id']}"
            raw[key] = entry["status"]
            enriched_evidence[key] = reasoning["memory"][key]
        final_chain = forward_chain(base, raw, enriched_evidence)
        reasoning["memory"].update(final_chain["memory"])
        reasoning["steps"] = final_chain["steps"]
        reasoning["conflicts"].extend(final_chain["conflicts"])
        reasoning["blocked"] = reasoning["blocked"] or final_chain["blocked"]
    if reasoning["blocked"] and result.get("totals"):
        result["status"] = "falha_pos_verificacao"
        result["message"] = (
            "Parecer bloqueado por conflito no encadeamento final. Revise as regras indicadas."
        )
    reasoning["verdict"] = {
        "status": result["status"],
        "message": result.get("message"),
    }
    # A solver failure or infeasibility has no diagnostic confidence score.
    result["global_cf"] = (
        min(support)
        if support and result.get("totals") and not reasoning["blocked"]
        else None
    )
    reasoning["certainty_notice"] = (
        "CF e suporte heuristico, nao probabilidade nem validacao clinica. Pesos didaticos pendentes de revisao. Global = minimo dos suportes utilizados."
    )
    result["reasoning"] = reasoning


def explain_question(base, fact):
    references = []
    for rule in base.get("inference_rules", []) + base["profiles"]:
        if any(c["fact"] == fact for c in rule["conditions"]):
            references.append(rule["id"])
    for rule in base["rules"]:
        if rule["metric"] == fact:
            references.append(rule["id"])
    if fact in {"particula_adequada", "milho_seco_predominante"}:
        references.extend(
            r["id"]
            for r in base["rules"]
            if r["id"] in {"FDN-01", "FDNV-01", "AMIDO-01"}
        )
    message = base.get("question_explanations", {}).get(fact)
    if not message:
        message = (
            f"Este fato e necessario para avaliar: {', '.join(references)}. Ausencia ou evidencia sem suporte impede essas condicoes."
            if references
            else "Este campo nao e uma premissa de regra na base atual; pode ser dado cadastral ou entrada de calculo."
        )
    return {
        "fact": fact,
        "message": message,
        "rules": references,
        "knowledge_version": base["version"],
    }


def explain_session(kind, snapshot, result):
    reasoning = result.get("reasoning")
    if not reasoning:
        return {
            "available": False,
            "message": "Sessao historica anterior ao motor de encadeamento. Consulte o traco original preservado.",
            "trace": result.get("trace", []),
        }
    common = {
        "available": True,
        "session_id": result["session_id"],
        "knowledge_sha256": result["knowledge_sha256"],
    }
    if kind == "por-que-perfil":
        return {
            **common,
            "profile": result["profile"],
            "conditions": result["profile_trace"],
            "steps": reasoning["steps"],
            "conflicts": reasoning["conflicts"],
            "message": (
                "Perfil selecionado pelas condicoes demonstradas e politica de especificidade/salience."
                if result["profile"]
                else "Nenhum perfil foi selecionado. Confira condicoes ausentes, fora de escopo ou conflitos."
            ),
        }
    if kind == "gargalo-formulacao":
        return {
            **common,
            "status": result["status"],
            "bottleneck": result.get("bottleneck"),
            "message": (
                (
                    "Consulte o conjunto irredutivel de restricoes conflitantes."
                    if result["bottleneck"]["certified_irreducible"]
                    else "Diagnostico parcial: o conjunto conflitante nao foi certificado como irredutivel no limite de tempo/numerico."
                )
                if result.get("bottleneck")
                else "Nao ha diagnostico de inviabilidade LP nesta sessao."
            ),
            "violations": [t for t in result["trace"] if t["status"] != "atendida"],
        }
    return {
        **common,
        **reasoning,
        "nutrition_trace": result["trace"],
        "optimization_trace": result.get("optimization_trace", []),
        "global_cf": result.get("global_cf"),
    }
