"""Golden seed scoped to the presentation account; composition supplied by the presentation owner.

Run: python seed_apresentacao.py
Optionally override the built-in table with a JSON list using --composicoes.
"""

import argparse
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from sqlalchemy import delete, select
from app.auth import password_hash, password_matches
from app.database import (
    Base,
    SessionLocal,
    engine,
    migrate_ownership,
    install_immutability_guards,
)
from app.models import (
    UserAccount,
    Lote,
    GrupoProducao,
    InsumoAlimentar,
    Raca,
    SessaoInferencia,
    HistoricoDietaGP,
    HistoricoMovimentacaoAnimal,
)
from app.schemas import InsumoCreate, LoteCreate
from app.seed import seed

EMAIL = "carlos@fazendaouroverde.com.br"
# Attribution supplied by the user, not an independently verified laboratory certificate.
SOURCE = (
    "Tabela fornecida pelo usuário para o pitch RERUM 2026, atribuída a NASEM 2021/CQAL Embrapa; "
    "comprovação por item pendente. Nutrientes em % MS; EL em Mcal/kg MS; preço R$/kg MN. "
    "O nome do núcleo não certifica efeito aniônico sem composição iônica/DCAD."
)
INSUMOS_SEED_OFICIAL = [
    {
        "nome": "Silagem de Milho (Boa Qualidade)",
        "ms_pct": 35.0,
        "pb_pct": 7.5,
        "fdn_pct": 45.0,
        "amido_pct": 30.0,
        "calcio_pct": 0.25,
        "fosforo_pct": 0.2,
        "el_mcal_kg": 1.52,
        "preco_kg_mn": 0.38,
        "categoria": "volumoso",
    },
    {
        "nome": "Milho Moído Seco",
        "ms_pct": 88.0,
        "pb_pct": 9.0,
        "fdn_pct": 12.0,
        "amido_pct": 70.0,
        "calcio_pct": 0.03,
        "fosforo_pct": 0.28,
        "el_mcal_kg": 2.05,
        "preco_kg_mn": 1.28,
        "categoria": "concentrado_energetico",
    },
    {
        "nome": "Farelo de Soja 46",
        "ms_pct": 89.0,
        "pb_pct": 46.0,
        "fdn_pct": 14.0,
        "amido_pct": 3.0,
        "calcio_pct": 0.3,
        "fosforo_pct": 0.65,
        "el_mcal_kg": 1.92,
        "preco_kg_mn": 2.15,
        "categoria": "concentrado_proteico",
    },
    {
        "nome": "Núcleo Mineral Aniónico / Lactação",
        "ms_pct": 98.0,
        "pb_pct": 0.0,
        "fdn_pct": 0.0,
        "amido_pct": 0.0,
        "calcio_pct": 20.0,
        "fosforo_pct": 6.0,
        "el_mcal_kg": 0.0,
        "preco_kg_mn": 4.5,
        "categoria": "mineral",
    },
    {
        "nome": "Feno de Teste (Incompleto)",
        "categoria": "volumoso",
        "ms_pct": 85.0,
        "pb_pct": 9.0,
        "fdn_pct": 68.0,
        "amido_pct": 1.0,
        "el_mcal_kg": 1.1,
        "calcio_pct": None,
        "fosforo_pct": None,
        "preco_kg_mn": 0.8,
    },
]
NAMES = {item["nome"] for item in INSUMOS_SEED_OFICIAL[:4]}
NUTRIENTS = (
    "ms_pct",
    "pb_pct",
    "fdn_pct",
    "amido_pct",
    "el_mcal_kg",
    "ca_pct",
    "p_pct",
)
SCENARIOS = [
    ("Lote 1 - Alta Lactação", "lactacao", 45, 650, 120, 35.5, 2, 48),
    ("Lote 2 - Baixa Lactação", "lactacao", 25, 600, 220, 15.0, 3, 60),
    ("Lote 3 - Vacas Secas", "seca", 15, 700, 0, 0, 3, 60),
    ("Lote 4 - Novilhas em Recria", "recria", 30, 350, 0, 0, 1, 24),
]


def validate_composition(values):
    items = [
        InsumoCreate.model_validate({"fonte": SOURCE, **value}).model_dump()
        for value in values
    ]
    if len(items) != 4 or {item["nome"] for item in items} != NAMES:
        raise ValueError(
            "Informe exatamente os quatro insumos do pitch, sem duplicatas."
        )
    for item in items:
        missing = [key for key in NUTRIENTS if item[key] is None]
        if missing:
            raise ValueError(f"{item['nome']}: composição incompleta: {missing}")
    return items


