from contextlib import asynccontextmanager
from pathlib import Path
import platform
import sqlalchemy
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.openapi.docs import get_swagger_ui_html
from sqlalchemy import select, desc
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from .database import (
    Base,
    engine,
    SessionLocal,
    get_db,
    install_immutability_guards,
    migrate_ownership,
)
from .models import (
    Raca,
    Lote,
    InsumoAlimentar,
    BaseConhecimento,
    RegraNutricional,
    SessaoInferencia,
    ResultadoDieta,
    ExplicacaoTraco,
    GrupoProducao,
)
from .schemas import (
    LoteCreate,
    LoteRead,
    InsumoCreate,
    InsumoRead,
    InferenciaRequest,
    FormulacaoRequest,
    InferenceResponse,
    CmsRequest,
    ComparisonRequest,
    MixingRequest,
)
from .seed import seed
from .engine_rules import select_profile, evaluate, totals, forward_chain
from .engine_explanation import explain_question, explain_session, attach_reasoning
from .engine_solver import solve
from .engine_intake import estimate_intake
from .audit import verify_base, sign_result, verify_session
from .reports import compare_sessions, mixing_report
from .auth import (
    router as auth_router,
    get_scoped_db,
    get_current_user,
    check_request_origin,
    protect_api_routes,
)
from .lifecycle import router as lifecycle_router


@asynccontextmanager
async def lifespan(app):
    Base.metadata.create_all(engine)
    migrate_ownership(engine)
    with SessionLocal() as db:
        app.state.base_id = seed(db)
    install_immutability_guards(engine)
    yield


app = FastAPI(
    title="AkiNutri — Sistema Especialista",
    version="0.2.0",
    lifespan=lifespan,
    dependencies=[Depends(check_request_origin), Depends(protect_api_routes)],
    docs_url=None,
    redoc_url=None,
)


@app.get("/docs", include_in_schema=False)
def local_documentation():
    return get_swagger_ui_html(
        openapi_url=app.openapi_url,
        title="AkiNutri Enterprise · API",
        swagger_js_url="/vendor/swagger-ui-bundle.js",
        swagger_css_url="/vendor/swagger-ui.css",
        swagger_favicon_url="/favicon.svg",
        swagger_ui_parameters={"validatorUrl": None},
    )


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
    allow_credentials=True,
)


@app.middleware("http")
async def private_responses(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


app.include_router(auth_router)
app.include_router(lifecycle_router)


def require(db, model, id):
    value = db.get(model, id)
    if value is None:
        raise HTTPException(404, f"{model.__name__} {id} nao encontrado.")
    return value


@app.get("/api/health")
def health():
    return {"status": "ok", "engine": "deterministic", "version": app.version}


@app.get("/api/racas")
def racas(db: Session = Depends(get_scoped_db)):
    return [
        {"id": r.id, "nome": r.nome} for r in db.scalars(select(Raca).order_by(Raca.id))
    ]


@app.get("/api/lotes", response_model=list[LoteRead])
def lotes(db: Session = Depends(get_scoped_db)):
    return db.scalars(select(Lote).order_by(desc(Lote.id))).all()


@app.post("/api/lotes", response_model=LoteRead, status_code=201)
def create_lote(data: LoteCreate, db: Session = Depends(get_scoped_db)):
    race = (
        require(db, Raca, data.raca_id)
        if data.raca_id is not None
        else next(
            (
                r
                for r in db.scalars(select(Raca))
                if r.nome.casefold() == data.raca.casefold()
            ),
            None,
        )
    )
    if race is None:
        raise HTTPException(422, "Raca nao cadastrada.")
    if data.raca is not None and data.raca.casefold() != race.nome.casefold():
        raise HTTPException(422, "Nome e identificador da raca divergem.")
    lote = Lote(**{**data.model_dump(exclude={"raca"}), "raca_id": race.id})
    db.add(lote)
    db.commit()
    return lote


@app.get("/api/insumos", response_model=list[InsumoRead])
def insumos(db: Session = Depends(get_scoped_db)):
    return db.scalars(select(InsumoAlimentar).order_by(InsumoAlimentar.id)).all()


def save_insumo(data, db, existing=None):
    ingredient = existing or InsumoAlimentar()
    for key, value in data.model_dump().items():
        setattr(ingredient, key, value)
    db.add(ingredient)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "Ja existe insumo com este nome.")
    return ingredient


@app.post("/api/insumos", response_model=InsumoRead, status_code=201)
def create_insumo(data: InsumoCreate, db: Session = Depends(get_scoped_db)):
    return save_insumo(data, db)


