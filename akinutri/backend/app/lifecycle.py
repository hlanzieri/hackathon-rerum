from datetime import date, timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from .database import get_db
from .models import (
    Animal,
    GrupoProducao,
    HistoricoDietaGP,
    HistoricoMovimentacaoAnimal,
    ResultadoDieta,
    SessaoInferencia,
)

router = APIRouter(tags=["grupos de producao e animais"])
FaseGP = Literal["bezerril", "recria", "lactacao", "seca"]
SexoAnimal = Literal["femea", "macho"]


class LifecycleDTO(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True, extra="forbid")


class GrupoProducaoCreate(LifecycleDTO):
    nome: str = Field(min_length=1, max_length=120)
    fase: FaseGP
    descricao: str | None = Field(default=None, max_length=500)

    @field_validator("nome")
    @classmethod
    def validate_name(cls, value):
        if not value.strip():
            raise ValueError("Informe o nome do grupo.")
        return value


class AnimalCreate(LifecycleDTO):
    brinco: str = Field(min_length=1, max_length=60)
    nome: str = Field(min_length=1, max_length=120)
    data_nascimento: date
    sexo: SexoAnimal
    grupo_producao_id: int = Field(gt=0)
    data_inicio_gp: date = Field(default_factory=date.today)

    @field_validator("brinco", "nome")
    @classmethod
    def validate_text(cls, value):
        if not value.strip():
            raise ValueError("Este campo não pode ficar vazio.")
        return value

    @model_validator(mode="after")
    def validate_dates(self):
        if self.data_nascimento > date.today():
            raise ValueError("A data de nascimento não pode estar no futuro.")
        if self.data_inicio_gp > date.today():
            raise ValueError("A entrada no grupo não pode estar no futuro.")
        if self.data_inicio_gp < self.data_nascimento:
            raise ValueError("A entrada no grupo não pode anteceder o nascimento.")
        return self


class AnimalUpdate(LifecycleDTO):
    brinco: str = Field(min_length=1, max_length=60)
    nome: str = Field(min_length=1, max_length=120)
    data_nascimento: date
    sexo: SexoAnimal

    @field_validator("brinco", "nome")
    @classmethod
    def validate_text(cls, value):
        if not value.strip():
            raise ValueError("Este campo não pode ficar vazio.")
        return value


class MovimentacaoCreate(LifecycleDTO):
    grupo_producao_id: int = Field(gt=0)
    data_inicio: date


class AtribuirDieta(LifecycleDTO):
    sessao_id: int = Field(gt=0)
    data_inicio: date

    @field_validator("data_inicio")
    @classmethod
    def validate_date(cls, value):
        if value > date.today():
            raise ValueError("A data de início da dieta não pode estar no futuro.")
        return value


def require(db: Session, model, identifier: int):
    record = db.get(model, identifier)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Registro não encontrado.")
    return record


def handle_integrity_error(db: Session, error: IntegrityError, detail: str):
    db.rollback()
    raise HTTPException(status.HTTP_409_CONFLICT, detail) from error


def group_payload(group: GrupoProducao):
    return {
        "id": group.id,
        "nome": group.nome,
        "fase": group.fase,
        "descricao": group.descricao,
        "ativo": group.ativo,
    }


def movement_for_animal(db: Session, animal_id: int):
    return db.scalar(
        select(HistoricoMovimentacaoAnimal)
        .where(
            HistoricoMovimentacaoAnimal.animal_id == animal_id,
            HistoricoMovimentacaoAnimal.data_fim.is_(None),
        )
        .order_by(HistoricoMovimentacaoAnimal.data_inicio.desc())
    )


def animal_payload(db: Session, animal: Animal):
    movement = movement_for_animal(db, animal.id)
    group = db.get(GrupoProducao, movement.grupo_producao_id) if movement else None
    return {
        "id": animal.id,
        "brinco": animal.brinco,
        "nome": animal.nome,
        "data_nascimento": animal.data_nascimento,
        "sexo": animal.sexo,
        "ativo": animal.ativo,
        "grupo_producao_id": group.id if group else None,
        "grupo_producao": group_payload(group) if group else None,
    }


def movement_group_payload(db: Session, movement: HistoricoMovimentacaoAnimal):
    group = require(db, GrupoProducao, movement.grupo_producao_id)
    payload = group_payload(group)
    if movement.grupo_nome_snapshot:
        payload["nome"] = movement.grupo_nome_snapshot
    if movement.fase_snapshot:
        payload["fase"] = movement.fase_snapshot
    return payload


