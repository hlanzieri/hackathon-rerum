from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, JSON, Float, Integer, DateTime
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
