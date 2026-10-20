import hashlib
import hmac
from .engine_rules import canonical, evaluate, select_profile, totals


def digest(data):
    return hashlib.sha256(canonical(data).encode("utf-8")).hexdigest()


def verify_base(content, expected):
    if not hmac.compare_digest(digest(content), expected):
        raise ValueError("Falha de integridade na base de conhecimento.")


def sign_result(snapshot, result):
    result["audit"] = {
        "snapshot_sha256": digest(snapshot),
        "result_sha256": digest({k: v for k, v in result.items() if k != "audit"}),
        "scheme": "sha256-canonical-json-v1",
    }


def verify_session(snapshot, result):
    """Checks hashes and recomputes nutrient trace against the frozen knowledge base."""
    verify_base(snapshot["base"], snapshot["base_sha256"])
    if result["knowledge_sha256"] != snapshot["base_sha256"]:
        raise ValueError("Falha de integridade: resultado referencia outra base.")
    audit = result.get("audit")
    if audit:
        if audit["snapshot_sha256"] != digest(snapshot) or audit[
            "result_sha256"
        ] != digest({k: v for k, v in result.items() if k != "audit"}):
            raise ValueError("Falha de integridade no snapshot ou resultado.")
    request = snapshot["request"]
    facts = {
        **snapshot["lote"],
        **{
            k: request[k]
            for k in ("sistema", "particula_adequada", "milho_seco_predominante")
        },
    }
    profile, profile_trace = select_profile(snapshot["base"], facts)
    if (profile["id"] if profile else None) != result[
        "profile"
    ] or profile_trace != result["profile_trace"]:
        raise ValueError("Falha de integridade no perfil selecionado.")
    if result.get("totals"):
        ingredients = snapshot["insumos"]
        by_id = {i["insumo_id"]: i for i in result["items"]}
        values = totals(
            ingredients, [by_id[i["id"]]["quantidade_kg_mn"] for i in ingredients]
        )
        _, trace = evaluate(snapshot["base"], profile, values, request["consumo_ms_kg"])
        if trace != result["trace"][: len(trace)]:
            raise ValueError("Falha de integridade no traco de inferencia.")
        for key, value in values.items():
            if value != result["totals"][key]:
                raise ValueError("Falha de integridade nos totais calculados.")
    return {
        "status": "verificada",
        "scheme": audit["scheme"] if audit else "legacy-base-and-trace-recalculation",
        "knowledge_sha256": snapshot["base_sha256"],
        "snapshot_sha256": digest(snapshot),
    }
