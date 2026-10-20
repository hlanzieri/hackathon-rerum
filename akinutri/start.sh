#!/usr/bin/env bash
set -euo pipefail

akinutri_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
akinutri_python="$akinutri_root/.venv/bin/python"

if [[ ! -x "$akinutri_python" ]]; then
  printf 'Crie a .venv e instale backend/requirements.txt conforme README.md.\n' >&2
  exit 1
fi
if [[ ! -f "$akinutri_root/frontend/dist/index.html" ]]; then
  printf 'Execute npm ci e npm run build dentro de frontend primeiro.\n' >&2
  exit 1
fi

cd "$akinutri_root/backend"
exec "$akinutri_python" -m app
