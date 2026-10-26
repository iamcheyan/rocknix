#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
for dependency in love ffmpeg mpv; do
  if ! command -v "$dependency" >/dev/null 2>&1; then
    echo "XMPlayer: missing host dependency '$dependency' (Debian: sudo apt install love ffmpeg mpv)" >&2
    exit 127
  fi
done

export XMPLAYER_SIMULATOR=1
export XMPLAYER_APP_DIR="$repo_root/projects/ROCKNIX/packages/apps/xmplayer/app"
export XMPLAYER_DATA_DIR="${XMPLAYER_DATA_DIR:-${XDG_CONFIG_HOME:-$HOME/.config}/xmplayer}"
export XMPLAYER_FFMPEG="$(command -v ffmpeg)"
export XMPLAYER_FFPLAY="$(command -v ffplay || true)"
export XMPLAYER_PLAYBACK="$repo_root/projects/ROCKNIX/packages/apps/xmplayer/scripts/xmplayer-playback"
export XMPLAYER_MUSIC_DIR="${XMPLAYER_MUSIC_DIR:-$HOME/Music}"
export XMPLAYER_PHOTO_DIR="${XMPLAYER_PHOTO_DIR:-$HOME/Pictures}"
export XMPLAYER_VIDEO_DIR="${XMPLAYER_VIDEO_DIR:-$HOME/Videos}"
mkdir -p "$XMPLAYER_DATA_DIR/thumbnails"
cd "$XMPLAYER_APP_DIR"
exec love "$XMPLAYER_APP_DIR" "$@"
