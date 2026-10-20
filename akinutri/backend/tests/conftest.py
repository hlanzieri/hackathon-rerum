import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import main
from app.database import Base, get_db


@pytest.fixture
def client(tmp_path, monkeypatch):
    engine = create_engine(
        f'sqlite:///{(tmp_path / "test.db").as_posix()}',
        connect_args={"check_same_thread": False},
    )
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    monkeypatch.setattr(main, "engine", engine)
    monkeypatch.setattr(main, "SessionLocal", factory)

    def get_test_db():
        with factory() as db:
            yield db

    main.app.dependency_overrides[get_db] = get_test_db
    with TestClient(main.app) as value:
        yield value
    main.app.dependency_overrides.clear()
    engine.dispose()


SCENARIOS = [
    (
        "Holandesas alta producao",
        1,
        650,
        "lactacao",
        35,
        100,
        None,
        24,
        "lactacao_alta",
    ),
    (
        "Gir meio de lactacao",
        2,
        450,
        "lactacao",
        15,
        150,
        None,
        16,
        "lactacao_moderada",
    ),
    ("Secas distante do parto", 3, 550, "seca", 0, None, 45, 12, "seca_distante"),
]


def request_for(client, scenario=SCENARIOS[0]):
    name, breed, weight, state, milk, days, calving, intake, _ = scenario
    response = client.post(
        "/api/lotes",
        json={
            "nome": name,
            "raca_id": breed,
            "quantidade": 25,
            "peso_kg": weight,
            "idade_meses": 48,
            "ordem_paricao": 3,
            "estado": state,
            "destinacao": "leite",
            "producao_l_dia": milk,
            "dias_lactacao": days,
            "dias_ate_parto": calving,
        },
    )
    assert response.status_code == 201, response.text
    return {
        "lote_id": response.json()["id"],
        "consumo_ms_kg": intake,
        "sistema": "tmr",
        "particula_adequada": True,
        "milho_seco_predominante": True,
        "itens": [
            {
                "insumo_id": i["id"],
                "minimo_kg_ms": 0,
                "maximo_kg_ms": 0.5 if i["categoria"] == "mineral" else 40,
            }
            for i in client.get("/api/insumos").json()
        ],
    }
