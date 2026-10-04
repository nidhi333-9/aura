# Aura Sensor installer (Windows)
#
# Run from PowerShell:
#   $env:AURA_PAIR_CODE="ABCDE-FGHJK"; irm https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker/install.ps1 | iex
#
# AURA_PAIR_CODE is the one-time code from "Connect a sensor" in your Aura dashboard (valid for
# 10 minutes, single use). The sensor trades it for its own key; no login token is ever written
# to disk or typed into the shell. Without a code the sensor asks for one when it starts.
$ErrorActionPreference = "Stop"

if ($env:AURA_TOKEN -and -not $env:AURA_PAIR_CODE) {
    Write-Host "This install command is out of date: it carries a login token, which Aura no longer uses."
    Write-Host "Reload your Aura dashboard and copy the new command from 'Connect a sensor'."
    return
}

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

Write-Host "Starting Aura Sensor..."
# AURA_PAIR_CODE (if given) is inherited by the sensor, which pairs itself with it.
& "$ExtractDir\aura-sensor-windows.exe"
