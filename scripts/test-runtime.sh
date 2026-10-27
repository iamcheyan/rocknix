#!/usr/bin/env bash
set -Eeuo pipefail

repo_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
rootfs=${ROCKNIX_ROOTFS:-"$repo_root/.runtime/rootfs"}
report=${RUNTIME_REPORT:-"$repo_root/.runtime/report.txt"}
container_name=${ROCKNIX_CONTAINER_NAME:-rocknix-desktop}

mkdir -p "$(dirname "$report")"
: > "$report"
status=0

check() {
  local label=$1
  shift
  if "$@"; then
    printf 'PASS %s\n' "$label" | tee -a "$report"
  else
    local result=$?
    printf 'FAIL %s (exit %s)\n' "$label" "$result" | tee -a "$report"
    status=1
  fi
}

check_rootfs() {
  [[ -x "$rootfs/usr/bin/env" && -e "$rootfs/usr/lib/ld-linux-x86-64.so.2" ]]
}

check_services() {
  local unit="$rootfs/usr/lib/systemd/system/heya.service"
  [[ -f "$unit" ]] && grep -q '^Requires=sway.service$' "$unit" && grep -q '^After=sway.service$' "$unit"
}

check_binary_arch() {
  local binary=$1
  local arch=$2
  [[ -x "$binary" ]] && file -b "$binary" | grep -Fq "$arch"
}

check_x86_libs() {
  local app=$1
  [[ -e "$rootfs$app" ]] || return 2
  local output
  output=$(docker exec "$container_name" /usr/bin/ldd "$app" 2>&1) || return 1
  printf '%s\n' "$output" | tee -a "$report"
  ! grep -q 'not found' <<<"$output"
}
check_container_app() {
  local app=$1
  docker exec "$container_name" /usr/bin/timeout 10 "$app" --help
}

if [[ ! -d "$rootfs" ]]; then
  printf 'FAIL RootFS exists: %s\n' "$rootfs" | tee -a "$report"
  status=1
else
  check 'RootFS exists and is x86_64 glibc' check_rootfs
  check 'systemd heya unit requires sway' check_services

  if [[ -x "$rootfs/usr/bin/heya" ]]; then
    check 'heya is x86_64 ELF' check_binary_arch "$rootfs/usr/bin/heya" 'x86-64'
    if docker container inspect "$container_name" >/dev/null 2>&1; then
      check 'heya dynamic library closure resolves in container' check_x86_libs /usr/bin/heya
      check 'heya real launch in container' docker exec "$container_name" /usr/bin/timeout 10 /usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
    else
      printf 'SKIP heya dependency/launch: runtime container is not running\n' | tee -a "$report"
      status=1
    fi
  else
    printf 'FAIL heya executable absent from official RootFS\n' | tee -a "$report"
    status=1
  fi

  if [[ -d "$rootfs/usr/share/heya/apps" ]]; then
    printf 'PASS image app manifest directory exists\n' | tee -a "$report"
  else
    printf 'FAIL image app manifest directory absent\n' | tee -a "$report"
    status=1
  fi
  [[ -d "$repo_root/docker/fixtures/storage/heya/apps" && -f "$repo_root/docker/fixtures/storage/heya/themes/theme.json" ]] &&
    printf 'PASS mock app/theme fixture exists\n' | tee -a "$report" || { printf 'FAIL mock fixtures absent\n' | tee -a "$report"; status=1; }

  xmplayer_bin="$rootfs/usr/share/xmplayer/bin/love"
  if [[ -e "$xmplayer_bin" ]]; then
    love_info=$(file -b "$xmplayer_bin")
    printf 'XMPlayer Love ELF: %s\n' "$love_info" | tee -a "$report"
    if grep -q 'ARM aarch64' <<<"$love_info"; then
      printf 'BLOCKED xmplayer: bundled Love binary is AArch64 and cannot execute in AMD64 RootFS\n' | tee -a "$report"
      status=1
    else
      check 'xmplayer Love runtime is x86_64 ELF' check_binary_arch "$xmplayer_bin" 'x86-64'
    fi
  else
    printf 'BLOCKED xmplayer: package files absent from RootFS\n' | tee -a "$report"
    status=1
  fi

  if [[ -x "$rootfs/usr/bin/retroarch" ]]; then
    check 'RetroArch binary is x86_64 ELF' check_binary_arch "$rootfs/usr/bin/retroarch" 'x86-64'
  else
    printf 'BLOCKED RetroArch: binary absent from official RootFS\n' | tee -a "$report"
    status=1
  fi

  if docker container inspect "$container_name" >/dev/null 2>&1; then
    check 'heya dynamic library closure resolves in container' check_x86_libs /usr/bin/heya
    check 'heya real launch in container' docker exec "$container_name" /usr/bin/timeout 10 /usr/bin/heya --theme /storage/heya/themes/theme.json --apps /storage/heya/apps
    if [[ -x "$rootfs/usr/bin/xmplayer" ]]; then
      check 'xmplayer dependency check in container' docker exec "$container_name" /usr/bin/timeout 10 /usr/bin/xmplayer --check
    else
      printf 'BLOCKED xmplayer launch: wrapper absent from RootFS\n' | tee -a "$report"
      status=1
    fi
  else
    printf 'SKIP app launches and container ldd: runtime container is not running\n' | tee -a "$report"
    status=1
  fi
fi

printf '\nAuthentic RootFS: %s\nMock fixtures: %s\n' "$rootfs" "$repo_root/docker/fixtures" | tee -a "$report"
exit "$status"
