param(
    [Parameter(Mandatory=$true)][string]$PackageDir,
    [Parameter(Mandatory=$true)][string]$PublishSettings,
    [switch]$Simular,
    [switch]$ActualizarEntorno,
    [switch]$PermitirCertificadoNoConfiable
)

$ErrorActionPreference = 'Stop'
$PackageDir = (Resolve-Path -LiteralPath $PackageDir).Path
$PublishSettings = (Resolve-Path -LiteralPath $PublishSettings).Path
$msdeployPaths = @(
    (Join-Path $env:ProgramFiles 'IIS/Microsoft Web Deploy V3/msdeploy.exe'),
    (Join-Path ${env:ProgramFiles(x86)} 'IIS/Microsoft Web Deploy V3/msdeploy.exe')
)
$msdeploy = $msdeployPaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (!$msdeploy) { throw 'Instala Microsoft Web Deploy: https://aka.ms/webdeploydownload. El ZIP ya esta preparado.' }

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
if ($profiles.Count -ne 1) { throw 'El archivo debe contener exactamente un perfil MSDeploy para el sitio de la API.' }
$profile = $profiles[0]
$site = $profile.GetAttribute('msdeploySite')
$url = $profile.GetAttribute('publishUrl')
if (!$site -or !$url -or !$profile.GetAttribute('userName') -or !$profile.GetAttribute('userPWD')) {
    throw 'El perfil debe incluir msdeploySite, publishUrl, userName y userPWD. Descarga el perfil completo del panel.'
}
$endpoint = if ($url -match '^https://') { [uri]$url } else { [uri]('https://' + $url) }
if ($endpoint.Scheme -ne 'https' -or $url -match '^http://') { throw 'Web Deploy debe usar una URL HTTPS.' }
# Native publishSettings support keeps the password out of the command line.
foreach ($value in @($site, $PackageDir, $PublishSettings)) {
    if ($value.Contains("'") -or $value.Contains('"') -or $value.Contains("`n") -or $value.Contains("`r")) {
        throw 'Usa rutas y nombre de sitio sin comillas ni saltos de linea para Web Deploy.'
    }
}
$deployArgs = @(
    '-verb:sync',
    "-source:contentPath='$PackageDir'",
    "-dest:contentPath='$site',publishSettings='$PublishSettings',authType=Basic,includeAcls=False",
    '-enableRule:DoNotDeleteRule',
    '-disableLink:AppPoolExtension',
    '-disableLink:ContentExtension',
    '-disableLink:CertificateExtension',
    '-useCheckSum',
    '-retryAttempts:2',
    '-skip:objectName=dirPath,absolutePath=(^|[\\/])(storage|logs)([\\/]|$)'
)
if (!$ActualizarEntorno) {
    # Add .env on the first deployment; preserve it on subsequent updates.
    $deployArgs += '-skip:objectName=filePath,absolutePath=(^|[\\/])\.env$,skipAction=Update'
}
if ($PermitirCertificadoNoConfiable) { $deployArgs += '-allowUntrusted' }
if ($Simular) { $deployArgs += '-whatif' }
Write-Host "Web Deploy: $site en $($endpoint.Host) -> API api.clinia.win"
Write-Host 'Se conservan archivos remotos adicionales, documentos privados y logs.'
& $msdeploy @deployArgs
if ($LASTEXITCODE -ne 0) {
    throw 'Web Deploy fallo. Si hay archivos bloqueados, detiene/reinicia el sitio desde el panel y repite. Si falla el certificado, revisalo antes de usar -PermitirCertificadoNoConfiable.'
}
if ($Simular) { Write-Host 'Simulacion terminada; no se modifico el hosting.' }
else { Write-Host 'Archivos subidos a MonsterASP.' -ForegroundColor Green }
