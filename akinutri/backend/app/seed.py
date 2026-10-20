from sqlalchemy import select
from .database import Base, engine, SessionLocal
from .models import Raca, InsumoAlimentar, BaseConhecimento, RegraNutricional
from .engine_rules import load_base

SEED = [
    ("Silagem de milho", "volumoso", 35, 8, 45, 30, 1.5, 0.25, 0.22, 0.32),
    ("Feno de capim", "volumoso", 88, 10, 68, 2, 1.05, 0.45, 0.22, 0.95),
    ("Milho seco moido", "concentrado", 88, 9, 12, 70, 2.05, 0.03, 0.28, 1.25),
    ("Farelo de soja", "concentrado", 89, 48, 14, 3, 1.9, 0.30, 0.65, 2.20),
    ("Farelo de trigo", "concentrado", 89, 17, 42, 22, 1.5, 0.13, 1.05, 1.10),
    ("Mistura mineral DEMO", "mineral", 98, 0, 0, 0, 0, 22, 7, 4.0),
    ("Calcario calcitico DEMO", "mineral", 99, 0, 0, 0, 0, 38, 0, 0.7),
]


def seed(db):
    for name in ("Holandesa", "Gir Leiteiro", "Girolando", "Jersey"):
        if not db.scalar(select(Raca).where(Raca.nome == name)):
            db.add(Raca(nome=name))
    keys = [
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
    ]
    for row in SEED:
        if not db.scalar(select(InsumoAlimentar).where(InsumoAlimentar.nome == row[0])):
            db.add(
                InsumoAlimentar(
                    **dict(zip(keys, row)),
                    fonte="DEMO: composicao e preco sinteticos; substituir por analise bromatologica e cotacao local."
                )
            )
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
