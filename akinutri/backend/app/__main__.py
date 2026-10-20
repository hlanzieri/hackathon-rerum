import os

import uvicorn
from dotenv import load_dotenv

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
load_dotenv(os.path.join(ROOT, ".env"), override=False)

host = os.getenv("AKINUTRI_HOST", "localhost")
if host not in {"localhost", "127.0.0.1", "::1"}:
    raise SystemExit("AkiNutri aceita somente host local (localhost/loopback).")

try:
    port = int(os.getenv("AKINUTRI_PORT", "8000"))
except ValueError as error:
    raise SystemExit("AKINUTRI_PORT deve ser um número entre 1 e 65535.") from error
if not 1 <= port <= 65535:
    raise SystemExit("AKINUTRI_PORT deve ser um número entre 1 e 65535.")

uvicorn.run("app.main:app", host=host, port=port)
