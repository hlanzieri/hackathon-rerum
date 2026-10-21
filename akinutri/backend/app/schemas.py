from typing import Literal, TypeAlias
from pydantic import AliasChoices, BaseModel, ConfigDict, Field, model_validator

InferenceStatus: TypeAlias = Literal[
    "fora_escopo",
    "otimo",
    "diagnostico_relaxado",
    "inviavel",
    "falha_solver",
    "dados_insuficientes",
    "restricoes_violadas",
    "falha_pos_verificacao",
    "atende_perfil_demo",
]


class DTO(BaseModel):
    model_config = ConfigDict(
        from_attributes=True,
        allow_inf_nan=False,
        extra="forbid",
        str_strip_whitespace=True,
    )


class ComposicaoPendente(DTO):
    insumo_id: int
    nome: str
    nutrientes_faltantes: list[str]


class InferenceResponse(BaseModel):
    """Public result contract; additional explainability fields remain extensible."""

    model_config = ConfigDict(extra="allow", allow_inf_nan=False)
    status: InferenceStatus
    mensagem: str | None = None
    insumos_incompletos: list[ComposicaoPendente] = Field(default_factory=list)


class LoteCreate(DTO):
    nome: str = Field(min_length=1, max_length=120)
    raca_id: int = Field(gt=0)
    quantidade: int = Field(ge=1, le=100000)
    peso_kg: float = Field(ge=200, le=1000)
    idade_meses: int = Field(ge=18, le=240)
    ordem_paricao: int = Field(ge=1, le=15)
    estado: Literal["lactacao", "seca"]
    destinacao: Literal["leite", "reproducao", "dupla_aptidao"] = "leite"
    producao_l_dia: float = Field(ge=0, le=80)
    dias_lactacao: int | None = Field(default=None, ge=1, le=700)
    dias_ate_parto: int | None = Field(default=None, ge=1, le=100)

    @model_validator(mode="after")
    def consistent(self):
        if self.estado == "seca" and (
            self.producao_l_dia != 0
            or self.dias_ate_parto is None
            or self.dias_lactacao is not None
        ):
            raise ValueError(
                "Lote seco exige producao zero, dias ate parto e ausencia de dias em lactacao."
            )
        if self.estado == "lactacao" and (
            self.producao_l_dia <= 0
            or self.dias_lactacao is None
            or self.dias_ate_parto is not None
        ):
            raise ValueError(
                "Lactacao exige producao positiva, dias em lactacao e ausencia de dias ate parto."
            )
        return self


class LoteRead(LoteCreate):
    id: int


class InsumoCreate(DTO):
    nome: str = Field(min_length=1, max_length=120)
    categoria: Literal["volumoso", "concentrado", "mineral"]
    ms_pct: float = Field(gt=0, le=100)
    pb_pct: float | None = Field(default=None, ge=0, le=100)
    fdn_pct: float | None = Field(default=None, ge=0, le=100)
    amido_pct: float | None = Field(default=None, ge=0, le=100)
    el_mcal_kg: float | None = Field(default=None, ge=0, le=5)
    ca_pct: float | None = Field(default=None, ge=0, le=100)
    p_pct: float | None = Field(default=None, ge=0, le=100)
    preco_kg_mn: float = Field(ge=0, le=10000)
    fonte: str = Field(min_length=1, max_length=500)


class InsumoRead(InsumoCreate):
    id: int


class ItemEntrada(DTO):
    insumo_id: int = Field(gt=0)
    quantidade_kg_mn: float = Field(default=0, ge=0, le=200)
    minimo_kg_ms: float = Field(default=0, ge=0, le=40)
    maximo_kg_ms: float = Field(default=40, ge=0, le=40)
    preco_kg_mn: float | None = Field(default=None, ge=0, le=10000)

    @model_validator(mode="after")
    def bounds(self):
        if self.minimo_kg_ms > self.maximo_kg_ms:
            raise ValueError("Minimo de inclusao maior que maximo.")
        return self


class FactEvidence(DTO):
    cf: float = Field(ge=-1, le=1)
    source: Literal["usuario", "laboratorio", "tabela"]


class InferenciaRequest(DTO):
    dcad_meq_100g: float | None = Field(default=None, ge=-100, le=100)
    evidence: dict[str, FactEvidence] = Field(default_factory=dict)
    lote_id: int = Field(gt=0)
    grupo_id: int | None = Field(default=None, gt=0)
    consumo_ms_kg: float = Field(ge=3, le=40)
    sistema: Literal["tmr", "outro"] = "tmr"
    particula_adequada: bool | None = None
    milho_seco_predominante: bool | None = None
    estimativa_cms: "CmsRequest | None" = None
    itens: list[ItemEntrada] = Field(min_length=1, max_length=50)
    insumos_excluidos_explicitamente: list[int] = Field(
        default_factory=list,
        max_length=50,
        validation_alias=AliasChoices(
            "insumos_excluidos_explicitamente", "excluir_insumos_incompletos"
        ),
    )

    @model_validator(mode="after")
    def unique_items(self):
        if len({i.insumo_id for i in self.itens}) != len(self.itens):
            raise ValueError("Insumos duplicados.")
        if len(set(self.insumos_excluidos_explicitamente)) != len(
            self.insumos_excluidos_explicitamente
        ):
            raise ValueError("Insumos para exclusao duplicados.")
        if not set(self.insumos_excluidos_explicitamente).issubset(
            {i.insumo_id for i in self.itens}
        ):
            raise ValueError("Exclusao deve referenciar insumos selecionados.")
        return self


class FormulacaoRequest(InferenciaRequest):
    grupo_id: int = Field(gt=0)


class CmsRequest(DTO):
    peso_kg: float = Field(ge=200, le=1000)
    dias_lactacao: int = Field(ge=1, le=700)
    escore_corporal: float = Field(ge=1, le=5)
    fracao_multiparas: float = Field(ge=0, le=1)
    energia_leite_mcal_dia: float | None = Field(default=None, gt=0, le=100)
    leite_corrigido_kg_dia: float | None = Field(default=None, gt=0, le=100)
    energia_referencia_mcal_kg: float = Field(default=0.7, gt=0, le=2)
    raca: str = Field(min_length=1, max_length=80)
    estado: Literal["lactacao", "seca"]

    @model_validator(mode="after")
    def milk_energy_source(self):
        if (self.energia_leite_mcal_dia is None) == (
            self.leite_corrigido_kg_dia is None
        ):
            raise ValueError(
                "Informe energia do leite OU leite corrigido, nunca ambos."
            )
        return self


class ComparisonRequest(DTO):
    manual_session_id: int = Field(gt=0)
    formulated_session_id: int = Field(gt=0)
    dias: int = Field(default=30, ge=1, le=366)


class MixingRequest(DTO):
    batidas_dia: int = Field(default=1, ge=1, le=24)
    capacidade_kg: float | None = Field(default=None, gt=0, le=1000000)
    ordem_insumos: list[int] | None = None


InferenciaRequest.model_rebuild()
