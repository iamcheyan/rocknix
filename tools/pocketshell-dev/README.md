# PocketShell Developer Host

Browser harness for the PocketShell terminal frontend. It runs the **same**
`pocketshell-terminal.rs` module the firmware uses — the PTY manager, the ANSI
parser and the screen buffer are not reimplemented here — and serves it on
`0.0.0.0:8080`.

![WS1 shell](screenshots/01-ws1-shell.png)

The panel is presented at its real geometry: 720×480 physical, 360×240 logical,
2× scale. Cells are 12×16 px, giving the device's 54×24 grid.

## Why it exists

Flashing an image to check whether a colour or an escape sequence renders is
slow and gives no visibility into the model. This host keeps the real terminal
model and adds the instruments: dirtied rows, attribute runs, parser output,
workspace lifetimes and per-frame cost.

## Workspace kinds

| Kind | Status | Notes |
|---|---|---|
| Real PTY | implemented | Five live workspaces (`sh`, `ranger`/`lf`, `vim`, `htop`/`top`, log) started once and kept alive across switches |
| Replay | implemented | Timed PTY chunks fed back through the same parser; play/pause/restart/seek |
| Native PocketJS | contract only | Needs the PocketJS runtime and an app bundle; the `Workspace` contract is defined in the firmware `hello/README.md` |

## Running

```sh
cd tools/pocketshell-dev
cargo run --release            # http://127.0.0.1:8080
cargo run --release -- 9090    # alternate port
```

Exit with Ctrl-C; nothing is installed system-wide.

## Keys

| Key | Action |
|---|---|
| Q / E | Previous / next workspace |
| 1 / 2 | PageUp / PageDown to the shell |
| Enter | Enter |
| F2 / ` | Open Input Workspace; Escape exits and restores the existing view |
| L / R while open | Cycle ABC / NUM / SYM / PATH layouts |
| PageUp / PageDown while open | Cycle Keyboard / History / Commands / Phrases / Sessions / Agent |
| Character / Backspace / Enter while open | Edit and submit the input buffer |
| Tab | Next workspace |
| ` | WS1 |
| Arrows | Arrow keys |
| Ctrl-C | Interrupt |

The Input Workspace is a render overlay. `POST /api/input` accepts `INPUT\tENTER`, `INPUT\tEXIT`, `INPUT\tBUFFER <text>`, `INPUT\tLAYOUT <name>`, `INPUT\tFUNCTION <name>`, `INPUT\tSUBMIT`, `INPUT\tCLEAR`, `INPUT\tDELETE <text>`, and `INPUT\tFAVORITE <text>`. `/api/state` includes an `input` object with `entered`, `previousView`, `buffer`, `layout`, `function`, and submitted `history`.

## Panels

- **Terminal Buffer** — rows, columns, cursor, visible cell count, active
  workspace, alternate-screen state, bytes in/out.
- **Workspace Inspector** — one row per workspace: state, PID, `/dev/pts/N`,
  buffer cells, idle seconds. Proves the PTY survives a switch.
- **Runtime Log** — `Workspace Created`, `PTY Started`, `Workspace Activated`,
  `PTY Exited`, `Resize Events`, plus parser faults.
- **Performance** — FPS, smoothed frame cost, cells and attribute runs rendered,
  buffer size, workspace count.
- **ANSI Playground** — paste escape sequences (`\x1b[31m`, `\x1b[38;5;208m`,
  `\x1b[7m`, …) and inspect the resulting cells with their exact colours and the
  parser error count.

## Recording

`record-terminal` is built in as a subcommand:

```sh
./target/release/pocketshell-dev record recordings/top-session.log -- top -b -n 2 -d 1
RECORD_MS=3000 ./target/release/pocketshell-dev record out.log -- env TERM=xterm-256color ls --color=always
```

Format is one chunk per line, `<milliseconds>\t<hex bytes>`. Hex keeps escape
sequences and UTF-8 intact, so a replay exercises the real parser. `TERM` matters:
`ls --color=always` still emits no colour when `TERM` is unset.

Load a recording from the host (`POST /api/replay/load`) and it becomes WS6.

## Screenshots

| File | Shows |
|---|---|
| `01-ws1-shell.png` | `cd`, `ls`, `echo` in WS1 with real multibyte output |
| `02-ws2-files.png` | WS2 file browser in the alternate screen with selection highlight |
| `03-ws3-vim.png` | vim editing a Rust file, syntax colours, status line |
| `04-ws4-top.png` | top: CPU bars, load average, coloured memory columns |
| `05-ws5-log.png` | WS5 metrics and the workspace lifecycle log |
| `06-ws6-replay.png` | replayed `ls -la` with blue directory entries |
| `07-workspace-inspector.png` | per-workspace PID, PTY path, cells, idle |
| `08-performance.png` | FPS 62, frame cost ~0.03 ms, runs rendered |
| `09-runtime-log.png` | lifecycle events |
| `10-ansi-playground.png` | parsed escape sequences with colour swatches |

## Known differences from the device

- `bold` is recorded in the model and currently expressed through colour only:
  the PocketJS `font-mono` slot has no bold weight.
- 24 rows is the panel limit; `top` output longer than that scrolls, exactly as
  it will on hardware.
- Mouse reporting and bracketed paste are not implemented anywhere yet.

These are model-level limitations, not host-level ones, so the host does not
hide them.

## OTA simulator

The **OTA Simulator** tab uses a filesystem root only. It initializes `slot-a`, `slot-b`, and `recovery` fixtures under `${TMPDIR:-/tmp}/pocketshell-ota-sim`; override with `POCKETSHELL_OTA_ROOT`. The checked-in signed local package is under `fixtures/ota`. Check the manifest, stage to the inactive slot, confirm a simulated healthy boot, simulate boot failures (rollback after three), or request rollback from the browser.

The HTTP API exposes `GET /api/ota/status`, `GET /api/ota/log`, `POST /api/ota/check`, `POST /api/ota/install`, `POST /api/ota/confirm`, `POST /api/ota/boot-failure`, and `POST /api/ota/rollback`. Configure fixtures with `POCKETSHELL_OTA_FIXTURE` and a trusted public key with `POCKETSHELL_OTA_PUBLIC_KEY`.

`cargo run -- push 192.0.2.1 --dry-run` exercises local package verification and slot staging without connecting to the address, rebooting, or touching a device. The example address is documentation-only. HTTP remote, local discovery, GitHub Releases, and USB providers are explicitly unsupported. See [docs/ota.md](docs/ota.md) for architecture, state transitions, H700 evidence, and integration gaps. The simulator is not hardware update support.
