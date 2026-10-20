import os
from pathlib import Path
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DEFAULT_DB = Path(__file__).resolve().parents[1] / "akinutri.db"
DATABASE_URL = os.getenv("AKINUTRI_DATABASE_URL", f"sqlite:///{DEFAULT_DB.as_posix()}")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


@event.listens_for(engine, "connect")
def foreign_keys(connection, _):
    connection.execute("PRAGMA foreign_keys=ON")


SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    with SessionLocal() as session:
        yield session


def install_immutability_guards(target_engine):
    """SQLite enforces append-only audit records, even outside the ORM."""
    tables = (
        "sessoes_inferencia",
        "resultados_dieta",
        "explicacoes_traco",
        "bases_conhecimento",
        "regras_nutricionais",
    )
    with target_engine.begin() as connection:
        for table in tables:
            for operation in ("UPDATE", "DELETE"):
                connection.execute(
                    text(
                        f"CREATE TRIGGER IF NOT EXISTS immutable_{table}_{operation.lower()} BEFORE {operation} ON {table} BEGIN SELECT RAISE(ABORT, 'Registro de auditoria imutavel'); END"
                    )
                )
