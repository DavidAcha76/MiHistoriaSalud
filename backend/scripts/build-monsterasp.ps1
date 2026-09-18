param(
    [switch]$SoloBuild,
    [switch]$Offline,
    [switch]$SimularSubida,
    [switch]$ActualizarEntorno,
    [switch]$PermitirCertificadoNoConfiable,
    [string]$PublishSettings,
    [switch]$Ayuda
)

$ErrorActionPreference = 'Stop'
if ($Ayuda) {
    Write-Host 'build-monsterasp.bat                   Prepara ZIP y sube con Web Deploy.'
    Write-Host 'build-monsterasp.bat -SoloBuild         Solo genera carpeta y ZIP.'
    Write-Host 'build-monsterasp.bat -SoloBuild -Offline Usa las dependencias en cache.'
    Write-Host 'build-monsterasp.bat -SimularSubida     Consulta los cambios sin subirlos.'
    Write-Host 'Opciones: -PublishSettings ruta, -ActualizarEntorno, -PermitirCertificadoNoConfiable.'
    Write-Host 'Guarda el perfil del sitio api.clinia.win en backend/monsterasp.publishsettings.'
    exit 0
}
if ($Offline -and !$SoloBuild) { Write-Error 'Usa -Offline junto con -SoloBuild.'; exit 1 }
$backendDir = Split-Path $PSScriptRoot -Parent
Push-Location $backendDir
try {
    $nodeExe = (Get-Command node -ErrorAction Stop).Source
    $npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
    & $nodeExe -e "const [major,minor]=process.versions.node.split('.').map(Number);if(major<22||(major===22&&minor<13)){console.error('Se requiere Node 22.13 o posterior.');process.exit(1)}"
    if ($LASTEXITCODE -ne 0) { throw 'Version de Node incompatible.' }
    if (!(Test-Path -LiteralPath '.env.production')) { throw 'Falta backend/.env.production.' }
    if (!(Test-Path -LiteralPath 'node_modules')) {
        $installArgs = @('ci', '--no-audit', '--no-fund', '--cache', '.npm-cache')
        if ($Offline) { $installArgs += '--offline' }
        & $npmExe @installArgs
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
    }
    & $npmExe test
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del backend.' }
    $buildArgs = @('run', 'deploy:prepare')
    if ($Offline) { $buildArgs += @('--', '--offline') }
    & $npmExe @buildArgs
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar el backend.' }
    $manifest = Get-Content -Raw -LiteralPath 'dist/latest.json' | ConvertFrom-Json
    $packageDir = [IO.Path]::GetFullPath((Join-Path $backendDir $manifest.directory))
    $distRoot = [IO.Path]::GetFullPath((Join-Path $backendDir 'dist')) + [IO.Path]::DirectorySeparatorChar
    if (!$packageDir.StartsWith($distRoot, [StringComparison]::OrdinalIgnoreCase) -or !(Test-Path -LiteralPath (Join-Path $packageDir 'web.config'))) {
        throw 'La carpeta generada no es un paquete valido dentro de backend/dist.'
    }
    $zipPath = $packageDir + '.zip'
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($packageDir, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Host "ZIP listo: $zipPath" -ForegroundColor Green
    Write-Host 'El ZIP incluye el .env privado de produccion. Subirlo solo al sitio de la API.'
    if ($SoloBuild) { exit 0 }

    if (!$PublishSettings) { $PublishSettings = Join-Path $backendDir 'monsterasp.publishsettings' }
    if (!(Test-Path -LiteralPath $PublishSettings)) {
        Write-Host 'Descarga el perfil Web Deploy del sitio api.clinia.win desde MonsterASP > Deploy.'
        Write-Host 'Guarda ese archivo como backend/monsterasp.publishsettings y vuelve a ejecutar el BAT.'
        Write-Host 'Las credenciales MySQL no son las credenciales de publicacion. El ZIP ya esta preparado.'
        exit 2
    }

    Write-Host 'Si la API devuelve 500: MonsterASP > Detailed Settings > Logs > activa HttpPlatform Debug logs y reinicia el AppPool.'

    $previousEnvFile = $env:DOTENV_CONFIG_PATH
    try {
        # Check the exact .env that is included in the package.
        $env:DOTENV_CONFIG_PATH = Join-Path $packageDir '.env'
        & $nodeExe scripts/check-db.js --require-migrations
        if ($LASTEXITCODE -ne 0) { throw 'La base no esta lista. No se subio ningun archivo.' }
    } finally { $env:DOTENV_CONFIG_PATH = $previousEnvFile }

    & (Join-Path $PSScriptRoot 'publish-monsterasp.ps1') -PackageDir $packageDir -PublishSettings $PublishSettings -Simular:$SimularSubida -ActualizarEntorno:$ActualizarEntorno -PermitirCertificadoNoConfiable:$PermitirCertificadoNoConfiable
    if ($SimularSubida) { exit 0 }
    $ready = $false
    for ($attempt = 0; $attempt -lt 6; $attempt++) {
        try {
            $health = Invoke-RestMethod 'https://api.clinia.win/health/ready' -TimeoutSec 10
            if ($health.ok -and $health.database -eq 'connected') { $ready = $true; break }
        } catch { Write-Host 'Esperando el inicio de la API publicada...' }
        Start-Sleep -Seconds 2
    }
    if (!$ready) { throw 'Los archivos se subieron, pero /health/ready no confirma la conexion. Revisa DNS, HTTPS y los logs de MonsterASP.' }
    try {
        $preflight = Invoke-WebRequest -UseBasicParsing -Uri 'https://api.clinia.win/api/auth/register' -Method OPTIONS -Headers @{
            Origin = 'https://clinia.win'
            'Access-Control-Request-Method' = 'POST'
            'Access-Control-Request-Headers' = 'content-type'
        } -TimeoutSec 10
        if ($preflight.StatusCode -ne 204 -or $preflight.Headers['Access-Control-Allow-Origin'] -ne 'https://clinia.win') {
            throw 'La API no devolvio el preflight CORS esperado para clinia.win.'
        }
    } catch {
        throw "Los archivos se subieron y la base responde, pero CORS no quedo listo: $($_.Exception.Message)"
    }
    Write-Host 'Publicacion comprobada: https://api.clinia.win/health/ready' -ForegroundColor Green
    Write-Host 'CORS comprobado: https://clinia.win -> API' -ForegroundColor Green
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally { Pop-Location }
