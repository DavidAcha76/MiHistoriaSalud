$ErrorActionPreference = "Stop"
Write-Host "== MiHistoria Salud: preparación ==" -ForegroundColor Cyan

Set-Location "$PSScriptRoot\backend"
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host "Se creó backend/.env. Revisa DB_PASSWORD si corresponde." -ForegroundColor Yellow }
npm install
npm run db:setup

Set-Location "$PSScriptRoot\frontend"
if (!(Test-Path ".env")) { Copy-Item ".env.example" ".env"; Write-Host "Se creó frontend/.env. Para teléfono físico configura la IP LAN del API." -ForegroundColor Yellow }
npm install
npx expo install --fix

Write-Host "Listo." -ForegroundColor Green
Write-Host "Terminal 1: cd backend; npm run dev"
Write-Host "Terminal 2 WEB: cd frontend; npm run web"
Write-Host "Terminal 2 ANDROID: cd frontend; npm run android"