def seed_apresentacao(db, compositions=None):
    # Validate before changing any data. Never replace unknown mineral values by zero.
    compositions = validate_composition(
        compositions if compositions is not None else INSUMOS_SEED_OFICIAL[:4]
    )
    seed(db)
    user = db.scalar(select(UserAccount).where(UserAccount.email == EMAIL))
    if user is None:
        user = UserAccount(email=EMAIL, password_hash=password_hash("senha123"))
        user.name = "Dr. Carlos Eduardo de Moraes"
        user.cargo = "zootecnista"
        user.fazenda_nome = "Fazenda Ouro Verde"
        user.conta_demo = True
        db.add(user)
        db.flush()
    user.name = "Dr. Carlos Eduardo de Moraes"
    user.cargo = "zootecnista"
    user.fazenda_nome = "Fazenda Ouro Verde"
    user.conta_demo = True
    if not password_matches("senha123", user.password_hash):
        user.password_hash = password_hash("senha123")
        user.session_version += 1
    owner = user.id
    lots = db.scalars(
        select(Lote).where(Lote.usuario_id == owner).order_by(Lote.id)
    ).all()
    groups = db.scalars(
        select(GrupoProducao)
        .where(GrupoProducao.usuario_id == owner)
        .order_by(GrupoProducao.id)
    ).all()
    race = db.scalar(select(Raca).where(Raca.nome == "Holandesa"))
    used_lots, used_groups = [], []
    for index, (name, phase, count, weight, days, milk, parity, age) in enumerate(
        SCENARIOS
    ):
        values = LoteCreate(
            nome=name,
            raca_id=race.id,
            quantidade=count,
            peso_kg=weight,
            idade_meses=age,
            ordem_paricao=parity,
            estado=phase,
            producao_l_dia=milk,
            dias_lactacao=days if phase == "lactacao" else None,
            dias_ate_parto=45 if phase == "seca" else None,
            tmr_habilitado=phase == "lactacao",
        ).model_dump(exclude={"raca"})
        lot = lots[index] if index < len(lots) else Lote(usuario_id=owner)
        for key, value in values.items():
            setattr(lot, key, value)
        db.add(lot)
        group = (
            groups[index] if index < len(groups) else GrupoProducao(usuario_id=owner)
        )
        for key, value in dict(
            nome=name,
            fase=phase,
            numero_animais=count,
            peso_medio_kg=weight,
            del_medio=days,
            producao_media_l_dia=milk,
            ecc_medio=3,
            fracao_multiparas=0 if phase == "recria" else 1,
            ativo=True,
            descricao="Golden seed de apresentação RERUM 2026",
        ).items():
            setattr(group, key, value)
        db.add(group)
        used_lots.append(lot)
        used_groups.append(group)
    # Audit snapshots and their referenced lots are retained; unreferenced extras can go.
    retained = []
    for lot in lots[4:]:
        referenced = db.scalar(
            select(SessaoInferencia.id)
            .where(SessaoInferencia.lote_id == lot.id)
            .limit(1)
        )
        if referenced:
            retained.append(lot.id)
        else:
            db.delete(lot)
    for group in groups[4:]:
        referenced = db.scalar(
            select(HistoricoDietaGP.id)
            .where(HistoricoDietaGP.grupo_producao_id == group.id)
            .limit(1)
        ) or db.scalar(
            select(HistoricoMovimentacaoAnimal.id)
            .where(HistoricoMovimentacaoAnimal.grupo_producao_id == group.id)
            .limit(1)
        )
        if referenced:
            group.ativo = False
        else:
            db.delete(group)
    db.execute(delete(InsumoAlimentar).where(InsumoAlimentar.usuario_id == owner))
    for values in compositions:
        db.add(InsumoAlimentar(usuario_id=owner, **values))
    db.add(
        InsumoAlimentar(
            usuario_id=owner,
            **InsumoCreate(
                nome="Feno de Teste (Incompleto)",
                categoria="volumoso",
                ms_pct=85,
                pb_pct=9,
                fdn_pct=68,
                amido_pct=1,
                el_mcal_kg=1.1,
                ca_pct=None,
                p_pct=None,
                preco_kg_mn=0.80,
                fonte="Fixture intencional de auditoria; não usar como laudo de alimento.",
            ).model_dump(),
        )
    )
    db.flush()
    summary = {
        "usuario_id": owner,
        "email": EMAIL,
        "grupos": [g.id for g in used_groups],
        "lotes": [lot.id for lot in used_lots],
        "insumos_privados": 5,
        "lotes_historicos_preservados": retained,
    }
    db.commit()
    return summary


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--composicoes", type=Path, default=None)
    args = parser.parse_args()
    if args.composicoes is not None and not args.composicoes.is_file():
        parser.error("Arquivo de composição não encontrado. Nenhum dado foi alterado.")
    values = (
        json.loads(args.composicoes.read_text(encoding="utf-8-sig"))
        if args.composicoes
        else INSUMOS_SEED_OFICIAL[:4]
    )
    compositions = validate_composition(values)
    # SQLite online backup includes WAL state and never deletes an existing backup.
    database_path = Path(engine.url.database)
    backup = None
    if database_path.exists():
        folder = Path(__file__).parent.parent / "backups"
        folder.mkdir(exist_ok=True)
        backup = (
            folder / f"pre-golden-seed-{datetime.now(timezone.utc):%Y%m%dT%H%M%S%fZ}.db"
        )
        with sqlite3.connect(database_path) as source, sqlite3.connect(
            backup
        ) as target:
            source.backup(target)
    Base.metadata.create_all(engine)
    migrate_ownership(engine)
    install_immutability_guards(engine)
    with SessionLocal() as db:
        result = seed_apresentacao(db, compositions)
    print(
        json.dumps(
            {**result, "backup": str(backup) if backup else None}, ensure_ascii=False
        )
    )


if __name__ == "__main__":
    main()
