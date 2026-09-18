param(
    [ValidateSet('apk', 'desarrollo', 'android', 'ios')][string]$Destino,
    [switch]$SoloVerificar,
    [switch]$Offline,
    [switch]$Ayuda
)

$ErrorActionPreference = 'Stop'
if ($Ayuda) {
    Write-Host 'build-celular.bat                         Elegir tipo de app y compilar en EAS.'
    Write-Host 'build-celular.bat -Destino apk            APK instalable, API publicada.'
    Write-Host 'build-celular.bat -Destino desarrollo     Android para Metro y API local.'
    Write-Host 'build-celular.bat -Destino android        AAB para Google Play, API publicada.'
    Write-Host 'build-celular.bat -Destino ios            iOS para distribucion; requiere firma Apple.'
    Write-Host 'build-celular.bat -SoloVerificar -Offline Verifica bundles Android/iOS sin EAS ni APK/IPA.'
    exit 0
}
if ($Offline -and !$SoloVerificar) { Write-Error 'La compilacion EAS necesita Internet. Usa -Offline con -SoloVerificar.'; exit 1 }
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
    if ($SoloVerificar) {
        & $npmExe run check:native
        if ($LASTEXITCODE -ne 0) { throw 'Fallo la generacion de bundles Android/iOS.' }
        Write-Host 'Bundles verificados en dist-native. Este modo no genera APK ni IPA.' -ForegroundColor Green
        exit 0
    }
    if (!$Destino) {
        Write-Host '1. APK Android instalable -> https://api.clinia.win/api'
        Write-Host '2. Android de desarrollo -> backend local con Metro'
        Write-Host '3. AAB Android para Google Play -> API publicada'
        Write-Host '4. iOS para distribucion -> API publicada (requiere Apple Developer)'
        $selection = Read-Host 'Elige 1-4 (Enter = 1)'
        $Destino = switch ($selection) { '' { 'apk' } '1' { 'apk' } '2' { 'desarrollo' } '3' { 'android' } '4' { 'ios' } default { throw 'Opcion no valida.' } }
    }
    $platform = if ($Destino -eq 'ios') { 'ios' } else { 'android' }
    $profile = switch ($Destino) { 'apk' { 'preview' } 'desarrollo' { 'development' } default { 'production' } }
    # Prevent a shell's local API override or disabled dotenv from leaking into EAS.
    $env:APP_VARIANT = if ($Destino -eq 'desarrollo') { 'local' } else { 'production' }
    $env:EXPO_PUBLIC_API_URL = if ($Destino -eq 'desarrollo') { '' } else { 'https://api.clinia.win/api' }
    $env:EXPO_NO_DOTENV = '1'
    Remove-Item Env:EXPO_OFFLINE -ErrorAction SilentlyContinue
    $npxExe = (Get-Command npx.cmd -ErrorAction Stop).Source
    & $npxExe --yes eas-cli whoami
    if ($LASTEXITCODE -ne 0) {
        & $npxExe --yes eas-cli login
        if ($LASTEXITCODE -ne 0) { throw 'Inicia sesion con tu cuenta Expo para compilar.' }
    }
    $appConfig = Get-Content -Raw -LiteralPath 'app.json' | ConvertFrom-Json
    if (!$appConfig.expo.extra.eas.projectId) {
        Write-Host 'Primera compilacion: vincula este proyecto con tu cuenta de Expo.'
        & $npxExe --yes eas-cli init
        if ($LASTEXITCODE -ne 0) { throw 'No se pudo vincular el proyecto de Expo. Completa eas-cli init antes de compilar.' }
    }
    # app.config.js preserves app.json fields, including the project ID written by EAS.
    & $npxExe --yes eas-cli build --platform $platform --profile $profile --wait
    if ($LASTEXITCODE -ne 0) { throw 'EAS no completo la compilacion. Revisa el mensaje anterior y los datos de la cuenta/firma.' }
    Write-Host 'Compilacion terminada. Usa el enlace de EAS para descargar e instalar la app.' -ForegroundColor Green
    if ($Destino -eq 'desarrollo') { Write-Host 'Despues de instalar: npm.cmd run start:dev-client. La API local debe estar activa.' }
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
} finally { Pop-Location }
