# Limpa a cópia temporária e gera o ZIP; preserva ambiente e banco originais.
$ErrorActionPreference = 'Stop'
$akinutriRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$akinutriPython = Join-Path $akinutriRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $akinutriPython)) {
    $akinutriPython = (Get-Command python -ErrorAction Stop).Source
}
& $akinutriPython (Join-Path $akinutriRoot 'tools\package_submission.py')
if ($LASTEXITCODE -ne 0) { throw 'Falha no empacotamento.' }