@app.put("/api/insumos/{id}", response_model=InsumoRead)
def update_insumo(id: int, data: InsumoCreate, db: Session = Depends(get_scoped_db)):
    return save_insumo(data, db, require(db, InsumoAlimentar, id))


@app.get("/api/regras")
def rules(db: Session = Depends(get_scoped_db)):
    base = require(db, BaseConhecimento, app.state.base_id)
    checked_base(base)
    return {"sha256": base.sha256, **base.conteudo}


def checked_base(record):
    try:
        verify_base(record.conteudo, record.sha256)
    except ValueError as error:
        raise HTTPException(409, str(error))


def infer(data, mode, db, *, created_at=None):
    # Quantity is an input only for evaluation; formulation starts with free LP
    # variables and must not depend on a pre-existing ration.
    if mode == "verificar" and not any(i.quantidade_kg_mn > 0 for i in data.itens):
        raise HTTPException(
            422, "Informe ao menos uma quantidade positiva para verificar a dieta."
        )
    lote = require(db, Lote, data.lote_id)
    if not lote.tmr_habilitado and data.sistema == "tmr":
        raise HTTPException(
            422, "O lote nao possui TMR habilitado; revise o manejo informado."
        )
    group_context = None
    if data.grupo_id is not None:
        group = require(db, GrupoProducao, data.grupo_id)
        if not group.ativo:
            raise HTTPException(409, "O grupo de produção está arquivado.")
        required_facts = (
            group.numero_animais,
            group.del_medio,
            group.peso_medio_kg,
            group.producao_media_l_dia,
            group.ecc_medio,
            group.fracao_multiparas,
        )
        if any(value is None for value in required_facts):
            raise HTTPException(
                422,
                "O grupo não possui parâmetros completos: número de animais, DEL, peso, produção, ECC e fração de multíparas.",
            )
        if group.fase not in {"lactacao", "seca"}:
            raise HTTPException(
                422,
                f"Formulação indisponível para grupo em fase {group.fase}; os perfis atuais cobrem lactação e período seco distante do parto.",
            )
        if group.fase != lote.estado:
            raise HTTPException(
                422,
                f"Fase incompatível: grupo em {group.fase} e lote em {lote.estado}.",
            )
        if group.fase == "lactacao" and (
            group.producao_media_l_dia <= 0 or group.del_medio <= 0
        ):
            raise HTTPException(
                422, "Grupo em lactação exige DEL e produção médios positivos."
            )
        if group.fase == "seca" and group.producao_media_l_dia != 0:
            raise HTTPException(422, "Grupo seco exige produção média igual a zero.")
        group_context = {
            "id": group.id,
            "nome": group.nome,
            "fase": group.fase,
            "numero_animais": group.numero_animais,
            "del_medio": group.del_medio,
            "peso_medio_kg": group.peso_medio_kg,
            "producao_media_l_dia": group.producao_media_l_dia,
            "ecc_medio": group.ecc_medio,
            "fracao_multiparas": group.fracao_multiparas,
        }
    base_record = require(db, BaseConhecimento, app.state.base_id)
    checked_base(base_record)
    base = base_record.conteudo
    items = sorted([i.model_dump() for i in data.itens], key=lambda i: i["insumo_id"])
    ingredients = [
        InsumoRead.model_validate(
            require(db, InsumoAlimentar, i["insumo_id"])
        ).model_dump()
        for i in items
    ]
    for ingredient, item in zip(ingredients, items):
        if item["preco_kg_mn"] is not None:
            ingredient["preco_kg_mn"] = item["preco_kg_mn"]
    lote_data = LoteRead.model_validate(lote).model_dump()
    cms_estimate = None
    if data.estimativa_cms is not None:
        estimation = data.estimativa_cms
        expected_group = group_context or {}
        if (
            estimation.peso_kg,
            estimation.dias_lactacao,
            estimation.estado,
            estimation.raca,
        ) != (
            expected_group.get("peso_medio_kg", lote.peso_kg),
            (
                max(1, int(expected_group["del_medio"]))
                if expected_group and expected_group["fase"] == "lactacao"
                else None if expected_group else lote.dias_lactacao
            ),
            expected_group.get("fase", lote.estado),
            require(db, Raca, lote.raca_id).nome,
        ):
            raise HTTPException(
                422,
                "Estimativa de CMS pertence a outro contexto de lote. Recalcule ou informe consumo manual.",
            )
        if estimation.dias_ate_parto != lote.dias_ate_parto:
            raise HTTPException(422, "Dias ate parto da estimativa divergem do lote.")
        if group_context and (
            estimation.escore_corporal != group_context["ecc_medio"]
            or estimation.fracao_multiparas != group_context["fracao_multiparas"]
        ):
            raise HTTPException(
                422, "ECC ou paridade da estimativa diverge do grupo. Recalcule o CMS."
            )
        cms_estimate = estimate_intake(estimation, group_context=group_context)
        if (
            cms_estimate["cms_kg_dia"] is None
            or abs(cms_estimate["cms_kg_dia"] - data.consumo_ms_kg)
            > base["numeric_tolerance"]
        ):
            raise HTTPException(
                422,
                "Consumo diverge da estimativa aplicada. Remova a origem estimada para ajustar manualmente.",
            )
    facts = {
        **lote_data,
        "insumos": ingredients,
        "consumo_ms_kg": data.consumo_ms_kg,
        "sistema": data.sistema,
        "particula_adequada": data.particula_adequada,
        "milho_seco_predominante": data.milho_seco_predominante,
    }
    if group_context:
        facts.update(
            estado=group_context["fase"],
            quantidade=group_context["numero_animais"],
            peso_kg=group_context["peso_medio_kg"],
            producao_l_dia=group_context["producao_media_l_dia"],
            dias_lactacao=(
                max(1, int(group_context["del_medio"]))
                if group_context["fase"] == "lactacao"
                else None
            ),
        )
    if data.dcad_meq_100g is not None:
        facts["dcad_meq_100g"] = data.dcad_meq_100g
    evidence = {k: v.model_dump() for k, v in data.evidence.items()}
    # Freeze per-ingredient evidence in the same facts used by historical audit.
    if base.get("certainty_policy"):
        fallback = evidence.get(
            "composicao",
            {
                "source": "tabela",
                "cf": base["certainty_policy"]["source_weights"]["tabela"],
            },
        )
        for ingredient, item in zip(ingredients, items):
            ingredient["evidencia_composicao"] = (
                item.get("evidencia_composicao") or fallback
            )
    unknown = set(evidence) - set(facts) - {"composicao", "consumo_ms_kg"}
    if unknown:
        raise HTTPException(
            422, f"Evidencia para fatos desconhecidos: {sorted(unknown)}"
        )
    chain = forward_chain(base, facts, evidence)
    profile, profile_trace = select_profile(base, facts, evidence)
    evidence_blocks = any(
        evidence.get(k, {}).get("cf", 1) <= 0 for k in ("composicao", "consumo_ms_kg")
    )
    transition_blocks = "restricao_transicao" in chain["memory"]
    if (
        transition_blocks
        or evidence_blocks
        or chain["blocked"]
        or any(
            c["cf"] <= 0
            for k, c in chain["memory"].items()
            if k in {x["fact"] for p in base["profiles"] for x in p["conditions"]}
        )
    ):
        profile = None
    result = {
        "status": "fora_escopo",
        "message": "Nenhum perfil suportado corresponde aos fatos. Confira o traco de selecao; pre-parto ate 21 dias e inicio da lactacao nao sao cobertos.",
        "profile": profile["id"] if profile else None,
        "profile_label": profile["label"] if profile else None,
        "profile_trace": profile_trace,
        "trace": [],
        "totals": None,
        "items": [],
        "missing_composition": [],
        "insumos_incompletos": [],
        "excluded_ingredients": [],
        "notice": base["notice"],
        "knowledge_version": base_record.versao,
        "knowledge_sha256": base_record.sha256,
        **({"grupo": group_context} if group_context else {}),
    }
    if evidence_blocks:
        result.update(
            status="dados_insuficientes",
            message="Evidencia de composicao ou consumo sem suporte positivo. Revise origem e CF antes de formular.",
        )
    elif any(p.get("missing_inputs") for p in profile_trace):
        result.update(
            status="dados_insuficientes",
            message="Ajuste T2 pendente: informe PB e energia de mantenca por animal/dia e sua fonte, ou revise os limites conflitantes. Consulte o traco de selecao.",
        )
    elif transition_blocks:
        result["message"] = (
            "R-03 bloqueou a formulacao: dieta anionica e manejo de calcio exigem limites revisados e composicao ionica, ausentes nesta base. Solicite revisao tecnica."
        )
    elif chain["blocked"] or any(p["profile_id"] == "conflito" for p in profile_trace):
        result["message"] = (
            "Decisao bloqueada por conflito entre regras ou perfis. Consulte a explicacao e revise fatos, especificidade ou prioridade."
        )
    if profile:
        quantities = [i["quantidade_kg_mn"] for i in items]
        if mode == "formular":
            solution = solve(
                base,
                profile,
                ingredients,
                items,
                data.consumo_ms_kg,
                data.insumos_excluidos_explicitamente,
                group_context=group_context,
            )
            result.update({k: v for k, v in solution.items() if k != "quantities"})
            if solution.get("excluded_ingredients"):
                result["exclusion_trace"] = [
                    {
                        **entry,
                        "status": "exclusao_explicita_auditada",
                        "message": "Insumo removido do espaco de otimizacao por solicitacao do usuario.",
                    }
                    for entry in solution["excluded_ingredients"]
                ]
            quantities = solution["quantities"]
        elif not any(quantities):
            raise HTTPException(
                422, "Informe ao menos uma quantidade positiva para verificar a dieta."
            )
        if quantities is not None:
            values = totals(ingredients, quantities)
            status, trace = evaluate(base, profile, values, data.consumo_ms_kg)
            # Inclusion limits are enforced and explained in verification as well as LP.
            for ingredient, item, q in zip(ingredients, items, quantities):
                ms = q * ingredient["ms_pct"] / 100
                ok = (
                    item["minimo_kg_ms"] - base["numeric_tolerance"]
                    <= ms
                    <= item["maximo_kg_ms"] + base["numeric_tolerance"]
                )
                trace.append(
                    {
                        "id": f"INCLUSAO-{ingredient['id']}",
                        "label": ingredient["nome"],
                        "unit": "kg MS/animal/dia",
                        "observed": ms,
                        "minimum": item["minimo_kg_ms"],
                        "maximum": item["maximo_kg_ms"],
                        "status": "atendida" if ok else "violada",
                        "message": "Limites de inclusao informados pelo usuario.",
                        "source_url": None,
                        "basis": "Entrada do usuario.",
                    }
                )
                if not ok:
                    status = "restricoes_violadas"
            excluded = (
                result.get("excluded_ingredients", []) if mode == "formular" else []
            )
            if mode == "formular" and status != "atende_perfil_demo":
                status = "falha_pos_verificacao"
            values["custo_lote_dia"] = values["custo_animal_dia"] * (
                group_context["numero_animais"] if group_context else lote.quantidade
            )
            result.update(
                status=status,
                trace=trace,
                totals=values,
                message=(
                    "Formulação recalculada com exclusões explícitas auditadas."
                    if excluded
                    else "Avaliacao do perfil demonstrativo concluida. Consulte as regras e os limites de aplicacao."
                ),
            )
            result["items"] = [
                {
                    "insumo_id": i["id"],
                    "nome": i["nome"],
                    "quantidade_kg_mn": q,
                    "quantidade_kg_ms": q * i["ms_pct"] / 100,
                    "custo": q * i["preco_kg_mn"],
                }
                for i, q in zip(ingredients, quantities)
            ]
    attach_reasoning(result, base, chain, profile, evidence)
    snapshot = {
        "request": data.model_dump(),
        "lote": lote_data,
        **({"grupo": group_context} if group_context else {}),
        "raca": require(db, Raca, lote.raca_id).nome,
        "insumos": ingredients,
        "solver_exclusions": result.get("exclusion_trace", []),
        "base": base,
        "base_sha256": base_record.sha256,
        "engine_version": app.version,
        "python_version": platform.python_version(),
        "sqlalchemy_version": sqlalchemy.__version__,
    }
    if cms_estimate is not None:
        snapshot["cms_estimate"] = cms_estimate
    sessao = SessaoInferencia(
        lote_id=lote.id,
        base_id=base_record.id,
        modo=mode,
        snapshot=snapshot,
        base_versao=base_record.versao,
        base_hash_sha256=base_record.sha256,
        cf_global=result.get("global_cf"),
        **({"criada_em": created_at} if created_at else {}),
    )
    db.add(sessao)
    db.flush()
    result["session_id"] = sessao.id
    sign_result(snapshot, result)
    try:
        verify_session(snapshot, result)
    except ValueError as error:
        db.rollback()
        raise HTTPException(409, str(error))
    db.add(ResultadoDieta(sessao_id=sessao.id, conteudo=result))
    rule_ids = {
        r.codigo: r.id
        for r in db.scalars(
            select(RegraNutricional).where(RegraNutricional.base_id == base_record.id)
        )
    }
    for seq, trace in enumerate(result["trace"]):
        db.add(
            ExplicacaoTraco(
                sessao_id=sessao.id,
                regra_id=rule_ids.get(trace["id"]),
                sequencia=seq,
                conteudo=trace,
            )
        )
    db.commit()
    return result


