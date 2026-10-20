"""NASEM 2021 Eq. 2-1: animal-factor equation for lactating Holsteins."""

import math
import json
from pathlib import Path
from .audit import digest

MODEL = json.loads(
    (
        Path(__file__).resolve().parents[1] / "rules" / "intake_nasem2021_v1.json"
    ).read_text(encoding="utf-8")
)

SOURCE = "https://www.ncbi.nlm.nih.gov/books/NBK600610/"


def estimate_intake(data):
    inputs = data.model_dump()
    result = {
        "status": "fora_escopo",
        "cms_kg_dia": None,
        "equation_id": MODEL["equation_id"],
        "source_url": MODEL["source_url"],
        "inputs": inputs,
        "model": MODEL,
        "model_sha256": digest(MODEL),
        "notice": "Estimativa populacional, nao prescricao. Equacao de fatores animais para Holandesas em lactacao; conjunto descrito na fonte: 1 a 368 dias em lactacao. ECC na escala de 1 a 5. Ajuste manual permitido.",
    }
    if (
        data.estado != "lactacao"
        or data.raca.casefold() != "holandesa"
        or data.dias_lactacao > MODEL["maximum_dim"]
    ):
        result["message"] = (
            "Populacao ou fase nao coberta pelo estimador. Informe o CMS manualmente."
        )
        return result
    energy = data.energia_leite_mcal_dia
    if energy is None:
        energy = data.leite_corrigido_kg_dia * data.energia_referencia_mcal_kg
    parity = data.fracao_multiparas
    c = MODEL["coefficients"]
    steady = (
        c["intercept"]
        + c["parity"] * parity
        + c["milk_energy"] * energy
        + c["body_weight"] * data.peso_kg
        + (c["bcs_intercept"] + c["bcs_parity"] * parity) * data.escore_corporal
    )
    lactation_factor = 1 - (
        c["early_intercept"] + c["early_parity"] * parity
    ) * math.exp(c["decay"] * data.dias_lactacao)
    estimate = steady * lactation_factor
    if not math.isfinite(estimate) or estimate <= 0:
        result["message"] = (
            "Resultado numerico fora de faixa; revise as entradas e informe CMS manualmente."
        )
        return result
    result.update(
        status="estimado",
        cms_kg_dia=estimate,
        milk_energy_mcal_dia=energy,
        steady_state_kg=steady,
        lactation_factor=lactation_factor,
        expression="(3.7 + 5.7*P + 0.305*MilkE + 0.022*PV + (-0.689 - 1.87*P)*ECC) * (1 - (0.212 + 0.136*P)*exp(-0.053*DEL))",
        message="Sugestao calculada localmente; aplicar exige acao explicita do usuario.",
        conversion=(
            "MilkE informado diretamente em Mcal/dia."
            if data.energia_leite_mcal_dia is not None
            else "MilkE = leite corrigido * energia de referencia declarada. O sistema nao corrige automaticamente leite bruto em litros."
        ),
    )
    return result
