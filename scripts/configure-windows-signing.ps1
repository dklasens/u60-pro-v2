param([switch]$Cleanup)
$ErrorActionPreference = 'Stop'
$certificatePath = Join-Path $env:RUNNER_TEMP 'open-u60-signing.pfx'
$configPath = Join-Path $env:RUNNER_TEMP 'open-u60-signing.json'
if ($Cleanup) {
    if ($env:U60_SIGNING_THUMBPRINT) { Remove-Item "Cert:\CurrentUser\My\$env:U60_SIGNING_THUMBPRINT" -ErrorAction SilentlyContinue }
    Remove-Item $certificatePath, $configPath -ErrorAction SilentlyContinue
    exit 0
}
if (-not $env:WINDOWS_CERTIFICATE) {
    Write-Output 'No Windows certificate configured: packages will be labelled unsigned.'
    exit 0
}
if (-not $env:WINDOWS_CERTIFICATE_PASSWORD) { throw 'WINDOWS_CERTIFICATE_PASSWORD is required when a certificate is configured.' }
[IO.File]::WriteAllBytes($certificatePath, [Convert]::FromBase64String($env:WINDOWS_CERTIFICATE))
$password = ConvertTo-SecureString $env:WINDOWS_CERTIFICATE_PASSWORD -AsPlainText -Force
$certificate = Import-PfxCertificate -FilePath $certificatePath -CertStoreLocation Cert:\CurrentUser\My -Password $password
if (-not $certificate.HasPrivateKey) { throw 'The signing certificate has no private key.' }
$config = @{ bundle = @{ windows = @{ certificateThumbprint = $certificate.Thumbprint; digestAlgorithm = 'sha256'; timestampUrl = 'http://timestamp.digicert.com' } } }
$config | ConvertTo-Json -Depth 5 | Set-Content -Path $configPath -Encoding utf8NoBOM
"U60_SIGNING_THUMBPRINT=$($certificate.Thumbprint)" >> $env:GITHUB_ENV
"WINDOWS_SIGNING_ARGS=--config $configPath" >> $env:GITHUB_ENV
Remove-Item $certificatePath
Write-Output 'Windows Authenticode signing configured; signatures must pass package checks.'