@app.post("/api/verificar", response_model=InferenceResponse)
def verificar(data: InferenciaRequest, db: Session = Depends(get_scoped_db)):
    return infer(data, "verificar", db)


@app.post("/api/formular", response_model=InferenceResponse)
def formular(data: FormulacaoRequest, db: Session = Depends(get_scoped_db)):
    return infer(data, "formular", db)


@app.get("/api/sessoes")
def sessions(db: Session = Depends(get_scoped_db)):
    rows = db.execute(
        select(SessaoInferencia, ResultadoDieta)
        .join(ResultadoDieta, ResultadoDieta.sessao_id == SessaoInferencia.id)
        .order_by(desc(SessaoInferencia.id))
        .limit(100)
    )
    return [
        {
            "id": s.id,
            "modo": s.modo,
            "lote": s.snapshot["lote"]["nome"],
            "criada_em": s.criada_em.isoformat() + "Z",
            "status": r.conteudo["status"],
        }
        for s, r in rows
    ]


@app.get("/api/sessoes/{id}")
def session_detail(id: int, db: Session = Depends(get_scoped_db)):
    s = require(db, SessaoInferencia, id)
    r = db.scalar(select(ResultadoDieta).where(ResultadoDieta.sessao_id == id))
    if s.base_versao is not None and (
        s.base_versao != s.snapshot["base"]["version"]
        or s.base_hash_sha256 != s.snapshot["base_sha256"]
        or s.cf_global != r.conteudo.get("global_cf")
    ):
        raise HTTPException(409, "Metadados relacionais divergem do snapshot auditado.")
    try:
        integrity = verify_session(s.snapshot, r.conteudo)
    except ValueError as error:
        raise HTTPException(409, str(error))
    return {
        "snapshot": s.snapshot,
        "result": r.conteudo,
        "modo": s.modo,
        "integrity": integrity,
        "metadata": {
            "usuario_id": s.usuario_id,
            "lote_id": s.lote_id,
            "base_versao": s.base_versao or s.snapshot["base"]["version"],
            "base_hash_sha256": s.base_hash_sha256 or s.snapshot["base_sha256"],
            "cf_global": s.cf_global if s.base_versao else r.conteudo.get("global_cf"),
            "criado_em": s.criada_em.isoformat() + "Z",
        },
    }


