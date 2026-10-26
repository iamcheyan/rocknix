#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
sonata_source="${SONATA_SOURCE_DIR:-$(dirname "$repo_root")/sonata}"
if [[ -x /usr/local/go/bin/go ]]; then export PATH="/usr/local/go/bin:$PATH"; fi
if command -v go >/dev/null && [[ -f "$sonata_source/go.mod" ]]; then
  make -C "$sonata_source" build
fi
if [[ ! -x "$sonata_source/sonata" ]]; then
  echo "Sonata preview: build $sonata_source/sonata first (make build in the sonata repository)." >&2
  exit 127
fi
if ! command -v xfce4-terminal >/dev/null; then
  echo "Sonata preview: install xfce4-terminal." >&2
  exit 127
fi
exec xfce4-terminal --disable-server --hide-menubar --title=Sonata --geometry=90x30 \
  --execute "$sonata_source/sonata" --music "${XMPLAYER_MUSIC_DIR:-$HOME/Music}" \
  --data-dir "${XDG_DATA_HOME:-$HOME/.local/share}/sonata" "$@"
