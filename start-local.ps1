param([switch]$NoFrontend)

$ErrorActionPreference = 'Stop'
$backendDir = Join-Path $PSScriptRoot 'backend'
$frontendDir = Join-Path $PSScriptRoot 'frontend'
$nodeExe = (Get-Command node -ErrorAction Stop).Source
$npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source

function Test-LocalPort([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try { $client.Connect('127.0.0.1', $Port); return $true }
    catch { return $false }
    finally { $client.Dispose() }
}

foreach ($dir in @($backendDir, $frontendDir)) {
    if (!(Test-Path (Join-Path $dir 'node_modules'))) { throw 'Instala las dependencias con setup-windows.ps1 primero.' }
    if (!(Test-Path (Join-Path $dir '.env'))) { throw "Falta configurar $dir/.env." }
}

Push-Location $backendDir
try {
    & $npmExe run db:check
    if ($LASTEXITCODE -ne 0) { throw 'La base remota no responde o rechaza las credenciales. Revisa backend/.env y el acceso remoto del hosting.' }
    $lanAddress = (& $nodeExe (Join-Path $frontendDir 'scripts/local-network.cjs')).Trim()
    if (!(Test-LocalPort 4000)) {
        $previousBaseUrl = $env:APP_BASE_URL
        try {
            $env:APP_BASE_URL = "http://${lanAddress}:4000"
            Start-Process -FilePath $nodeExe -ArgumentList 'server.js' -WorkingDirectory $backendDir -WindowStyle Hidden -RedirectStandardOutput (Join-Path $backendDir '.api.stdout.log') -RedirectStandardError (Join-Path $backendDir '.api.stderr.log') | Out-Null
        } finally { $env:APP_BASE_URL = $previousBaseUrl }
        for ($attempt = 0; $attempt -lt 30 -and !(Test-LocalPort 4000); $attempt++) { Start-Sleep -Seconds 1 }
        if (!(Test-LocalPort 4000)) { throw 'La API no inicio. Revisa backend/.api.stderr.log.' }
    }
    $health = Invoke-RestMethod 'http://127.0.0.1:4000/health/ready'
    if (!$health.ok) { throw 'La API no esta lista.' }
    Write-Host "API lista: http://${lanAddress}:4000/api" -ForegroundColor Green
} finally { Pop-Location }

Write-Host 'Web: http://localhost:8081'
Write-Host "Telefono (misma red Wi-Fi): exp://${lanAddress}:8081"
Write-Host 'La API local utiliza la misma base remota que produccion. No se cargan datos demo.'
if (!$NoFrontend) {
    if (Test-LocalPort 8081) { Write-Host 'Expo ya esta escuchando en 8081.'; return }
    Push-Location $frontendDir
    try { & $npmExe start }
    finally { Pop-Location }
}
