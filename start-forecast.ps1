$ErrorActionPreference = 'Stop'
$forecastRoot = Join-Path $PSScriptRoot 'ai-server'
$forecastPython = Join-Path $PSScriptRoot '.tooling\forecast-venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $forecastPython)) {
    $forecastPython = (Get-Command python -ErrorAction Stop).Source
}
Push-Location -LiteralPath $forecastRoot
try {
    & $forecastPython -c "import fastapi, uvicorn, pandas, prophet, statsmodels"
    if ($LASTEXITCODE -ne 0) {
        throw 'Install the forecasting dependencies in this Python environment: pip install fastapi uvicorn pandas prophet==1.5.0 statsmodels==0.14.6'
    }
    & $forecastPython -m uvicorn forecast_app:app --host 127.0.0.1 --port 8000
} finally {
    Pop-Location
}
