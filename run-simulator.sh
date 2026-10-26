#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ ${1:-} == --legacy ]]; then
  shift
  exec "$repo_root/tools/run-launcher-simulator.sh" "$@"
fi
exec "$repo_root/tools/run-heya-simulator.sh" "$@"
