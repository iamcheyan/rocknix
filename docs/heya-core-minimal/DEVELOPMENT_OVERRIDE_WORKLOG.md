# Development Override Mode worklog

## Analysis complete

- Verified target remote `origin/heya-core-minimal` at `94eb46217286a35a3eaf5b7559990111b1a9350f` and worked in a separate worktree because the canonical checkout contains unrelated dirty work.
- Traced `rocknix.target` → `rocknix-autostart.service` → `autostart` → H700 `UI_SERVICE` → `sway.service` + `heya.service`; independently verified the retained generic `essway.service` → `start_es.sh` → handheld-launcher/EmulationStation chain.
- Verified heya executable installation path `/usr/bin/heya`, unit install path `/usr/lib/systemd/system/heya.service`, H700 package options and read-only SYSTEM mount.

## Implementation complete

- Added a Go devexec wrapper to the heya package, only built/installed for developer images.
- Added explicit developer-mode defaults (`false`) and developer-only generation of the wrapped heya unit.
- Added design report at `docs/heya-core-minimal/DEVELOPMENT_OVERRIDE_MODE.md`.

## Verification

- `go build` of devexec: passed.
- Temporary-root behavioral checks: fallback system executable passed; `/storage/dev` mirror override executed; external symlink rejected with exit 127.
- `bash -n` for package/options scripts and `git diff --check`: passed.
- `systemd-analyze verify --root=... heya.service` with stub dependencies and devexec: passed.
- Direct host unit verification is not meaningful because host lacks ROCKNIX sway/heya executables.
- Full H700 image build and RG34XX hardware run: not performed in this environment.

## Delivery

- Pending final commit and push to `origin/heya-core-minimal`; CPR #76 remains open.
