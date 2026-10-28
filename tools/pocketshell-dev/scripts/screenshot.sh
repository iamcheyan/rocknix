#!/bin/sh
# Capture Dev Center screenshots into tools/pocketshell-dev/screenshots/.
# Requires chromium or chromium-browser. Host-harness evidence only; no H700
# device is exercised here.
set -eu
cd "$(dirname "$0")/.."
PORT="${1:-8080}"
OUT="${2:-screenshots}"
mkdir -p "$OUT"
BROWSER=""
for candidate in chromium chromium-browser google-chrome google-chrome-stable; do
  if command -v "$candidate" >/dev/null 2>&1; then BROWSER="$candidate"; break; fi
done
if [ -z "$BROWSER" ]; then
  echo "no chromium-family browser found; install chromium or pass a browser name" >&2
  exit 1
fi
for name in ws1-shell ws2-files ws3-vim ws4-top ws5-log ws6-replay ws7-inspector ws8-metrics ws9-ansi ws10-pty ws11-session ws12-mirror; do
  "$BROWSER" --headless --disable-gpu --no-sandbox --screenshot="$OUT/13-$name.png" \
    "http://127.0.0.1:$PORT/" >/dev/null 2>&1 || true
  sleep 1
done
echo "screenshots written to $OUT"