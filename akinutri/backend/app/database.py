import os
import re
from pathlib import Path

from dotenv import load_dotenv
from sqlalchemy import create_engine, event, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from sqlalchemy.engine import make_url

DEFAULT_DB = Path(__file__).resolve().parents[1] / "akinutri.db"
load_dotenv(Path(__file__).resolve().parents[2] / ".env", override=False)
DATABASE_URL = os.getenv("AKINUTRI_DATABASE_URL", f"sqlite:///{DEFAULT_DB.as_posix()}")
if not DATABASE_URL.startswith("sqlite:///"):
    raise RuntimeError("AkiNutri aceita somente um banco SQLite em arquivo local.")
_database_url = make_url(DATABASE_URL)
_database_path = Path(_database_url.database)
if not _database_path.is_absolute():
    _database_path = DEFAULT_DB.parent / _database_path
DATABASE_URL = _database_url.set(
    database=_database_path.resolve().as_posix()
).render_as_string(hide_password=False)
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


def migrate_ownership(target_engine):
    """Additive migration: preserve historical JSON, signatures and append-only triggers."""
    from sqlalchemy import inspect

    with target_engine.begin() as connection:
        inspector = inspect(connection)
        group_columns = (
            {column["name"] for column in inspector.get_columns("grupos_producao")}
            if inspector.has_table("grupos_producao")
            else set()
        )
        for name, definition in (
            ("numero_animais", "INTEGER"),
            ("del_medio", "FLOAT"),
            ("peso_medio_kg", "FLOAT"),
            ("producao_media_l_dia", "FLOAT"),
            ("ecc_medio", "FLOAT"),
            ("fracao_multiparas", "FLOAT"),
        ):
            if group_columns and name not in group_columns:
                connection.execute(
                    text(
                        f'ALTER TABLE grupos_producao ADD COLUMN "{name}" {definition}'
                    )
                )
        for table in Base.metadata.sorted_tables:
            columns = {column["name"] for column in inspector.get_columns(table.name)}
            if "usuario_id" in table.c and "usuario_id" not in columns:
                connection.execute(
                    text(
                        f'ALTER TABLE "{table.name}" ADD COLUMN usuario_id INTEGER REFERENCES users(id)'
                    )
                )
                connection.execute(
                    text(
                        f'CREATE INDEX IF NOT EXISTS "ix_{table.name}_usuario_id" ON "{table.name}" (usuario_id)'
                    )
                )
        columns = {c["name"] for c in inspector.get_columns("users")}
        for name, definition in (
            ("cargo", "VARCHAR(30) NOT NULL DEFAULT 'produtor'"),
            ("fazenda_nome", "VARCHAR(180) NOT NULL DEFAULT ''"),
            ("session_version", "INTEGER NOT NULL DEFAULT 0"),
        ):
            if name not in columns:
                connection.execute(
                    text(f"ALTER TABLE users ADD COLUMN {name} {definition}")
                )
    migrate_scoped_unique_constraints(target_engine)


def migrate_scoped_unique_constraints(target_engine):
    """Replace legacy global keys with per-user keys in existing SQLite files."""
    scoped_tables = (
        ("grupos_producao", "nome", "uq_grupo_usuario_nome"),
        ("animais", "brinco", "uq_animal_usuario_brinco"),
        ("insumos", "nome", "uq_insumo_usuario_nome"),
    )

    def has_legacy_unique(connection, table, column):
        for index in connection.execute(text(f'PRAGMA index_list("{table}")')).mappings():
            if not index["unique"]:
                continue
            columns = [
                row["name"]
                for row in connection.execute(
                    text(f'PRAGMA index_info("{index["name"]}")')
                ).mappings()
            ]
            if columns == [column]:
                return True
        return False

    # SQLite cannot remove a table-level UNIQUE constraint. Rebuild only tables
    # that still have the legacy global key, preserving IDs and all columns.
    with target_engine.connect() as connection:
        connection.execution_options(isolation_level="AUTOCOMMIT").exec_driver_sql(
            "PRAGMA foreign_keys=OFF"
        )
        connection.commit()
        try:
            with connection.begin():
                for table, column, constraint_name in scoped_tables:
                    if not has_legacy_unique(connection, table, column):
                        continue
                    create_sql = connection.execute(
                        text(
                            "SELECT sql FROM sqlite_master "
                            "WHERE type = 'table' AND name = :name"
                        ),
                        {"name": table},
                    ).scalar_one()
                    indexes = connection.execute(
                        text(
                            "SELECT sql FROM sqlite_master "
                            "WHERE type = 'index' AND tbl_name = :name AND sql IS NOT NULL"
                        ),
                        {"name": table},
                    ).scalars().all()
                    columns = [
                        entry["name"]
                        for entry in connection.execute(
                            text(f'PRAGMA table_info("{table}")')
                        ).mappings()
                    ]
                    quoted_columns = ", ".join(f'"{name}"' for name in columns)
                    # SQLAlchemy emits this legacy constraint as UNIQUE (column).
                    create_sql = re.sub(
                        rf",\s*UNIQUE\s*\(\s*\"?{re.escape(column)}\"?\s*\)",
                        "",
                        create_sql,
                        flags=re.IGNORECASE,
                    )
                    create_sql = create_sql.rsplit(")", 1)[0] + (
                        f', CONSTRAINT "{constraint_name}" '
                        f'UNIQUE ("usuario_id", "{column}")\n)'
                    )
                    legacy_table = f"{table}_legacy_global_unique"
                    connection.execute(
                        text(f'ALTER TABLE "{table}" RENAME TO "{legacy_table}"')
                    )
                    connection.execute(text(create_sql))
                    connection.execute(
                        text(
                            f'INSERT INTO "{table}" ({quoted_columns}) '
                            f'SELECT {quoted_columns} FROM "{legacy_table}"'
                        )
                    )
                    connection.execute(text(f'DROP TABLE "{legacy_table}"'))
                    for index_sql in indexes:
                        if not index_sql.lstrip().upper().startswith("CREATE UNIQUE"):
                            connection.execute(text(index_sql))
        finally:
            connection.execution_options(isolation_level="AUTOCOMMIT").exec_driver_sql(
                "PRAGMA foreign_keys=ON"
            )


@event.listens_for(Session, "do_orm_execute")
def scope_owned_queries(state):
    """Apply tenant predicates to selects, joins and primary-key loads alike."""
    from sqlalchemy.orm import with_loader_criteria
    from .models import OwnedRecord, InsumoAlimentar

    owner = state.session.info.get("usuario_id")
    if owner is None or not state.is_select:
        return
    for mapper in Base.registry.mappers:
        model = mapper.class_
        if issubclass(model, OwnedRecord):
            if model is InsumoAlimentar:
                criterion = (model.usuario_id == owner) | model.usuario_id.is_(None)
            else:
                criterion = model.usuario_id == owner
            state.statement = state.statement.options(
                with_loader_criteria(model, criterion, include_aliases=True)
            )


@event.listens_for(Session, "before_flush")
def scope_owned_writes(session, context, instances):
    from fastapi import HTTPException
    from .models import OwnedRecord

    owner = session.info.get("usuario_id")
    if owner is None:
        return
    for record in session.new:
        if isinstance(record, OwnedRecord):
            if record.usuario_id not in (None, owner):
                raise HTTPException(403, "Operação não permitida.")
            record.usuario_id = owner
    for record in session.dirty | session.deleted:
        if isinstance(record, OwnedRecord) and record.usuario_id != owner:
            raise HTTPException(
                403, "Este registro não pode ser alterado por esta conta."
            )
