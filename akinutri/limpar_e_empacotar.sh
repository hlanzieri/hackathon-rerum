#!/usr/bin/env bash
# Limpa a cópia temporária e gera o ZIP; preserva ambiente e banco originais.
set -euo pipefail
akinutri_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
if [[ -x "$akinutri_root/.venv/bin/python" ]]; then
    akinutri_python="$akinutri_root/.venv/bin/python"
else
    akinutri_python="python3"
fi
"$akinutri_python" "$akinutri_root/tools/package_submission.py"
