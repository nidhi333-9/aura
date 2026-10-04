#!/bin/bash
# Aura Sensor installer (macOS)
#
# Run directly from Terminal so the binary never gets the browser's
# com.apple.quarantine flag and never goes through Finder/Gatekeeper:
#   curl -fsSL https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker/install.sh | AURA_PAIR_CODE=ABCDE-FGHJK bash
#
# AURA_PAIR_CODE is the one-time code from "Connect a sensor" in your Aura dashboard (valid for
# 10 minutes, single use). The sensor trades it for its own key; no login token is ever written
# to disk or typed into the shell. Without a code the sensor asks for one when it starts.
set -e

if [ -n "$AURA_TOKEN" ] && [ -z "$AURA_PAIR_CODE" ]; then
  echo "This install command is out of date: it carries a login token, which Aura no longer uses."
  echo "Reload your Aura dashboard and copy the new command from 'Connect a sensor'."
  exit 1
fi

REPO="nidhi333-9/aura"
OS=$(uname -s)
ARCH=$(uname -m)

if [ "$OS" != "Darwin" ]; then
  echo "This installer is for macOS. For Windows, download aura-sensor-windows.zip from:"
  echo "https://github.com/$REPO/releases/latest"
  exit 1
fi

if [ "$ARCH" = "arm64" ]; then
  ASSET="aura-sensor-mac-arm64"
else
  ASSET="aura-sensor-mac-intel"
fi

INSTALL_DIR="$HOME/.aura"
DEST="$INSTALL_DIR/aura-sensor"
URL="https://github.com/$REPO/releases/latest/download/$ASSET"

mkdir -p "$INSTALL_DIR"
echo "Downloading Aura Sensor ($ASSET)..."
curl -fsSL "$URL" -o "$DEST"
chmod +x "$DEST"

echo "Installed to $DEST"
echo "Starting Aura Sensor..."
# AURA_PAIR_CODE (if given) is inherited by the sensor, which pairs itself with it.
exec "$DEST"
