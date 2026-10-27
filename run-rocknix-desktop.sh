#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
rootfs=${ROCKNIX_ROOTFS:-"$repo_root/.runtime/rootfs"}
export ROCKNIX_ROOTFS="$rootfs"
export ROCKNIX_DOCKERFILE="$repo_root/docker/Dockerfile"
export ROCKNIX_CONTAINER_NAME=${ROCKNIX_CONTAINER_NAME:-rocknix-desktop}
compose=(docker compose -f "$repo_root/docker-compose.yml")

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[[ -d "$rootfs" ]] || die "authentic ROCKNIX RootFS not found at $rootfs; see docs/rocknix-desktop-feasibility.md"
[[ -x "$rootfs/usr/bin/sleep" ]] || die "RootFS is incomplete: usr/bin/sleep missing"

export DISPLAY=${DISPLAY:-}
export WAYLAND_DISPLAY=${WAYLAND_DISPLAY:-}
export XDG_RUNTIME_DIR=${XDG_RUNTIME_DIR:-}
export SDL_VIDEODRIVER=${SDL_VIDEODRIVER:-}
export SDL_AUDIODRIVER=${SDL_AUDIODRIVER:-}
export ROCKNIX_X11_SOCKET_DIR=${ROCKNIX_X11_SOCKET_DIR:-/tmp/.X11-unix}
export ROCKNIX_WAYLAND_SOCKET=${ROCKNIX_WAYLAND_SOCKET:-/nonexistent}

if [[ -n "$XDG_RUNTIME_DIR" && -n "$WAYLAND_DISPLAY" && -S "$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY" ]]; then
  export ROCKNIX_WAYLAND_SOCKET="$XDG_RUNTIME_DIR/$WAYLAND_DISPLAY"
fi

gui_mode=${ROCKNIX_GUI:-none}
case "$gui_mode" in
  x11) compose+=(-f "$repo_root/docker-compose.x11.yml") ;;
  wayland) compose+=(-f "$repo_root/docker-compose.wayland.yml") ;;
  none) ;;
  *) die 'ROCKNIX_GUI must be none, x11, or wayland' ;;
esac
xauth_tmp=
cleanup() {
  if [[ -n "$xauth_tmp" ]]; then rm -f -- "$xauth_tmp"; fi
}
trap cleanup EXIT

case "$gui_mode" in
  none)
    export DISPLAY= WAYLAND_DISPLAY= SDL_VIDEODRIVER=dummy SDL_AUDIODRIVER=dummy
    ;;
  x11)
    [[ -n "$DISPLAY" ]] || die 'ROCKNIX_GUI=x11 requires DISPLAY'
    command -v xauth >/dev/null || die 'xauth is required for isolated X11 forwarding'
    xauth_tmp=$(mktemp "${TMPDIR:-/tmp}/rocknix-xauth.XXXXXX")
    chmod 600 "$xauth_tmp"
    xauth nlist "$DISPLAY" | xauth -f "$xauth_tmp" nmerge -
    [[ -s "$xauth_tmp" ]] || die 'no X11 cookie available for DISPLAY'
    export SDL_VIDEODRIVER=x11 SDL_AUDIODRIVER=${SDL_AUDIODRIVER:-dummy}
    export ROCKNIX_XAUTH_FILE="$xauth_tmp"
    export ROCKNIX_CONTAINER_NAME
    ;;
  wayland)
    export SDL_VIDEODRIVER=wayland SDL_AUDIODRIVER=${SDL_AUDIODRIVER:-dummy}
    export XDG_RUNTIME_DIR=/run
    export WAYLAND_DISPLAY=wayland-0
    ;;
  *) die 'ROCKNIX_GUI must be none, x11, or wayland' ;;
esac

start_runtime() {
  "${compose[@]}" --profile runtime up -d --build rocknix-desktop
}

start_runtime

case "$gui_mode" in
  x11)
    docker exec "$ROCKNIX_CONTAINER_NAME" /usr/bin/env DISPLAY="$DISPLAY" XAUTHORITY=/run/host-xauth \
      SDL_VIDEODRIVER=x11 SDL_AUDIODRIVER="$SDL_AUDIODRIVER" \
      /usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
    ;;
  wayland)
    docker exec "$ROCKNIX_CONTAINER_NAME" /usr/bin/env \
      XDG_RUNTIME_DIR=/run WAYLAND_DISPLAY=wayland-0 SDL_VIDEODRIVER=wayland \
      SDL_AUDIODRIVER="$SDL_AUDIODRIVER" \
      /usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
    ;;
  none)
    printf 'ROCKNIX userspace started in %s; GUI apps are not launched (ROCKNIX_GUI=none).\n' "$ROCKNIX_CONTAINER_NAME"
    ;;
esac
