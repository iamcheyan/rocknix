#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export HEYA_SIMULATOR=1
heya_source="${HEYA_SOURCE_DIR:-$(dirname "$repo_root")/heya}"
export ROCKNIX_SIMULATOR_STATE="${ROCKNIX_SIMULATOR_STATE:-${XDG_STATE_HOME:-$HOME/.local/state}/rocknix-simulator}"

python3 - "$repo_root" "$ROCKNIX_SIMULATOR_STATE" <<'PY'
import json
from pathlib import Path
import sys

root, state = map(Path, sys.argv[1:])
entries = {
    "xmplayer": (root / "projects/ROCKNIX/packages/apps/xmplayer/app.json", "run-xmplayer-simulator.sh"),
    "sonata": (root / "projects/ROCKNIX/packages/apps/sonata/apps/sonata/app.json", "run-sonata-simulator.sh"),
}
for name, (source, runner) in entries.items():
    manifest = json.loads(source.read_text())
    manifest.update(entrypoint=str(root / "tools" / runner), args=[], workingDirectory=str(root))
    target = state / "apps" / name / "app.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n")
PY

if [[ ${1:-} == --prepare-only ]]; then exit 0; fi
if [[ -x /usr/local/go/bin/go ]]; then export PATH="/usr/local/go/bin:$PATH"; fi
if command -v go >/dev/null && [[ -f "$heya_source/go.mod" ]]; then
  make -C "$heya_source" build
elif [[ ! -x "$heya_source/heya" ]] || [[ -n $(find "$heya_source/cmd" "$heya_source/internal" -name '*.go' -newer "$heya_source/heya" -print -quit) ]]; then
  echo "Heya preview: install Go and build $heya_source/heya (make build in the heya repository)." >&2
  exit 127
fi

cd "$heya_source"
exec ./heya --apps "$ROCKNIX_SIMULATOR_STATE/apps" \
  --theme "$heya_source/themes/default/theme.json" --width 720 --height 480 "$@"
