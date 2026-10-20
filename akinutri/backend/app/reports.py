from .engine_rules import canonical


def compare_sessions(manual, formulated, days):
    if manual["modo"] != "verificar" or formulated["modo"] != "formular":
        raise ValueError(
            "Escolha uma verificacao manual e uma formulacao, nessa ordem."
        )
    a, b = manual["snapshot"], formulated["snapshot"]

    def context(snapshot):
        request = snapshot["request"]
        return {
            "lote": snapshot["lote"],
            "base": snapshot["base_sha256"],
            "insumos": snapshot["insumos"],
            "manejo": {
                k: request[k]
                for k in (
                    "sistema",
                    "particula_adequada",
                    "milho_seco_predominante",
                    "consumo_ms_kg",
                )
            },
            "inclusoes": [
                {k: i[k] for k in ("insumo_id", "minimo_kg_ms", "maximo_kg_ms")}
                for i in sorted(request["itens"], key=lambda i: i["insumo_id"])
            ],
        }

    if canonical(context(a)) != canonical(context(b)):
        raise ValueError(
            "Cenarios incompativeis: use o mesmo lote, base, consumo, manejo, insumos, precos e limites de inclusao."
        )
    ma, fo = manual["result"], formulated["result"]
    if not ma.get("totals") or fo["status"] != "atende_perfil_demo":
        raise ValueError(
            "Comparacao exige dieta manual calculada e formulacao pos-verificada."
        )
    economy = ma["totals"]["custo_lote_dia"] - fo["totals"]["custo_lote_dia"]
    return {
        "manual": ma,
        "formulated": fo,
        "dias": days,
        "economia_lote_dia": economy,
        "economia_periodo": economy * days,
        "economia_pct": (
            economy / ma["totals"]["custo_lote_dia"] * 100
            if ma["totals"]["custo_lote_dia"] > 0
            else None
        ),
        "quantidade_animais": a["lote"]["quantidade"],
        "same_context": True,
        "equivalencia_nutricional_demo": ma["status"] == "atende_perfil_demo",
        "notice": "Projecao de custo com precos e consumo constantes; nao estima receita, producao ou lucro. Dieta manual com restricoes violadas nao e nutricionalmente equivalente.",
    }


def mixing_report(session, request):
    result, snapshot = session["result"], session["snapshot"]
    if result["status"] != "atende_perfil_demo":
        raise ValueError(
            "A ordem de carregamento exige uma dieta que atenda ao perfil demonstrativo."
        )
    active = [i for i in result["items"] if i["quantidade_kg_mn"] > 0]
    ids = {i["insumo_id"] for i in active}
    order = request.ordem_insumos
    if order is not None:
        if len(order) != len(ids) or set(order) != ids:
            raise ValueError(
                "A ordem deve conter cada insumo ativo exatamente uma vez."
            )
        index = {id: n for n, id in enumerate(order)}
        active.sort(key=lambda i: index[i["insumo_id"]])
    animals = snapshot["lote"]["quantidade"]
    items = [
        {
            "insumo_id": i["insumo_id"],
            "nome": i["nome"],
            "sequencia": n + 1,
            "kg_mn_dia": i["quantidade_kg_mn"] * animals,
            "kg_mn_batida": i["quantidade_kg_mn"] * animals / request.batidas_dia,
        }
        for n, i in enumerate(active)
    ]
    total = sum(i["kg_mn_batida"] for i in items)
    if request.capacidade_kg is not None and total > request.capacidade_kg:
        raise ValueError(
            "A quantidade por batida excede a capacidade do vagao; aumente o numero de batidas."
        )
    return {
        "session_id": result["session_id"],
        "lote": snapshot["lote"]["nome"],
        "animais": animals,
        "batidas_dia": request.batidas_dia,
        "items": items,
        "total_kg_mn_batida": total,
        "total_kg_mn_dia": total * request.batidas_dia,
        "order_source": (
            "definida_pelo_operador"
            if order is not None
            else "listagem_por_id_confirmar_ordem_com_responsavel"
        ),
        "notice": "Ordem de carregamento deve ser confirmada pelo responsavel conforme equipamento e ingredientes. Listagem inicial nao e protocolo tecnico de mistura. Dieta demonstrativa; sem acrescimo automatico de sobras ou agua. Valores calculados sem arredondar.",
    }
