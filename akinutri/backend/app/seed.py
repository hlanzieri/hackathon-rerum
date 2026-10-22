from sqlalchemy import select
from .database import Base, engine, SessionLocal
from .models import Raca, InsumoAlimentar, BaseConhecimento, RegraNutricional
from .engine_rules import load_base

# Valores fornecidos pela equipe; referencias bibliograficas por amostra pendentes.
# Nutrientes em % MS (EL em Mcal/kg MS), MS em % MN e preco em R$/kg MN.
INSUMOS_SEED = [
    {
        "nome": "Silagem de Milho (Boa Qualidade)",
        "ms_pct": 35.0,
        "pb_pct": 7.5,
        "fdn_pct": 45.0,
        "amido_pct": 30.0,
        "calcio_pct": 0.25,
        "fosforo_pct": 0.20,
        "el_mcal_kg": 1.52,
        "preco_kg_mn": 0.38,
        "categoria": "volumoso",
    },
    {
        "nome": "Feno de Capim-Tifton 85",
        "ms_pct": 88.0,
        "pb_pct": 12.0,
        "fdn_pct": 70.0,
        "amido_pct": 1.5,
        "calcio_pct": 0.40,
        "fosforo_pct": 0.20,
        "el_mcal_kg": 1.10,
        "preco_kg_mn": 0.95,
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
        "calcio_pct": 0.30,
        "fosforo_pct": 0.65,
        "el_mcal_kg": 1.92,
        "preco_kg_mn": 2.15,
        "categoria": "concentrado_proteico",
    },
    {
        "nome": "Polpa Cítrica Peletizada",
        "ms_pct": 89.0,
        "pb_pct": 6.8,
        "fdn_pct": 22.0,
        "amido_pct": 0.0,
        "calcio_pct": 1.80,
        "fosforo_pct": 0.12,
        "el_mcal_kg": 1.75,
        "preco_kg_mn": 1.12,
        "categoria": "concentrado_energetico",
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
        "preco_kg_mn": 4.50,
        "categoria": "mineral",
    },
]
SEED_SOURCE = "DEMO: valores e precos fornecidos pela equipe; referencia numerica NASEM/CQAL/Embrapa nao comprovada por item. Substituir por laudo/cotacao. Nome do nucleo nao certifica efeito anionico; sem composicao ionica/DCAD."


def ingredient_values(item):
    return {
        (
            "ca_pct"
            if key == "calcio_pct"
            else "p_pct" if key == "fosforo_pct" else key
        ): value
        for key, value in item.items()
    }


# Compatibility export used by the deterministic preview, with the new values.
SEED = [
    tuple(
        ingredient_values(item)[key]
        for key in (
            "nome",
            "categoria",
            "ms_pct",
            "pb_pct",
            "fdn_pct",
            "amido_pct",
            "el_mcal_kg",
            "ca_pct",
            "p_pct",
            "preco_kg_mn",
        )
    )
    for item in INSUMOS_SEED
]


def seed(db):
    for name in ("Holandesa", "Gir Leiteiro", "Girolando", "Jersey"):
        if not db.scalar(select(Raca).where(Raca.nome == name)):
            db.add(Raca(nome=name))
    for item in INSUMOS_SEED:
        # A private ingredient with the same name must not suppress a global row.
        if not db.scalar(
            select(InsumoAlimentar).where(
                InsumoAlimentar.nome == item["nome"],
                InsumoAlimentar.usuario_id.is_(None),
            )
        ):
            db.add(InsumoAlimentar(**ingredient_values(item), fonte=SEED_SOURCE))
    content, digest = load_base()
    existing = db.scalar(
        select(BaseConhecimento).where(BaseConhecimento.versao == content["version"])
    )
    if existing and existing.sha256 != digest:
        raise RuntimeError(
            "Base publicada foi alterada. Incremente a versao para preservar auditoria."
        )
    if not existing:
        existing = BaseConhecimento(
            versao=content["version"], sha256=digest, conteudo=content
        )
        db.add(existing)
        db.flush()
        for rule in content["rules"]:
            db.add(
                RegraNutricional(base_id=existing.id, codigo=rule["id"], conteudo=rule)
            )
    db.commit()
    return existing.id


def seed_demo(db, password="senha123", *, reset_password=False):
    from .demo_seed import seed_demo as populate

    return populate(db, password, reset_password=reset_password)


if __name__ == "__main__":
    import argparse
    import os
    from .database import migrate_ownership, install_immutability_guards

    parser = argparse.ArgumentParser(
        description="Popular a propriedade fictícia Ouro Verde."
    )
    parser.add_argument(
        "--reset-password",
        action="store_true",
        help="Redefinir somente a senha da conta da seed e revogar suas sessões.",
    )
    options = parser.parse_args()
    Base.metadata.create_all(engine)
    migrate_ownership(engine)
    install_immutability_guards(engine)
    with SessionLocal() as db:
        print(
            seed_demo(
                db,
                os.getenv("AKINUTRI_SEED_PASSWORD", "senha123"),
                reset_password=options.reset_password,
            )
        )
