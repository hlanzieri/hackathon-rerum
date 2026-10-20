$ErrorActionPreference = 'Stop'
$akinutriRoot = $PSScriptRoot
$akinutriPython = Join-Path $akinutriRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $akinutriPython)) { throw 'Crie a .venv e instale backend/requirements.txt conforme README.md.' }
if (-not (Test-Path -LiteralPath (Join-Path $akinutriRoot 'frontend\dist\index.html'))) { throw 'Execute npm ci e npm run build dentro de frontend primeiro.' }
Push-Location (Join-Path $akinutriRoot 'backend')
try { & $akinutriPython -m app }
finally { Pop-Location }