@router.get("/api/grupos-producao")
def list_groups(
    include_inativos: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    statement = select(GrupoProducao).order_by(GrupoProducao.nome)
    if not include_inativos:
        statement = statement.where(GrupoProducao.ativo.is_(True))
    groups = db.scalars(statement).all()
    payloads = []
    for group in groups:
        diet = db.scalar(
            select(HistoricoDietaGP)
            .where(
                HistoricoDietaGP.grupo_producao_id == group.id,
                HistoricoDietaGP.data_fim.is_(None),
            )
            .order_by(HistoricoDietaGP.data_inicio.desc())
        )
        payloads.append(
            {
                **group_payload(group),
                "dieta_ativa": diet.sessao_id if diet else None,
                "dieta_data_inicio": diet.data_inicio if diet else None,
            }
        )
    return payloads


@router.post(
    "/api/grupos-producao", status_code=status.HTTP_201_CREATED
)
def create_group(data: GrupoProducaoCreate, db: Session = Depends(get_db)):
    group = GrupoProducao(
        nome=data.nome.strip(), fase=data.fase, descricao=data.descricao or None
    )
    db.add(group)
    try:
        db.commit()
    except IntegrityError as error:
        handle_integrity_error(db, error, "Já existe um grupo com esse nome.")
    db.refresh(group)
    return group_payload(group)


@router.get("/api/grupos-producao/{group_id}")
def get_group(group_id: int, db: Session = Depends(get_db)):
    return group_payload(require(db, GrupoProducao, group_id))


@router.put("/api/grupos-producao/{group_id}")
def update_group(
    group_id: int, data: GrupoProducaoCreate, db: Session = Depends(get_db)
):
    group = require(db, GrupoProducao, group_id)
    group.nome = data.nome.strip()
    group.fase = data.fase
    group.descricao = data.descricao or None
    try:
        db.commit()
    except IntegrityError as error:
        handle_integrity_error(db, error, "Já existe um grupo com esse nome.")
    db.refresh(group)
    return group_payload(group)


@router.delete("/api/grupos-producao/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_group(group_id: int, db: Session = Depends(get_db)):
    group = require(db, GrupoProducao, group_id)
    group.ativo = False
    db.commit()


@router.post(
    "/api/grupos-producao/{group_id}/atribuir-dieta",
    status_code=status.HTTP_201_CREATED,
)
def assign_group_diet(
    group_id: int, data: AtribuirDieta, db: Session = Depends(get_db)
):
    group = require(db, GrupoProducao, group_id)
    if not group.ativo:
        raise HTTPException(status.HTTP_409_CONFLICT, "O grupo está arquivado.")

    session = require(db, SessaoInferencia, data.sessao_id)
    if session.modo != "formular":
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A sessão selecionada não é uma formulação.",
        )
    result = db.scalar(
        select(ResultadoDieta).where(ResultadoDieta.sessao_id == session.id)
    )
    if (
        result is None
        or not result.conteudo.get("items")
        or result.conteudo.get("totals") is None
        or result.conteudo.get("status") != "atende_perfil_demo"
    ):
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "Somente formulações concluídas e verificadas podem ser ativadas.",
        )

    latest = db.scalar(
        select(HistoricoDietaGP)
        .where(HistoricoDietaGP.grupo_producao_id == group_id)
        .order_by(HistoricoDietaGP.data_inicio.desc())
        .limit(1)
    )
    if latest and data.data_inicio <= latest.data_inicio:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A nova dieta deve começar após o início da dieta mais recente.",
        )
    if db.scalar(
        select(HistoricoDietaGP).where(
            HistoricoDietaGP.grupo_producao_id == group_id,
            HistoricoDietaGP.sessao_id == session.id,
        )
    ):
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "Essa formulação já está registrada no histórico do grupo.",
        )

    if latest:
        latest.data_fim = data.data_inicio - timedelta(days=1)
    entry = HistoricoDietaGP(
        grupo_producao_id=group.id,
        sessao_id=session.id,
        data_inicio=data.data_inicio,
    )
    db.add(entry)
    try:
        db.commit()
    except IntegrityError as error:
        handle_integrity_error(
            db, error, "Não foi possível registrar a dieta ativa do grupo."
        )
    db.refresh(entry)
    return {
        "id": entry.id,
        "grupo_producao_id": entry.grupo_producao_id,
        "sessao_id": entry.sessao_id,
        "data_inicio": entry.data_inicio,
        "data_fim": entry.data_fim,
    }


