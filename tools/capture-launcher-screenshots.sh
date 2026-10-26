#!/usr/bin/env bash
#
# Capture every Handheld Launcher screen for documentation.
#
# Each screen starts from a freshly launched simulator (no leaked instances, so
# navigation state cannot drift between screenshots). PNG files are written into
# documentation/customization/screenshots/mini-launcher/.
#
# Usage: tools/capture-launcher-screenshots.sh [output-dir]

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$DIR/projects/ROCKNIX/packages/apps/handheld-launcher/src"
BIN="$SRC_DIR/handheld-launcher"
OUT_DIR="${1:-$DIR/documentation/customization/screenshots/mini-launcher}"
WINDOW_NAME='ROCKNIX Handheld Simulator'

for tool in xdotool import; do
    command -v "$tool" >/dev/null 2>&1 || { echo "Missing required tool: $tool" >&2; exit 1; }
done

make -C "$SRC_DIR" >/dev/null
mkdir -p "$OUT_DIR"
rm -f "$OUT_DIR"/*.png

export ROCKNIX_SIMULATOR=1
export SDL_VIDEODRIVER="${SDL_VIDEODRIVER:-x11}"

launcher_pids() {
    ps -eo pid,args --no-headers | awk -v bin="$BIN" '$2 == bin {print $1}'
}

kill_launcher() {
    local pid
    for pid in $(launcher_pids); do
        kill "$pid" 2>/dev/null || true
    done
    for _ in $(seq 1 20); do
        [ -z "$(launcher_pids)" ] && break
        sleep 0.2
    done
    for pid in $(launcher_pids); do
        kill -9 "$pid" 2>/dev/null || true
    done
    for _ in $(seq 1 20); do
        [ -z "$(xdotool search --name "$WINDOW_NAME" 2>/dev/null | head -1 || true)" ] && return 0
        sleep 0.2
    done
}

trap kill_launcher EXIT

# capture <file-name> [keys...]
capture() {
    local name="$1"; shift
    kill_launcher

    "$BIN" >/tmp/launcher-capture.log 2>&1 &

    local wid=""
    for _ in $(seq 1 60); do
        wid="$(xdotool search --onlyvisible --name "$WINDOW_NAME" 2>/dev/null | tail -1 || true)"
        if [ -n "$wid" ] && xdotool getwindowgeometry "$wid" >/dev/null 2>&1; then
            break
        fi
        wid=""
        sleep 0.25
    done
    if [ -z "$wid" ]; then
        echo "Launcher window did not appear for $name; see /tmp/launcher-capture.log" >&2
        exit 1
    fi

    xdotool windowraise "$wid"
    xdotool windowactivate --sync "$wid" 2>/dev/null || true
    sleep 1

    local key
    for key in "$@"; do
        xdotool key "$key"
        sleep 0.4
    done

    sleep 1.2
    local attempt size
    for attempt in 1 2 3 4; do
        import -window "$wid" "$OUT_DIR/$name.png" 2>/dev/null || true
        size=$(stat -c%s "$OUT_DIR/$name.png" 2>/dev/null || echo 0)
        [ "$size" -gt 1500 ] && break
        echo "retrying capture of $name (attempt $attempt, ${size} bytes)" >&2
        sleep 1
    done
    echo "captured $name.png ($(stat -c%s "$OUT_DIR/$name.png") bytes)"
}

# Main menu
capture 01-main-menu

# Control center, then the same page scrolled past the six visible rows
capture 02-control-center Down Return
capture 03-control-center-scrolled Down Return Down Down Down Down Down Down

# Wi-Fi scanner and Bluetooth scanner
capture 04-wifi-networks Down Return Down Return
capture 05-bluetooth-devices Down Return Down Down Down Down Return

# System tools page and the confirmation dialog for the backup action
capture 06-system-tools Down Down Return
capture 07-confirm-dialog Down Down Return Down Down Return

# Live system information and power actions
capture 08-live-system-info Down Down Down Return
capture 09-power-actions Down Down Down Down Return

echo "Screenshots written to $OUT_DIR"
