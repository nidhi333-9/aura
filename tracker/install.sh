#!/bin/bash
# Aura Sensor installer (macOS)
#
# Run directly from Terminal so the binary never gets the browser's
# com.apple.quarantine flag and never goes through Finder/Gatekeeper:
#   curl -fsSL https://raw.githubusercontent.com/nidhi333-9/aura/main/tracker/install.sh | bash
set -e

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

if [ -n "$AURA_TOKEN" ]; then
  printf '{"token": "%s"}' "$AURA_TOKEN" > "$HOME/.aura_token"
  echo "Signed in as your current dashboard session."
fi

echo "Installed to $DEST"
echo "Starting Aura Sensor..."
exec "$DEST"
