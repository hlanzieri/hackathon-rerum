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


def estimate_intake(data, *, group_context=None):
    inputs = data.model_dump()
    result = {
        "status": "fora_escopo",
        "cms_kg_dia": None,
        "equation_id": MODEL["equation_id"],
        "source_url": MODEL["source_url"],
        "inputs": inputs,
        "grupo": group_context,
        "model": MODEL,
        "model_sha256": digest(MODEL),
        "notice": "Estimativa populacional, nao prescricao. Equacao de fatores animais para Holandesas em lactacao; conjunto descrito na fonte: 1 a 368 dias em lactacao. ECC na escala de 1 a 5. Ajuste manual permitido.",
    }
    breeds = MODEL["breed_metabolic_factors"]
    breed = next(
        (name for name in breeds if name.casefold() == data.raca.casefold()), None
    )
    if breed is None:
        result["message"] = "Raca sem fator declarado. Informe CMS manualmente."
        return result
    if data.estado == "seca":
        if data.dias_ate_parto <= 21:
            result["message"] = (
                "Transicao pre-parto ate 21 dias bloqueada; exige revisao tecnica."
            )
            return result
        low, high = MODEL["dry_intake_weight_fraction"]
        result.update(
            status="estimado",
            equation_id="T2-SECA-EXPERIMENTAL-1",
            cms_kg_dia=data.peso_kg * (low + high) / 2,
            cms_range_kg_dia=[data.peso_kg * low, data.peso_kg * high],
            expression="PV * (0.0197 + 0.021) / 2",
            source_url=None,
            scientific_status="experimental_nao_validado",
            notice=MODEL["experimental_notice"],
            message="Ponto medio da faixa declarada para seca distante. Nenhuma equacao de lactacao aplicada.",
        )
        return result
    if data.dias_lactacao > MODEL["maximum_dim"]:
        result["message"] = (
            "Populacao ou fase nao coberta pelo estimador. Informe o CMS manualmente."
        )
        return result
    energy = data.energia_leite_mcal_dia
    if energy is None:
        energy = data.leite_corrigido_kg_dia * data.energia_referencia_mcal_kg
    parity = data.fracao_multiparas
    c = MODEL["coefficients"]
    breed_factor = breeds[breed]
    # Apply the requested factor to metabolic weight, then recover an equivalent
    # BW for the linear BW term. Only Holstein factor 1 reproduces Eq. 2-1.
    metabolic_weight = data.peso_kg**0.75
    equivalent_weight = (metabolic_weight * breed_factor) ** (1 / 0.75)
    steady = (
        c["intercept"]
        + c["parity"] * parity
        + c["milk_energy"] * energy
        + c["body_weight"] * equivalent_weight
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
    result.update(
        breed_factor=breed_factor,
        metabolic_weight=metabolic_weight,
        adjusted_metabolic_weight=metabolic_weight * breed_factor,
        equivalent_body_weight_kg=equivalent_weight,
        scientific_status=(
            "referencia_populacional"
            if breed == "Holandesa"
            else "experimental_nao_validado"
        ),
    )
    if breed != "Holandesa":
        result.update(
            equation_id="T2-MULTIRRACA-EXPERIMENTAL-1",
            notice=MODEL["experimental_notice"],
            source_url=None,
            expression="Eq. 2-1 adaptada: PV no termo linear = (fator_racial * PV**0.75)**(1/0.75)",
            message="Adaptacao experimental; nao e uma equacao NASEM validada para esta raca.",
        )
    return result


def estimar_cms(data, *, group_context=None):
    """Portuguese API alias; all intake logic stays in this dedicated module."""
    return estimate_intake(data, group_context=group_context)
