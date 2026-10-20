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
)
from .schemas import (
    LoteCreate,
    LoteRead,
    InsumoCreate,
    InsumoRead,
    InferenciaRequest,
    CmsRequest,
    ComparisonRequest,
    MixingRequest,
)
from .seed import seed
from .engine_rules import select_profile, evaluate, totals
from .engine_solver import solve
from .engine_intake import estimate_intake
from .audit import verify_base, sign_result, verify_session
from .reports import compare_sessions, mixing_report
from .auth import (
    router as auth_router,
    get_scoped_db,
    get_current_user,
    check_request_origin,
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
    dependencies=[Depends(check_request_origin)],
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
    require(db, Raca, data.raca_id)
    lote = Lote(**data.model_dump())
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
    lote = require(db, Lote, data.lote_id)
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
        if (
            estimation.peso_kg,
            estimation.dias_lactacao,
            estimation.estado,
            estimation.raca,
        ) != (
            lote.peso_kg,
            lote.dias_lactacao,
            lote.estado,
            require(db, Raca, lote.raca_id).nome,
        ):
            raise HTTPException(
                422,
                "Estimativa de CMS pertence a outro contexto de lote. Recalcule ou informe consumo manual.",
            )
        cms_estimate = estimate_intake(estimation)
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
        "sistema": data.sistema,
        "particula_adequada": data.particula_adequada,
        "milho_seco_predominante": data.milho_seco_predominante,
    }
    profile, profile_trace = select_profile(base, facts)
    result = {
        "status": "fora_escopo",
        "message": "Nenhum perfil suportado corresponde aos fatos. Confira o traco de selecao; pre-parto ate 21 dias e inicio da lactacao nao sao cobertos.",
        "profile": profile["id"] if profile else None,
        "profile_label": profile["label"] if profile else None,
        "profile_trace": profile_trace,
        "trace": [],
        "totals": None,
        "items": [],
        "notice": base["notice"],
        "knowledge_version": base_record.versao,
        "knowledge_sha256": base_record.sha256,
    }
    if profile:
        quantities = [i["quantidade_kg_mn"] for i in items]
        if mode == "formular":
            solution = solve(base, profile, ingredients, items, data.consumo_ms_kg)
            result.update({k: v for k, v in solution.items() if k != "quantities"})
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
            if mode == "formular" and status != "atende_perfil_demo":
                status = "falha_pos_verificacao"
            values["custo_lote_dia"] = values["custo_animal_dia"] * lote.quantidade
            result.update(
                status=status,
                trace=trace,
                totals=values,
                message="Avaliacao do perfil demonstrativo concluida. Consulte as regras e os limites de aplicacao.",
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
    snapshot = {
        "request": data.model_dump(),
        "lote": lote_data,
        "raca": require(db, Raca, lote.raca_id).nome,
        "insumos": ingredients,
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


@app.post("/api/verificar")
def verificar(data: InferenciaRequest, db: Session = Depends(get_scoped_db)):
    return infer(data, "verificar", db)


@app.post("/api/formular")
def formular(data: InferenciaRequest, db: Session = Depends(get_scoped_db)):
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
    try:
        integrity = verify_session(s.snapshot, r.conteudo)
    except ValueError as error:
        raise HTTPException(409, str(error))
    return {
        "snapshot": s.snapshot,
        "result": r.conteudo,
        "modo": s.modo,
        "integrity": integrity,
    }


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
