param(
    [Parameter(Mandatory=$true)][string]$DistDir,
    [Parameter(Mandatory=$true)][string]$PublishSettings,
    [switch]$Simular,
    [switch]$PermitirCertificadoNoConfiable
)

$ErrorActionPreference = 'Stop'
$DistDir = (Resolve-Path -LiteralPath $DistDir).Path
$PublishSettings = (Resolve-Path -LiteralPath $PublishSettings).Path
$msdeployPaths = @(
    (Join-Path $env:ProgramFiles 'IIS/Microsoft Web Deploy V3/msdeploy.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'IIS/Microsoft Web Deploy V3/msdeploy.exe')
)
$msdeploy = $msdeployPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$msdeploy) { throw 'Instala Microsoft Web Deploy: https://aka.ms/webdeploydownload. El ZIP web ya esta preparado.' }

$xmlSettings = New-Object System.Xml.XmlReaderSettings
$xmlSettings.DtdProcessing = [System.Xml.DtdProcessing]::Prohibit
$xmlSettings.XmlResolver = $null
$reader = [System.Xml.XmlReader]::Create($PublishSettings, $xmlSettings)
try {
    $document = New-Object System.Xml.XmlDocument
    $document.XmlResolver = $null
    $document.Load($reader)
} finally { $reader.Dispose() }
$profiles = @($document.SelectNodes('/publishData/publishProfile') | Where-Object { $_.GetAttribute('publishMethod') -eq 'MSDeploy' })
if ($profiles.Count -ne 1) { throw 'El archivo debe contener exactamente un perfil MSDeploy para el sitio www.clinia.win.' }
$profile = $profiles[0]
$site = $profile.GetAttribute('msdeploySite')
$url = $profile.GetAttribute('publishUrl')
if (!$site -or !$url -or !$profile.GetAttribute('userName') -or !$profile.GetAttribute('userPWD')) {
    throw 'El perfil debe incluir msdeploySite, publishUrl, userName y userPWD. Descarga el perfil completo del panel.'
}
$endpoint = if ($url -match '^https://') { [uri]$url } else { [uri]('https://' + $url) }
if ($endpoint.Scheme -ne 'https' -or $url -match '^http://') { throw 'Web Deploy debe usar una URL HTTPS.' }
foreach ($value in @($site, $DistDir, $PublishSettings)) {
    if ($value.Contains("'") -or $value.Contains('"') -or $value.Contains("`n") -or $value.Contains("`r")) {
        throw 'Usa rutas y nombre de sitio sin comillas ni saltos de linea para Web Deploy.'
    }
}

$deployArgs = @(
    '-verb:sync',
    "-source:contentPath='$DistDir'",
    "-dest:contentPath='$site',publishSettings='$PublishSettings',authType=Basic,includeAcls=False",
    '-enableRule:DoNotDeleteRule',
    '-disableLink:AppPoolExtension',
    '-disableLink:ContentExtension',
    '-disableLink:CertificateExtension',
    '-useCheckSum',
    '-retryAttempts:2'
)
if ($PermitirCertificadoNoConfiable) { $deployArgs += '-allowUntrusted' }
if ($Simular) { $deployArgs += '-whatif' }
Write-Host "Web Deploy: $site en $($endpoint.Host) -> www.clinia.win"
& $msdeploy @deployArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Web Deploy fallo. Confirma que el perfil sea del sitio www.clinia.win y, si hay archivos bloqueados, reinicia el sitio desde el panel antes de repetir.'
}
if ($Simular) { Write-Host 'Simulacion terminada; no se modifico el hosting.' }
else { Write-Host 'Web publicada en MonsterASP.' -ForegroundColor Green }