@router.get("/api/animais")
def list_animals(
    include_inativos: bool = Query(default=False),
    db: Session = Depends(get_db),
):
    statement = select(Animal).order_by(Animal.nome, Animal.id)
    if not include_inativos:
        statement = statement.where(Animal.ativo.is_(True))
    return [animal_payload(db, animal) for animal in db.scalars(statement)]


@router.post("/api/animais", status_code=status.HTTP_201_CREATED)
def create_animal(data: AnimalCreate, db: Session = Depends(get_db)):
    group = require(db, GrupoProducao, data.grupo_producao_id)
    if not group.ativo:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Não é possível atribuir o animal a um grupo arquivado."
        )
    animal = Animal(
        brinco=data.brinco.strip(),
        nome=data.nome.strip(),
        data_nascimento=data.data_nascimento,
        sexo=data.sexo,
    )
    db.add(animal)
    try:
        db.flush()
        db.add(
            HistoricoMovimentacaoAnimal(
                animal_id=animal.id,
                grupo_producao_id=group.id,
                grupo_nome_snapshot=group.nome,
                fase_snapshot=group.fase,
                data_inicio=data.data_inicio_gp,
            )
        )
        db.commit()
    except IntegrityError as error:
        handle_integrity_error(db, error, "Já existe um animal com esse brinco.")
    db.refresh(animal)
    return animal_payload(db, animal)


@router.get("/api/animais/{animal_id}")
def get_animal(animal_id: int, db: Session = Depends(get_db)):
    return animal_payload(db, require(db, Animal, animal_id))


@router.put("/api/animais/{animal_id}")
def update_animal(
    animal_id: int, data: AnimalUpdate, db: Session = Depends(get_db)
):
    animal = require(db, Animal, animal_id)
    first_movement = db.scalar(
        select(HistoricoMovimentacaoAnimal)
        .where(HistoricoMovimentacaoAnimal.animal_id == animal_id)
        .order_by(HistoricoMovimentacaoAnimal.data_inicio)
        .limit(1)
    )
    if first_movement and data.data_nascimento > first_movement.data_inicio:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A data de nascimento não pode ser posterior à primeira entrada em um grupo.",
        )
    if data.data_nascimento > date.today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A data de nascimento não pode estar no futuro.",
        )
    animal.brinco = data.brinco.strip()
    animal.nome = data.nome.strip()
    animal.data_nascimento = data.data_nascimento
    animal.sexo = data.sexo
    try:
        db.commit()
    except IntegrityError as error:
        handle_integrity_error(db, error, "Já existe um animal com esse brinco.")
    db.refresh(animal)
    return animal_payload(db, animal)


@router.delete("/api/animais/{animal_id}", status_code=status.HTTP_204_NO_CONTENT)
def archive_animal(animal_id: int, db: Session = Depends(get_db)):
    animal = require(db, Animal, animal_id)
    animal.ativo = False
    db.commit()


@router.post(
    "/api/animais/{animal_id}/movimentacoes",
    status_code=status.HTTP_201_CREATED,
)
def move_animal(
    animal_id: int, data: MovimentacaoCreate, db: Session = Depends(get_db)
):
    animal = require(db, Animal, animal_id)
    if not animal.ativo:
        raise HTTPException(status.HTTP_409_CONFLICT, "O animal está arquivado.")
    group = require(db, GrupoProducao, data.grupo_producao_id)
    if not group.ativo:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "Não é possível movimentar para um grupo arquivado."
        )
    if data.data_inicio > date.today():
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A data da movimentação não pode estar no futuro.",
        )
    if data.data_inicio < animal.data_nascimento:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_ENTITY,
            "A movimentação não pode anteceder o nascimento.",
        )
    current = movement_for_animal(db, animal.id)
    if current is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "O animal não possui grupo atual para iniciar uma movimentação.",
        )
    if current.grupo_producao_id == group.id:
        raise HTTPException(
            status.HTTP_409_CONFLICT, "O animal já pertence a esse grupo."
        )
    if data.data_inicio <= current.data_inicio:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            "A movimentação deve começar após a entrada no grupo atual.",
        )

    current.data_fim = data.data_inicio - timedelta(days=1)
    movement = HistoricoMovimentacaoAnimal(
        animal_id=animal.id,
        grupo_producao_id=group.id,
        grupo_nome_snapshot=group.nome,
        fase_snapshot=group.fase,
        data_inicio=data.data_inicio,
    )
    db.add(movement)
    db.commit()
    db.refresh(movement)
    return {
        "id": movement.id,
        "animal_id": movement.animal_id,
        "grupo_producao_id": movement.grupo_producao_id,
        "data_inicio": movement.data_inicio,
        "data_fim": movement.data_fim,
    }