@app.get("/api/explicacao/por-que-pergunta")
def why_question(fato: str, db: Session = Depends(get_scoped_db)):
    base = require(db, BaseConhecimento, app.state.base_id)
    checked_base(base)
    return explain_question(base.conteudo, fato)


@app.get("/api/explicacao/{kind}")
def explanation(kind: str, sessao_id: int, db: Session = Depends(get_scoped_db)):
    if kind not in {"por-que-perfil", "como-concluiu", "gargalo-formulacao"}:
        raise HTTPException(404, "Explicacao desconhecida.")
    session = session_detail(sessao_id, db)
    return explain_session(kind, session["snapshot"], session["result"])


@app.post("/api/estimar-cms")
def estimate(data: CmsRequest, user=Depends(get_current_user)):
    return estimate_intake(data)


@app.post("/api/comparar")
def compare(data: ComparisonRequest, db: Session = Depends(get_scoped_db)):
    manual = session_detail(data.manual_session_id, db)
    formulated = session_detail(data.formulated_session_id, db)
    try:
        return compare_sessions(manual, formulated, data.dias)
    except ValueError as error:
        raise HTTPException(409, str(error))


@app.post("/api/sessoes/{id}/batida")
def mixing(id: int, data: MixingRequest, db: Session = Depends(get_scoped_db)):
    session = session_detail(id, db)
    try:
        return mixing_report(session, data)
    except ValueError as error:
        raise HTTPException(422, str(error))


# Explicit API fallback keeps static SPA hosting from swallowing unknown REST paths.
@app.api_route(
    "/api/{path:path}",
    methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    include_in_schema=False,
)
def unknown_api(path: str):
    raise HTTPException(404, "Endpoint da API nao encontrado.")


# Existing files are served normally; browser navigation falls back to the SPA.
# API routes above always retain JSON errors rather than receiving index.html.
DIST = Path(__file__).resolve().parents[2] / "frontend" / "dist"
if DIST.exists():

    @app.get("/{path:path}", include_in_schema=False)
    def frontend_page(path: str):
        if path == "api" or path.startswith("api/"):
            raise HTTPException(404, "Endpoint da API nao encontrado.")
        target = (DIST / path).resolve()
        if not target.is_relative_to(DIST.resolve()):
            raise HTTPException(404, "Arquivo não encontrado.")
        if target.is_file():
            return FileResponse(target)
        if path.startswith(("assets/", "vendor/")) or Path(path).suffix:
            raise HTTPException(404, "Arquivo não encontrado.")
        return FileResponse(DIST / "index.html", headers={"Cache-Control": "no-store"})
