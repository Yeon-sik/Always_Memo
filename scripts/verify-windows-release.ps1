$ErrorActionPreference = "Stop"

$installer = Join-Path `
    $PSScriptRoot `
    "..\src-tauri\target\release\bundle\nsis\Yeonsik_Note_1.0.0_x64-setup.exe"
$resolvedInstaller = Resolve-Path -LiteralPath $installer -ErrorAction Stop
$signature = Get-AuthenticodeSignature -LiteralPath $resolvedInstaller.Path

if ($signature.Status -ne "Valid") {
    throw "Windows release is not trusted-signed: $($signature.Status). Configure Authenticode signing before distribution."
}

Write-Output "Windows release signature is valid: $($resolvedInstaller.Path)"
