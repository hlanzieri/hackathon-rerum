import pytest
import faulthandler
import os
import sys
import threading
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app import main
from app.database import Base, get_db


def pytest_addoption(parser):
    parser.addoption(
        "--test-timeout",
        type=float,
        default=30,
        help="Limite em segundos por teste, incluindo setup/teardown; encerra o processo em caso de travamento.",
    )


@pytest.hookimpl(hookwrapper=True)
def pytest_runtest_protocol(item, nextitem):
    seconds = item.config.getoption("--test-timeout")
    if seconds <= 0:
        raise pytest.UsageError("--test-timeout deve ser positivo.")

    def abort():
        capture = item.config.pluginmanager.getplugin("capturemanager")
        if capture:
            capture.suspend_global_capture(in_=True)
        sys.stderr.write(
            f"\nTIMEOUT: {item.nodeid} excedeu {seconds}s (setup/teste/teardown).\n"
        )
        faulthandler.dump_traceback(file=sys.stderr, all_threads=True)
        sys.stderr.flush()
        os._exit(124)

    watchdog = threading.Timer(seconds, abort)
    watchdog.daemon = True
    watchdog.start()
    try:
        yield
    finally:
        watchdog.cancel()
        watchdog.join(timeout=1)


@pytest.fixture
def client(tmp_path, monkeypatch, request):
    monkeypatch.setenv("AKINUTRI_JWT_SECRET", "test-only-secret-key-at-least-32-bytes")
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

    previous_overrides = main.app.dependency_overrides.copy()
    main.app.dependency_overrides[get_db] = get_test_db
    try:
        with TestClient(main.app) as value:
            if request.module.__name__.split(".")[-1] not in {
                "test_auth",
                "test_security",
            }:
                response = value.post(
                    "/api/auth/register",
                    json={
                        "nome": "Operador de testes",
                        "email": "operator@example.com",
                        "senha": "senha-segura-123",
                    },
                )
                assert response.status_code == 201
            yield value
    finally:
        main.app.dependency_overrides.clear()
        main.app.dependency_overrides.update(previous_overrides)
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
    group_response = client.post(
        "/api/grupos-producao",
        json={
            "nome": f"GP {response.json()['id']} — {name}",
            "fase": state,
            "numero_animais": 25,
            "del_medio": days or 0,
            "peso_medio_kg": weight,
            "producao_media_l_dia": milk,
            "ecc_medio": 3,
            "fracao_multiparas": 1,
        },
    )
    assert group_response.status_code == 201, group_response.text
    return {
        "lote_id": response.json()["id"],
        "grupo_id": group_response.json()["id"],
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
