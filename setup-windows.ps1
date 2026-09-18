$ErrorActionPreference = "Stop"
Write-Host "== MiHistoria Salud: preparación ==" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"
if (!(Test-Path ".env")) { throw 'Configura backend/.env con las credenciales de la base remota.' }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias del backend.' }

Set-Location "$PSScriptRoot\frontend"
if (!(Test-Path ".env")) { Set-Content -Path '.env' -Value 'EXPO_PUBLIC_API_URL=' -Encoding utf8 }
npm.cmd ci
if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias del frontend.' }

Write-Host "Listo." -ForegroundColor Green
Set-Location $PSScriptRoot
Write-Host "Inicia todo: powershell -ExecutionPolicy Bypass -File .\start-local.ps1"
Write-Host "Web: http://localhost:8081. App: escanea el QR con Expo Go."
