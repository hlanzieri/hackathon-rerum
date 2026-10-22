"""Bounded, logged checks; no interaction with the operational SQLite database."""

import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
import uuid

ROOT = Path(__file__).resolve().parents[1]


def run_stage(name, command, cwd, seconds):
    print(f"\n[{name}] limite={seconds}s", flush=True)
    started = time.monotonic()
    process = subprocess.Popen(command, cwd=cwd)
    try:
        code = process.wait(timeout=seconds)
    except subprocess.TimeoutExpired:
        print(f"TIMEOUT em {name}; encerrando processos filhos.", flush=True)
        if os.name == "nt":
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                check=False,
                timeout=10,
            )
        process.kill()
        process.wait(timeout=10)
        return 124
    print(f"[{name}] codigo={code}; {time.monotonic() - started:.1f}s", flush=True)
    return code


def main():
    python = ROOT / (
        ".venv/Scripts/python.exe" if os.name == "nt" else ".venv/bin/python"
    )
    node = shutil.which("node")
    if not python.exists() or not node:
        print("Requer .venv e Node.js no PATH.", flush=True)
        return 1
    frontend = ROOT / "frontend"
    stages = [
        ("Black", [str(python), str(ROOT / "tools/check_python_format.py")], ROOT, 60),
        (
            "pytest",
            [
                str(python),
                "-m",
                "pytest",
                "-q",
                "-ra",
                "--test-timeout=30",
                f"--basetemp={ROOT / '.test-runs' / ('verify-' + uuid.uuid4().hex)}",
            ],
            ROOT / "backend",
            180,
        ),
        (
            "Prettier",
            [node, "node_modules/prettier/bin/prettier.cjs", "--check", "src"],
            frontend,
            60,
        ),
        (
            "Vitest",
            [
                node,
                "node_modules/vitest/vitest.mjs",
                "run",
                "--maxWorkers=1",
                "--testTimeout=10000",
                "--hookTimeout=10000",
            ],
            frontend,
            120,
        ),
        ("Assets locais", [node, "scripts/prepare-docs.mjs"], frontend, 30),
        ("Vite", [node, "node_modules/vite/bin/vite.js", "build"], frontend, 120),
    ]
    for name, command, cwd, seconds in stages:
        code = run_stage(name, command, cwd, seconds)
        if code:
            return code
    print("AkiNutri: formatacao, testes e build aprovados.", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
