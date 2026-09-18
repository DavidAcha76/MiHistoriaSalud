param(
    [switch]$Offline,
    [switch]$Publicar,
    [switch]$SimularPublicacion,
    [string]$PublishSettings,
    [switch]$PermitirCertificadoNoConfiable,
    [switch]$Ayuda
)

$ErrorActionPreference = 'Stop'
if ($Ayuda) {
    Write-Host 'build-web.bat          Genera la web publicada y un ZIP para www.clinia.win.'
    Write-Host 'build-web.bat -Offline Evita consultas de red de Expo; usa dependencias instaladas/en cache.'
    Write-Host 'build-web.bat -Publicar Sube todos los archivos de dist con Web Deploy.'
    Write-Host 'build-web.bat -SimularPublicacion Consulta los cambios sin subirlos.'
    Write-Host 'Opciones: -PublishSettings ruta, -PermitirCertificadoNoConfiable.'
    Write-Host 'Guarda el perfil del sitio www.clinia.win en frontend/monsterasp.publishsettings.'
    Write-Host 'Salida: frontend/dist y frontend/dist-web/clinia-web-FECHA.zip.'
    exit 0
}
if ($Offline -and ($Publicar -or $SimularPublicacion)) { Write-Error 'La publicacion necesita Internet. Usa -Offline solo para generar el ZIP.'; exit 1 }
$frontendDir = Split-Path $PSScriptRoot -Parent
Push-Location $frontendDir
try {
    $npmExe = (Get-Command npm.cmd -ErrorAction Stop).Source
    if ($Offline) { $env:EXPO_OFFLINE = '1' }
    if (!(Test-Path -LiteralPath 'node_modules')) {
        $installArgs = @('ci', '--no-audit', '--no-fund', '--cache', '.npm-cache')
        if ($Offline) { $installArgs += '--offline' }
        & $npmExe @installArgs
        if ($LASTEXITCODE -ne 0) { throw 'No se pudieron instalar las dependencias.' }
    }
    & $npmExe run typecheck
    if ($LASTEXITCODE -ne 0) { throw 'TypeScript encontro errores.' }
    & $npmExe test
    if ($LASTEXITCODE -ne 0) { throw 'Fallaron las pruebas del frontend.' }
    & $npmExe run build:web
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo generar la web.' }
    $distDir = Join-Path $frontendDir 'dist'
    foreach ($name in @(
        'index.html',
        'web.config',
        '_expo/static/js/web',
        'assets/vendor/@react-navigation/elements/lib/module/assets/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png'
    )) {
        if (!(Test-Path -LiteralPath (Join-Path $distDir $name))) { throw "El build no contiene $name." }
    }
    $outputDir = Join-Path $frontendDir 'dist-web'
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
    $zipPath = Join-Path $outputDir ('clinia-web-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.zip')
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [IO.Compression.ZipFile]::CreateFromDirectory($distDir, $zipPath, [IO.Compression.CompressionLevel]::Optimal, $false)
    Write-Host "Web lista: $distDir" -ForegroundColor Green
    Write-Host "ZIP listo: $zipPath" -ForegroundColor Green
    Write-Host 'El ZIP contiene assets y debe descomprimirse completo en /wwwroot del sitio www.clinia.win. API: https://api.clinia.win/api'
    if ($Publicar -or $SimularPublicacion) {
        if (!$PublishSettings) { $PublishSettings = Join-Path $frontendDir 'monsterasp.publishsettings' }
        if (!(Test-Path -LiteralPath $PublishSettings)) {
            throw 'Falta el perfil del sitio www.clinia.win. Descargalo desde MonsterASP > Deploy y guardalo como frontend/monsterasp.publishsettings.'
        }
        & (Join-Path $PSScriptRoot 'publish-web.ps1') -DistDir $distDir -PublishSettings $PublishSettings -Simular:$SimularPublicacion -PermitirCertificadoNoConfiable:$PermitirCertificadoNoConfiable
        if (!$SimularPublicacion) {
            $assetUrl = 'https://www.clinia.win/assets/vendor/@react-navigation/elements/lib/module/assets/back-icon.35ba0eaec5a4f5ed12ca16fabeae451d.png'
            $published = $false
            for ($attempt = 0; $attempt -lt 6; $attempt++) {
                try {
                    $asset = Invoke-WebRequest -UseBasicParsing -Uri $assetUrl -TimeoutSec 10
                    if ($asset.StatusCode -eq 200 -and $asset.RawContentLength -gt 0) { $published = $true; break }
                } catch { Write-Host 'Esperando la propagacion de los assets publicados...' }
                Start-Sleep -Seconds 2
            }
            if (!$published) { throw "Los archivos se subieron, pero no se puede leer el asset publicado: $assetUrl" }
            Write-Host 'Publicacion web comprobada: HTML y assets disponibles.' -ForegroundColor Green
        }
    }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally { Pop-Location }
