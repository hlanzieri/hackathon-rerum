"""Explicit fixtures, isolated from the automatically loaded reference catalog."""

from datetime import datetime, timedelta, timezone
from sqlalchemy import select
from .auth import password_hash
from .models import (
    UserAccount,
    Lote,
    Raca,
    InsumoAlimentar,
    SessaoInferencia,
    ResultadoDieta,
    GrupoProducao,
)
from .schemas import LoteCreate, InferenciaRequest

DEMO_EMAIL = "carlos@fazendaouroverde.com.br"


def seed_demo(db, password="senha123", *, reset_password=False):
    from .seed import seed
    from . import main

    main.app.state.base_id = seed(db)
    user = db.scalar(select(UserAccount).where(UserAccount.email == DEMO_EMAIL))
    if not user:
        if not password or (password != "senha123" and len(password) < 8):
            raise ValueError("Defina uma senha de seed com pelo menos 8 caracteres.")
        user = UserAccount(
            email=DEMO_EMAIL,
            name="Dr. Carlos Eduardo de Moraes",
            password_hash=password_hash(password),
            cargo="zootecnista",
            fazenda_nome="Fazenda Ouro Verde · Juiz de Fora / MG (fictícia)",
        )
        db.add(user)
        db.flush()
    elif not user.fazenda_nome.endswith("(fictícia)"):
        raise ValueError(
            "Este e-mail já pertence a uma conta que não foi criada pela seed."
        )
    if reset_password:
        user.password_hash = password_hash(password)
        user.session_version += 1
    previous_owner = db.info.get("usuario_id")
    db.info["usuario_id"] = user.id
    try:
        lots = []
        groups = []
        scenarios = [
            (
                "Lote 01 — Holandesas Alta Produção (fictício)",
                "Holandesa",
                45,
                630,
                "lactacao",
                32,
                110,
                None,
            ),
            (
                "Lote 02 — Girolando Lote Médio (fictício)",
                "Girolando",
                30,
                520,
                "lactacao",
                18,
                160,
                None,
            ),
            (
                "Lote 03 — Vacas Secas (fictício)",
                "Holandesa",
                15,
                580,
                "seca",
                0,
                None,
                30,
            ),
        ]
        for name, breed, count, weight, state, milk, days, calving in scenarios:
            lot = db.scalar(select(Lote).where(Lote.nome == name))
            if not lot:
                race = db.scalar(select(Raca).where(Raca.nome == breed))
                fields = LoteCreate(
                    nome=name,
                    raca_id=race.id,
                    quantidade=count,
                    peso_kg=weight,
                    idade_meses=48,
                    ordem_paricao=3,
                    estado=state,
                    destinacao="leite",
                    producao_l_dia=milk,
                    dias_lactacao=days,
                    dias_ate_parto=calving,
                )
                lot = Lote(**fields.model_dump())
                db.add(lot)
                db.flush()
            lots.append(lot)
            group_name = f"GP — {lot.nome}"
            group = db.scalar(
                select(GrupoProducao).where(GrupoProducao.nome == group_name)
            )
            if not group:
                group = GrupoProducao(
                    nome=group_name,
                    fase=lot.estado,
                    numero_animais=lot.quantidade,
                    del_medio=lot.dias_lactacao or 0,
                    peso_medio_kg=lot.peso_kg,
                    producao_media_l_dia=lot.producao_l_dia,
                    ecc_medio=3,
                    fracao_multiparas=1,
                )
                db.add(group)
                db.flush()
            groups.append(group)
        ingredients = [
            ("Silagem de Milho · Ouro Verde", "volumoso", 35, 7.8, 46, 31, 1.52, 0.38),
            (
                "Feno de Capim-Tifton · Ouro Verde",
                "volumoso",
                88,
                11.2,
                66,
                2,
                1.10,
                0.95,
            ),
            (
                "Milho Moído Seco · Ouro Verde",
                "concentrado",
                88,
                8.8,
                11.5,
                71,
                2.05,
                1.28,
            ),
            (
                "Farelo de Soja 46 · Ouro Verde",
                "concentrado",
                89,
                46.5,
                13.8,
                3,
                1.92,
                2.15,
            ),
            (
                "Polpa Cítrica Peletizada · Ouro Verde",
                "concentrado",
                89,
                6.8,
                23.5,
                6,
                1.75,
                1.12,
            ),
            (
                "Núcleo Mineral · Ouro Verde",
                "mineral",
                98,
                None,
                None,
                None,
                None,
                4.50,
            ),
        ]
        for name, category, ms, pb, fdn, starch, energy, price in ingredients:
            if not db.scalar(
                select(InsumoAlimentar).where(InsumoAlimentar.nome == name)
            ):
                db.add(
                    InsumoAlimentar(
                        nome=name,
                        categoria=category,
                        ms_pct=ms,
                        pb_pct=pb,
                        fdn_pct=fdn,
                        amido_pct=starch,
                        el_mcal_kg=energy,
                        ca_pct=None,
                        p_pct=None,
                        preco_kg_mn=price,
                        fonte="Cenário fictício fornecido. Valores e preços ilustrativos, sem laudo; Ca/P não informados. Validar análise e cotação. Não equivale a indicação de núcleo aniônico.",
                    )
                )
        db.commit()
        # Audited examples use the complete synthetic catalog. Never invent
        # missing mineral composition to force an LP solution.
        catalog = list(
            db.scalars(
                select(InsumoAlimentar)
                .where(InsumoAlimentar.usuario_id.is_(None))
                .order_by(InsumoAlimentar.id)
            )
        )
        entries = [
            {"insumo_id": i.id, "maximo_kg_ms": 0.5 if i.categoria == "mineral" else 40}
            for i in catalog
        ]
        first_result = None
        for index, (lot, mode, intake) in enumerate(
            [
                (lots[0], "formular", 22),
                (lots[0], "verificar", 22),
                (lots[1], "formular", 18),
            ]
        ):
            existing = db.scalar(
                select(SessaoInferencia).where(
                    SessaoInferencia.lote_id == lot.id, SessaoInferencia.modo == mode
                )
            )
            if existing:
                if index == 0:
                    first_result = db.scalar(
                        select(ResultadoDieta).where(
                            ResultadoDieta.sessao_id == existing.id
                        )
                    ).conteudo
                continue
            items = [dict(item) for item in entries]
            if mode == "verificar":
                quantities = {
                    i["insumo_id"]: i["quantidade_kg_mn"]
                    for i in first_result.get("items", [])
                }
                if not quantities:
                    raise ValueError(
                        "A formulação da seed não gerou uma dieta verificável."
                    )
                for item in items:
                    item["quantidade_kg_mn"] = quantities.get(item["insumo_id"], 0)
            request = InferenciaRequest(
                lote_id=lot.id,
                grupo_id=groups[0 if index < 2 else 1].id,
                consumo_ms_kg=intake,
                sistema="tmr",
                particula_adequada=True,
                milho_seco_predominante=True,
                itens=items,
            )
            result = main.infer(
                request,
                mode,
                db,
                created_at=datetime.now(timezone.utc) - timedelta(days=7 - index),
            )
            if index == 0:
                first_result = result
        return {"email": user.email, "lotes": len(lots), "sessoes": 3}
    except Exception:
        db.rollback()
        raise
    finally:
        if previous_owner is None:
            db.info.pop("usuario_id", None)
        else:
            db.info["usuario_id"] = previous_owner
