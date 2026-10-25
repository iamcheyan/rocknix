#!/usr/bin/env bash
#
# ROCKNIX Handheld Launcher & Music Player Simulator
# Launches the 640x480 handheld simulator window on host desktop.
#

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$DIR/projects/ROCKNIX/packages/apps/handheld-launcher/src/handheld-launcher"
export ROCKNIX_SIMULATOR=1

if [ ! -f "$BIN" ]; then
  echo "==> Binary not found, building..."
  nix-shell -p SDL2 pkg-config gcc --run "make -C '$DIR/projects/ROCKNIX/packages/apps/handheld-launcher/src'"
fi

echo "=========================================================="
echo " Starting Handheld Simulator (RG34XX 720x480 resolution) "
echo " Controls:"
echo "   [Up / Down / W / S]   : Select Menu"
echo "   [Enter / J / Space]   : Confirm / Open / Play-Pause"
echo "   [Esc / K / Backspace] : Back to Main Menu / Exit"
echo "   [Left / Right]        : Switch Track (in Music Player)"
echo "   Gamepad / Controller  : D-Pad, A, B buttons supported"
echo "=========================================================="

exec "$BIN" "$@"
