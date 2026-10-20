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
from sqlalchemy.orm import Mapped, mapped_column
from .database import Base


class Raca(Base):
    __tablename__ = "racas"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(80), unique=True)


class Lote(Base):
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
    producao_l_dia: Mapped[float] = mapped_column(Float)
    dias_lactacao: Mapped[int | None] = mapped_column(Integer, nullable=True)
    dias_ate_parto: Mapped[int | None] = mapped_column(Integer, nullable=True)


class GrupoProducao(Base):
    __tablename__ = "grupos_producao"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    fase: Mapped[str] = mapped_column(String(30), index=True)
    descricao: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class Animal(Base):
    __tablename__ = "animais"
    id: Mapped[int] = mapped_column(primary_key=True)
    brinco: Mapped[str] = mapped_column(String(60), unique=True, index=True)
    nome: Mapped[str] = mapped_column(String(120))
    data_nascimento: Mapped[date] = mapped_column(Date)
    sexo: Mapped[str] = mapped_column(String(20))
    ativo: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    criado_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class HistoricoDietaGP(Base):
    __tablename__ = "historico_dietas_gp"
    __table_args__ = (
        UniqueConstraint(
            "grupo_producao_id", "data_inicio", name="uq_dieta_gp_data_inicio"
        ),
        UniqueConstraint(
            "grupo_producao_id", "sessao_id", name="uq_dieta_gp_sessao"
        ),
        CheckConstraint(
            "data_fim IS NULL OR data_fim >= data_inicio",
            name="ck_dieta_gp_periodo",
        ),
        Index("ix_dieta_gp_periodo", "grupo_producao_id", "data_inicio", "data_fim"),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    grupo_producao_id: Mapped[int] = mapped_column(
        ForeignKey("grupos_producao.id")
    )
    sessao_id: Mapped[int] = mapped_column(ForeignKey("sessoes_inferencia.id"))
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class HistoricoMovimentacaoAnimal(Base):
    __tablename__ = "historico_movimentacoes_animais"
    __table_args__ = (
        CheckConstraint(
            "data_fim IS NULL OR data_fim >= data_inicio",
            name="ck_movimentacao_animal_periodo",
        ),
        Index(
            "ix_movimentacao_animal_periodo", "animal_id", "data_inicio", "data_fim"
        ),
    )
    id: Mapped[int] = mapped_column(primary_key=True)
    animal_id: Mapped[int] = mapped_column(ForeignKey("animais.id"))
    grupo_producao_id: Mapped[int] = mapped_column(
        ForeignKey("grupos_producao.id")
    )
    grupo_nome_snapshot: Mapped[str | None] = mapped_column(String(120), nullable=True)
    fase_snapshot: Mapped[str | None] = mapped_column(String(30), nullable=True)
    data_inicio: Mapped[date] = mapped_column(Date)
    data_fim: Mapped[date | None] = mapped_column(Date, nullable=True)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class InsumoAlimentar(Base):
    __tablename__ = "insumos"
    id: Mapped[int] = mapped_column(primary_key=True)
    nome: Mapped[str] = mapped_column(String(120), unique=True)
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


class UserAccount(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(120))
    password_hash: Mapped[str] = mapped_column(String(255))
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


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


class SessaoInferencia(Base):
    __tablename__ = "sessoes_inferencia"
    id: Mapped[int] = mapped_column(primary_key=True)
    lote_id: Mapped[int] = mapped_column(ForeignKey("lotes.id"))
    base_id: Mapped[int] = mapped_column(ForeignKey("bases_conhecimento.id"))
    modo: Mapped[str] = mapped_column(String(20))
    snapshot: Mapped[dict] = mapped_column(JSON)
    criada_em: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )


class ResultadoDieta(Base):
    __tablename__ = "resultados_dieta"
    id: Mapped[int] = mapped_column(primary_key=True)
    sessao_id: Mapped[int] = mapped_column(
        ForeignKey("sessoes_inferencia.id"), unique=True
    )
    conteudo: Mapped[dict] = mapped_column(JSON)


class ExplicacaoTraco(Base):
    __tablename__ = "explicacoes_traco"
    id: Mapped[int] = mapped_column(primary_key=True)
    sessao_id: Mapped[int] = mapped_column(ForeignKey("sessoes_inferencia.id"))
    regra_id: Mapped[int | None] = mapped_column(
        ForeignKey("regras_nutricionais.id"), nullable=True
    )
    sequencia: Mapped[int] = mapped_column(Integer)
    conteudo: Mapped[dict] = mapped_column(JSON)
