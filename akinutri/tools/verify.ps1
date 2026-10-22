$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $projectPython)) {
    throw 'Crie a .venv e instale backend/requirements-dev.txt conforme README.md.'
}
& $projectPython -u (Join-Path $PSScriptRoot 'verify.py')
if ($LASTEXITCODE -ne 0) { throw "Verificacao falhou (codigo $LASTEXITCODE). Consulte a etapa acima." }
