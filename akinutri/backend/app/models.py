from datetime import date, datetime, timezone
from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    ForeignKey,
    Index,
    String,
    JSON,
    Float,
    Integer,
    DateTime,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship, synonym
from .database import Base


class OwnedRecord:
    # NULL owners are retained only for legacy records; scoped requests cannot see them.
    usuario_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )


class Raca(Base):
    __tablename__ = "racas"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True)


class Lote(OwnedRecord, Base):
    __tablename__ = "lotes"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120))
    raca_id: Mapped[int] = mapped_column(ForeignKey("racas.id"))
    quantidade: Mapped[int] = mapped_column(Integer)
    peso_kg: Mapped[float] = mapped_column(Float)
    idade_meses: Mapped[int] = mapped_column(Integer)
    ordem_paricao: Mapped[int] = mapped_column(Integer)
    estado: Mapped[str] = mapped_column(String(30))
    destinacao: Mapped[str] = mapped_column(String(30))
    destinacao_economica: Mapped[str] = mapped_column(
        String(30), default="leite_fluido", server_default="leite_fluido"
    )
    mantenca_pb_kg_dia: Mapped[float | None] = mapped_column(Float, nullable=True)
    mantenca_el_mcal_dia: Mapped[float | None] = mapped_column(Float, nullable=True)
    fonte_mantenca: Mapped[str | None] = mapped_column(String(500), nullable=True)
    producao_l_dia: Mapped[float] = mapped_column(Float)
    dias_lactacao: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dias_ate_parto: Mapped[int | None] = mapped_column(Integer, nullable=True)
    tmr_habilitado: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="1"
    )
    raca_registro: Mapped["Raca"] = relationship()
    peso_medio_kg = synonym("peso_kg")
    estado_produtivo = synonym("estado")
    producao_litros_dia = synonym("producao_l_dia")
    dias_em_lactacao = synonym("dias_lactacao")

    @property
    def raca(self):
        return self.raca_registro.nome


