"""Sequential Black API: avoids Windows asyncio/socketpair for local formatting."""

from pathlib import Path
import sys
import black

root = Path(__file__).resolve().parents[1]
changed = []
paths = (
    sorted((root / "backend/app").glob("*.py"))
    + sorted((root / "backend/tests").glob("*.py"))
    + sorted((root / "tools").glob("*.py"))
)
for path in paths:
    source = path.read_text(encoding="utf-8")
    try:
        formatted = black.format_file_contents(source, fast=False, mode=black.Mode())
    except black.NothingChanged:
        continue
    changed.append(str(path.relative_to(root)))
    if "--write" in sys.argv:
        path.write_text(formatted, encoding="utf-8")
print(
    f"Black sequencial: {len(paths)} arquivos; {len(changed)} alteracoes.", flush=True
)
for name in changed:
    print(name, flush=True)
sys.exit(1 if changed and "--write" not in sys.argv else 0)
