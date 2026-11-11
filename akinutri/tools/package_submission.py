"""Clean a staging copy and produce a source-only submission ZIP."""

from pathlib import Path
import os
import shutil
import tempfile
import zipfile

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "AkiNutri_Entregavel_Final_RERUM2026.zip"
EXCLUDED_DIRS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "dist",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    "backups",
    "vendor",
    "coverage",
    ".test-runs",
}


def excluded(path):
    name = path.name
    return (
        name in EXCLUDED_DIRS
        or name.startswith((".test-tmp", ".env"))
        and not name.endswith(".example")
        or name == "seed-access.local.txt"
        or name == OUTPUT.name
        or name.endswith(
            (
                ".pyc",
                ".pyo",
                ".db",
                ".db-wal",
                ".db-shm",
                ".sqlite",
                ".sqlite3",
                ".log",
                ".zip",
            )
        )
    )


def main():
    # Only this freshly created staging directory is recursively removed by TemporaryDirectory.
    with tempfile.TemporaryDirectory(prefix="akinutri-package-") as staging:
        stage = Path(staging) / "AkiNutri"
        stage.mkdir()
        for current, directories, files in os.walk(ROOT, followlinks=False):
            base = Path(current)
            directories[:] = sorted(
                d
                for d in directories
                if not excluded(base / d) and not (base / d).is_symlink()
            )
            for name in sorted(files):
                source = base / name
                if excluded(source) or source.is_symlink():
                    continue
                target = stage / source.relative_to(ROOT)
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(source, target)
        required = [
            "README.md",
            "DATABASE.md",
            "API_DOCS.md",
            "FUNCIONALIDADES.md",
            "backend/requirements.txt",
            "frontend/package-lock.json",
            ".env.example",
            "frontend/.env.example",
        ]
        for name in required:
            if not (stage / name).is_file():
                raise RuntimeError(f"Arquivo obrigatório ausente: {name}")
        archive = Path(staging) / OUTPUT.name
        with zipfile.ZipFile(archive, "w", zipfile.ZIP_DEFLATED) as zipped:
            for source in sorted(stage.rglob("*")):
                if source.is_file():
                    zipped.write(
                        source, "AkiNutri/" + source.relative_to(stage).as_posix()
                    )
        with zipfile.ZipFile(archive) as zipped:
            if zipped.testzip() is not None:
                raise RuntimeError("Falha na integridade do ZIP")
            count = len(zipped.namelist())
        os.replace(archive, OUTPUT)
        print(
            f"Pacote: {OUTPUT}\nArquivos: {count}; bytes: {OUTPUT.stat().st_size}\nLimpeza aplicada somente à cópia temporária; origem preservada."
        )


if __name__ == "__main__":
    main()
