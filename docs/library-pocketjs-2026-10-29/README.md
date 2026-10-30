# PocketJS games in the library (2026-10-29)

Goal: a `.pocket` application dropped into the content directory must be indexed
by the library, shown under the game section, and startable from the launcher —
without a third-party frontend.

## What changed

| File | Change |
|---|---|
| `scripts/pocketshell-games` | `.pocket` added to the game extensions; every entry now carries `"kind": "pocketjs"` or `"kind": "rom"` |
| `scripts/pocketshell-play` | new launcher helper: `.pocket` → `pocket-session-run` + `pocket-linux-kms`; other content reports that no player handles it |
| `scripts/pocketshell-launcher.rs` | `ROMS` / `ROMSCAN` / `ROMLAUNCH` bridge commands (reads the catalogue, never scans on the render thread) |
| `hello/library-workspace.tsx` | library list page (removed in Launcher V2; see `docs/launcher-v2/`) |
| `hello/main.tsx` | Library entry, auto refresh, and row activation |
| `system.d/pocketshell-games.service` | scanner service (`Nice=10`, `CPUQuota=20%`, `MemoryMax=64M`) |
| `package.mk` | installs the scanner, the helper and the unit |

The scanner writes `/storage/pocketshell/library/library.json` atomically; the
launcher only reads that JSON.

## Verified on the device

| # | Check | Evidence |
|---|---|---|
| P1 | `.pocket` indexed under `GAMES` (`misc` group) | `LIB-P01-pocketjs-in-games.png` |
| P2 | `A` on that row starts the game from the library | `LIB-P02-launched-from-library.png` |

Scanner output after the change:

```json
{"name": "misc", "count": 1,
 "items": [{"title": "star-drift",
            "path": "/storage/content/games/misc/star-drift.pocket",
            "kind": "pocketjs"}]}
```

Launching the row runs, as confirmed from the process table:

```text
/bin/bash /usr/bin/pocket-session-run /storage/pocketjs/bin/pocket-linux-kms \
  --package /storage/content/games/misc/star-drift.pocket --card /dev/dri/card1
```

The game then renders at 720×480 (60 FPS / 16.6 ms in the captured frame). Exiting
the session restores `pocketjs-kms` on `boot.pocket`.

## Known limitation

Selection inside the list is indicated by the `>` gutter marker and the detail
line rather than a moving highlight bar: PocketJS evaluates a row's `class` and
`style` once when the node is created, so a conditional background stays at its
first value. Rebuilding rows with `<For>` crashed the guest, so the text marker is
the reliable option.

## Deployment note

This is a `/storage` manual-deploy verification: the scanner and helper were copied
to `/storage/dev/usr/bin/` and the boot app to `/storage/pocketjs/apps/`. The image
paths (`/usr/bin/pocketshell-games`, `/usr/bin/pocketshell-play`) are installed by
`package.mk` and still need an image build to be verified.