class GrupoProducao(OwnedRecord, Base):
    __tablename__ = "grupos_producao"
    __table_args__ = (
        UniqueConstraint("usuario_id", "nome", name="uq_grupo_usuario_nome"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), index=True)
    fase: Mapped[str] = mapped_column(String(30), index=True)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    numero_animais: Mapped[int | None] = mapped_column(Integer, nullable=True)
    del_medio: Mapped[float | None] = mapped_column(Float, nullable=True)
    peso_medio_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    producao_media_l_dia: Mapped[float | None] = mapped_column(Float, nullable=True)
    ecc_medio: Mapped[float | None] = mapped_column(Float, nullable=True)
    fracao_multiparas: Mapped[float | None] = mapped_column(Float, nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Animal(OwnedRecord, Base):
    __tablename__ = "animais"
    __table_args__ = (
        UniqueConstraint("usuario_id", "brinco", name="uq_animal_usuario_brinco"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    brinco: Mapped[str] = mapped_column(String(60), index=True)
    nome: Mapped[str] = mapped_column(String(120))
    data_nascimento: Mapped[date] = mapped_column(Date)
    sexo: Mapped[str] = mapped_column(String(20))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class HistoricoDietaGP(OwnedRecord, Base):
    __tablename__ = "historico_dietas_gp"
    __table_args__ = (
        UniqueConstraint(
            "grupo_producao_id", "data_inicio", name="uq_dieta_gp_data_inicio"
        ),
        UniqueConstraint("grupo_producao_id", "sessao_id", name="uq_dieta_gp_sessao"),
        CheckConstraint(
            "data_fim IS NULL OR data_fim >= data_inicio",
            name="ck_dieta_gp_periodo",
        ),
        Index("ix_dieta_gp_periodo", "grupo_producao_id", "data_inicio", "data_fim"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_producao_id: Mapped[int] = mapped_column(ForeignKey("grupos_producao.id"))
    sessao_id: Mapped[int] = mapped_column(ForeignKey("sessoes_inferencia.id"))
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class HistoricoMovimentacaoAnimal(OwnedRecord, Base):
    __tablename__ = "historico_movimentacoes_animais"
    __table_args__ = (
        CheckConstraint(
            "data_fim IS NULL OR data_fim >= data_inicio",
            name="ck_movimentacao_animal_periodo",
        ),
        Index("ix_movimentacao_animal_periodo", "animal_id", "data_inicio", "data_fim"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(ForeignKey("animais.id"))
    grupo_producao_id: Mapped[int] = mapped_column(ForeignKey("grupos_producao.id"))
    grupo_nome_snapshot: Mapped[str | None] = mapped_column(String(120), nullable=True)
    fase_snapshot: Mapped[str | None] = mapped_column(String(30), nullable=True)
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class InsumoAlimentar(OwnedRecord, Base):
    __tablename__ = "insumos"
    __table_args__ = (
        UniqueConstraint("usuario_id", "nome", name="uq_insumo_usuario_nome"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), index=True)
    categoria: Mapped[str] = mapped_column(String(30))
    ms_pct: Mapped[float] = mapped_column(Float)
    pb_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    fdn_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    amido_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    el_mcal_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    ca_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    p_pct: Mapped[float | None] = mapped_column(Float, nullable=True)
    preco_kg_mn: Mapped[float] = mapped_column(Float)
    fonte: Mapped[str] = mapped_column(String(500))
    calcio_pct = synonym("ca_pct")
    fosforo_pct = synonym("p_pct")


class UserAccount(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    cargo: Mapped[str] = mapped_column(
        String(30), default="produtor", server_default="produtor"
    )
    fazenda_nome: Mapped[str] = mapped_column(
        String(180), default="", server_default=""
    )
    session_version: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    conta_demo: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    nome = synonym("name")
    senha_hash = synonym("password_hash")
    criado_em = synonym("criada_em")


class BaseConhecimento(Base):
    __tablename__ = "bases_conhecimento"
    id: Mapped[int] = mapped_column(primary_key=True)
    versao: Mapped[str] = mapped_column(String(30), unique=True)
    sha256: Mapped[str] = mapped_column(String(64))
    conteudo: Mapped[dict] = mapped_column(JSON)


class RegraNutricional(Base):
    __tablename__ = "regras_nutricionais"
    id: Mapped[int] = mapped_column(primary_key=True)
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_conhecimento.id"))
    codigo: Mapped[str] = mapped_column(String(100))
    conteudo: Mapped[dict] = mapped_column(JSON)


class SessaoInferencia(OwnedRecord, Base):
    __tablename__ = "sessoes_inferencia"
    id: Mapped[int] = mapped_column(primary_key=True)
    lote_id: Mapped[int] = mapped_column(ForeignKey("lotes.id"))
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_conhecimento.id"))
    modo: Mapped[str] = mapped_column(String(20))
    snapshot: Mapped[dict] = mapped_column(JSON)
    base_versao: Mapped[str | None] = mapped_column(String(50), nullable=True)
    base_hash_sha256: Mapped[str | None] = mapped_column(String(64), nullable=True)
    cf_global: Mapped[float | None] = mapped_column(Float, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
    dados_snapshot_json = synonym("snapshot")
    criado_em = synonym("criada_em")


class ResultadoDieta(OwnedRecord, Base):
    __tablename__ = "resultados_dieta"
    id: Mapped[int] = mapped_column(primary_key=True)
    sessao_id: Mapped[int] = mapped_column(
        ForeignKey("sessoes_inferencia.id"), unique=True
    )
    conteudo: Mapped[dict] = mapped_column(JSON)


class ExplicacaoTraco(OwnedRecord, Base):
    __tablename__ = "explicacoes_traco"
    id: Mapped[int] = mapped_column(primary_key=True)
    sessao_id: Mapped[int] = mapped_column(ForeignKey("sessoes_inferencia.id"))
    regra_id: Mapped[int | None] = mapped_column(
        ForeignKey("regras_nutricionais.id"), nullable=True
    )
    sequencia: Mapped[int] = mapped_column(Integer)
    conteudo: Mapped[dict] = mapped_column(JSON)


# Public domain names share the existing tables and tenant predicates.
Usuario = UserAccount
Insumo = InsumoAlimentar
