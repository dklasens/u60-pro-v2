$ErrorActionPreference = 'Stop'
$setup = Get-ChildItem 'target/release/bundle/nsis/*-setup.exe' | Select-Object -First 1
if (-not $setup) { throw 'Windows setup package missing.' }
$signature = Get-AuthenticodeSignature $setup.FullName
if ($env:U60_SIGNING_THUMBPRINT -and $signature.Status -ne 'Valid') { throw 'Setup signature verification failed.' }
if (-not $env:U60_SIGNING_THUMBPRINT -and $signature.Status -ne 'NotSigned') { throw 'Unexpected setup signing state.' }
$destination = Join-Path $env:RUNNER_TEMP 'U60 setup smoke'
# NSIS requires /D to be last and treats the remainder as the destination.
$process = Start-Process -FilePath $setup.FullName -ArgumentList "/S /D=$destination" -PassThru
if (-not $process.WaitForExit(120000)) { $process.Kill(); throw 'Setup timed out.' }
if ($process.ExitCode -ne 0) { throw "Setup failed with exit $($process.ExitCode)." }
$exe = Get-ChildItem "$destination/*.exe" | Where-Object { $_.Name -notmatch 'uninstall' } | Select-Object -First 1
if (-not $exe) { throw 'Installed application executable missing.' }
python scripts/check-installer-package.py --windows-exe $exe.FullName
if ($LASTEXITCODE -ne 0) { throw 'Installed application startup check failed.' }
$uninstaller = Get-ChildItem "$destination/*uninstall*.exe" | Select-Object -First 1
if (-not $uninstaller) { throw 'Uninstaller missing.' }
$remove = Start-Process -FilePath $uninstaller.FullName -ArgumentList '/S' -PassThru
if (-not $remove.WaitForExit(60000)) { throw 'Uninstall timed out.' }
if ($remove.ExitCode -ne 0) { throw 'Uninstall failed.' }
Write-Output 'PASS: current-user Windows setup, packaged UI startup, and uninstall.'
$deadline = (Get-Date).AddSeconds(30)
while ((Test-Path $exe.FullName) -and (Get-Date) -lt $deadline) { Start-Sleep -Milliseconds 500 }
if (Test-Path $exe.FullName) { throw 'NSIS uninstall did not remove the application.' }

$msi = Get-ChildItem 'target/release/bundle/msi/*.msi' | Select-Object -First 1
if (-not $msi) { throw 'MSI package missing.' }
# Tauri's MSI intentionally reuses the NSIS path retained in HKCU. Exercise that
# migration using the same directory, rather than assuming INSTALLDIR overrides it.
$msiDestination = $destination
$msiLog = Join-Path $env:RUNNER_TEMP 'u60-msi-install.log'
$installMsi = Start-Process msiexec.exe -ArgumentList "/i `"$($msi.FullName)`" /qn /norestart INSTALLDIR=`"$msiDestination`" /L*v `"$msiLog`"" -PassThru
if (-not $installMsi.WaitForExit(120000)) { throw 'MSI setup timed out.' }
if ($installMsi.ExitCode -notin @(0, 3010)) {
    Get-Content $msiLog -Tail 50
    throw "MSI setup failed with exit $($installMsi.ExitCode)."
}
$msiExe = Get-ChildItem "$msiDestination/*.exe" | Select-Object -First 1
if (-not $msiExe) { throw 'MSI application executable missing.' }
python scripts/check-installer-package.py --windows-exe $msiExe.FullName
if ($LASTEXITCODE -ne 0) { throw 'MSI application startup check failed.' }
$removeMsi = Start-Process msiexec.exe -ArgumentList "/x `"$($msi.FullName)`" /qn /norestart" -PassThru
if (-not $removeMsi.WaitForExit(120000)) { throw 'MSI uninstall timed out.' }
if ($removeMsi.ExitCode -notin @(0, 3010)) { throw 'MSI uninstall failed.' }
if (Test-Path $msiExe.FullName) { throw 'MSI uninstall did not remove the application.' }
Write-Output 'PASS: MSI installation, packaged UI startup, and uninstall.'