def diet_payload(db: Session, history: HistoricoDietaGP):
    session = db.get(SessaoInferencia, history.sessao_id)
    result = db.scalar(
        select(ResultadoDieta).where(ResultadoDieta.sessao_id == history.sessao_id)
    )
    snapshot_ingredients = {
        ingredient["id"]: ingredient
        for ingredient in session.snapshot.get("insumos", [])
    }
    result_content = result.conteudo
    ingredients = []
    for item in result_content.get("items", []):
        snapshot = snapshot_ingredients.get(item["insumo_id"], {})
        ingredients.append(
            {
                "insumo_id": item["insumo_id"],
                "nome": item["nome"],
                "quantidade_kg_mn": item["quantidade_kg_mn"],
                "quantidade_kg_ms": item["quantidade_kg_ms"],
                "preco_kg_mn": snapshot.get("preco_kg_mn"),
                "custo_diario": item["custo"],
            }
        )
    return {
        "sessao_id": history.sessao_id,
        "data_inicio": history.data_inicio,
        "data_fim": history.data_fim,
        "status": result_content["status"],
        "custo_diario": result_content["totals"]["custo_animal_dia"],
        "ingredientes": ingredients,
    }


@router.get("/api/animais/{animal_id}/historico-nutricional")
def animal_nutrition_history(animal_id: int, db: Session = Depends(get_db)):
    animal = require(db, Animal, animal_id)
    movements = db.scalars(
        select(HistoricoMovimentacaoAnimal)
        .where(HistoricoMovimentacaoAnimal.animal_id == animal_id)
        .order_by(HistoricoMovimentacaoAnimal.data_inicio, HistoricoMovimentacaoAnimal.id)
    ).all()
    today = date.today()
    timeline = []
    accumulated_cost = 0.0
    for movement in movements:
        movement_end = min(movement.data_fim or today, today)
        if movement.data_inicio > movement_end:
            continue
        group = require(db, GrupoProducao, movement.grupo_producao_id)
        diets = db.scalars(
            select(HistoricoDietaGP)
            .where(
                HistoricoDietaGP.grupo_producao_id == group.id,
                HistoricoDietaGP.data_inicio <= movement_end,
            )
            .order_by(HistoricoDietaGP.data_inicio, HistoricoDietaGP.id)
        ).all()
        cursor = movement.data_inicio

        def append_period(start: date, end: date, history: HistoricoDietaGP | None):
            nonlocal accumulated_cost
            days = (end - start).days + 1
            diet = diet_payload(db, history) if history else None
            daily_cost = diet["custo_diario"] if diet else 0.0
            period_cost = round(daily_cost * days, 2)
            accumulated_cost = round(accumulated_cost + period_cost, 2)
            timeline.append(
                {
                    "data_inicio": start,
                    "data_fim": end,
                    "dias": days,
                    "grupo_producao": movement_group_payload(db, movement),
                    "dieta": diet,
                    "custo_diario": daily_cost,
                    "custo_periodo": period_cost,
                    "custo_acumulado": accumulated_cost,
                }
            )

        for diet in diets:
            diet_end = min(diet.data_fim or today, movement_end)
            if diet_end < cursor or diet.data_inicio > movement_end:
                continue
            diet_start = max(diet.data_inicio, movement.data_inicio)
            if diet_start > cursor:
                append_period(cursor, min(diet_start - timedelta(days=1), movement_end), None)
            period_start = max(cursor, diet_start)
            if period_start <= diet_end:
                append_period(period_start, diet_end, diet)
                cursor = diet_end + timedelta(days=1)
            if cursor > movement_end:
                break
        if cursor <= movement_end:
            append_period(cursor, movement_end, None)

    return {
        "animal": animal_payload(db, animal),
        "movimentacoes": [
            {
                "grupo_producao": movement_group_payload(db, movement),
                "data_inicio": movement.data_inicio,
                "data_fim": movement.data_fim,
            }
            for movement in movements
        ],
        "linha_tempo": timeline,
        "custo_diario_acumulado": accumulated_cost,
    }
