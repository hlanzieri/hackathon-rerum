import json
from pathlib import Path
import pytest
from app.preview import build_preview


def test_preview_is_reproducible_and_reverified():
    data = build_preview()
    assert data == build_preview()
    assert len(data["scenarios"]) == 26
    assert all(row["status"] == "atende_perfil_demo" for row in data["scenarios"])
    assert (
        data["scenarios"][0]["totals"]["custo_animal_dia"]
        < data["scenarios"][-1]["totals"]["custo_animal_dia"]
    )
    assert len(data["knowledge_sha256"]) == 64
    assert data["assumptions"]["producao_l_dia"] == 35
    assert data["assumptions"]["corrected_milk_is_not_raw_liters"] is True


def test_published_preview_matches_python_engine():
    published = json.loads(
        (
            Path(__file__).resolve().parents[2]
            / "frontend/src/data/ration-preview.json"
        ).read_text(encoding="utf-8")
    )
    expected = build_preview()
    assert published["knowledge_sha256"] == expected["knowledge_sha256"]
    for actual, computed in zip(published["scenarios"], expected["scenarios"]):
        assert actual["totals"] == pytest.approx(computed["totals"])
