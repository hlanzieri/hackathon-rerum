$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$projectPython = Join-Path $projectRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $projectPython)) {
    throw 'Crie a .venv e instale backend/requirements-dev.txt conforme README.md.'
}
$testRoot = Join-Path $projectRoot '.test-runs'
$testRun = Join-Path $testRoot ('verify-' + [guid]::NewGuid().ToString('N'))
if (-not ([IO.Path]::GetFullPath($testRun).StartsWith([IO.Path]::GetFullPath($testRoot) + [IO.Path]::DirectorySeparatorChar))) {
    throw 'O diretório temporário de testes precisa permanecer dentro de .test-runs.'
}
Push-Location (Join-Path $projectRoot 'backend')
try {
    & $projectPython -m black --check --workers 1 app tests
    if ($LASTEXITCODE -ne 0) { throw 'A formatação Python precisa ser corrigida.' }
    & $projectPython -m pytest -q "--basetemp=$testRun"
    if ($LASTEXITCODE -ne 0) { throw 'Os testes do backend falharam.' }
} finally { Pop-Location }
Push-Location (Join-Path $projectRoot 'frontend')
try {
    & npm.cmd run format:check
    if ($LASTEXITCODE -ne 0) { throw 'A formatação do frontend precisa ser corrigida.' }
    & npm.cmd test
    if ($LASTEXITCODE -ne 0) { throw 'Os testes do frontend falharam.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'O build de produção falhou.' }
} finally { Pop-Location }
Write-Host 'AkiNutri: formatação, testes e build aprovados.' -ForegroundColor Green
