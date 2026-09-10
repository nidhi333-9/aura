# Aura Sensor installer (Windows)
#
# Run from PowerShell:
#   irm https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker/install.ps1 | iex
$ErrorActionPreference = "Stop"

$Repo = "nidhi333-9/aura"
$InstallDir = "$env:USERPROFILE\.aura"
$ZipPath = "$InstallDir\aura-sensor-windows.zip"
$ExtractDir = "$InstallDir\aura-sensor-windows"
$ZipUrl = "https://github.com/$Repo/releases/latest/download/aura-sensor-windows.zip"

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

Write-Host "Downloading Aura Sensor..."
Invoke-WebRequest -Uri $ZipUrl -OutFile $ZipPath

Write-Host "Extracting..."
Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

if ($env:AURA_TOKEN) {
    $TokenFile = "$env:USERPROFILE\.aura_token"
    $Payload = @{ token = $env:AURA_TOKEN } | ConvertTo-Json -Compress
    Set-Content -Path $TokenFile -Value $Payload
    Write-Host "Signed in as your current dashboard session."
}

Write-Host "Starting Aura Sensor..."
& "$ExtractDir\aura-sensor-windows.exe"
