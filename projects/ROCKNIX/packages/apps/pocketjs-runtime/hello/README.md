# PocketShell

PocketShell replaces the PocketJS boot menu with a five-workspace terminal shell for the RG34XX 720×480 panel. Workspaces are long-lived PTYs inside the PocketJS host runtime; switching a workspace only changes which terminal model is rendered.

## Architecture

```
PTY (per workspace)
    -> AnsiParser        (state machine, incremental UTF-8)
    -> TerminalBuffer    (Cell grid + CursorState)
    -> line runs         (dirty rows only)
    -> PocketJS app      (one Text per run, colours via style)
```

`pocketshell-terminal.rs` holds the model and is copied into the published PocketJS guest crate by `patch-runtime.py`. PTY bytes never reach JavaScript: the parser keeps a `ScreenBuffer`, and each frame the host emits only the rows that changed plus the cursor position.

Types: `Cell { ch, fg, bg, flags }`, `ScreenBuffer { rows, cols, cells, dirty }`, `CursorState { row, col, visible }`, and `Terminal` which owns the parser, the buffer, scroll region, saved cursor, alternate screen and attributes.

## Renderer design

- The panel is a fixed `DisplayProfile`: 54 columns × 24 rows at 12 px mono (12×16 cell) = 648×384 inside 720×480.
- Cells are grouped into runs of identical attributes. One `Text` component per run, never per character; a full 54×24 screen is typically 40–120 runs.
- Colours are exact: the host emits `RRGGBB` per run and the app passes `textColor`/`bgColor` as ABGR through `style`, so no palette class enumeration is needed.
- `inverse` swaps text and background; `bold` is recorded in the model and currently rendered by colour only (PocketJS `font-mono` has no bold slot).
- The cursor is drawn as an inverted cell in its row, because the panel exposes no block-cursor primitive.
- Only dirty rows cross the host/guest boundary, so a static screen costs one short frame string per tick.

## ANSI support matrix

| Area | Sequences | Status |
|---|---|---|
| Cursor position | `ESC[H`, `ESC[row;colH`, `ESC[row;colf`, `ESC[nA/B/C/D`, `ESC[nG`, `ESC[nd`, `ESC[E`, `ESC[F` | supported |
| Erase | `ESC[J` (0/1/2/3), `ESC[K` (0/1/2), `ESC[nX` | supported |
| Text control | CR, LF, BS, TAB, BEL, `ESC 7`/`ESC 8`, `ESC[s`/`ESC[u` | supported |
| Attributes | SGR 0/1/4/7/22/24/27, 30–37, 39, 40–47, 49, 90–97, 100–107 | supported |
| 256 colour | `ESC[38;5;n`, `ESC[48;5;n`, `ESC[38;2;r;g;b` | supported |
| Scrolling | `ESC[r` region, `ESC[S`, `ESC[T`, `ESC[L`, `ESC[M` | supported |
| Lines | insert/delete line, delete character (`ESC[P`) | supported |
| Screens | `ESC[?1049h/l`, `ESC[?47h/l`, `ESC[?1047h/l` | supported |
| Modes | `ESC[?25h/l` cursor visibility, `ESC[?7h/l` auto-wrap | supported |
| Ignored | OSC titles, charset designation, application-keypad mode | parsed and dropped |
| Not implemented | mouse reporting, bracketed paste, sixel, hyperlinks, true 24-bit `ESC[38;2` fallback for 256-cube only | out of scope |

## Workspaces and input

- WS1 `/bin/sh`, WS2 `ranger` → `lf` → `sh`, WS3 `vim` → `vi`, WS4 `htop` → `top`, WS5 runtime log and metrics.
- L/R switch workspace, L1/R1 send PageUp/PageDown, Up/Down send arrow keys, A sends Enter, B sends Esc and returns to WS1, START cycles, SELECT opens a command prompt on WS1.
- Switching calls `ACTIVATE` and never restarts a child: PTY, terminal buffer and cursor all persist.
- Text input goes through PocketJS `input.text` when the platform provides it; this H700 profile exposes buttons only, so on-device typing still needs an on-screen keyboard.

## WS5 telemetry

The log workspace shows FPS, frame time in ms, cells rendered, runs rendered, buffer size, resize count, workspace count, visible workspace, uptime, and the event stream:

`Workspace Created`, `Workspace Activated`, `PTY Started`, `PTY Exited`, `PTY Start Failed`, `Resize Events`, plus parser/renderer faults reported by the host.

## Build and run

The ROCKNIX H700 recipe compiles `hello/main.tsx` into `boot.pocket`, runs `patch-runtime.py` to copy in the terminal module and wire the two QuickJS globals, then builds `pocket-linux-kms`.

```sh
bun tools/pocket.ts compile --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
  --target rocknix-h700-kms --manifest apps/rocknix-h700/pocket.json --output generated/boot.pocket
```

## Test results (host, pinned PocketJS `e677037`)

- 18 Rust tests pass: plain text/CR, cursor positioning, `ESC[2J`, backspace, colours, bold+inverse, erase line/display, scroll regions with a pinned status line, alternate screen restore, insert/delete line, UTF-8 split across reads, dirty-row runs, cursor visibility and save/restore.
- Real programs: `top` renders through the VT layer (header/`%CPU` present in dirty rows), `vim` enters the alternate screen.
- Host PTY tests: WS1 echoes `echo pocketshell-ok`; `cd /tmp` survives a switch to WS2 and back; `exit` is logged as `PTY Exited WS1`; WS5 reports metrics and events.
- `cargo build --release -p pocket-linux-kms` and `pocket compile` both succeed without warnings from PocketShell code; the built runtime loads `boot.pocket` and completes 300 headless ticks at 720×480.

Host results are not hardware acceptance: no RG34XX display, button or boot test has run.

## RG34XX verification procedure

1. Build the H700 DDR4 image and flash per `AGENTS.md` (DDR4 artifact, `dtb.img` present, bootloader untouched).
2. Boot to PocketJS; confirm the header shows `WS1:SHELL` and the panel is not clipped at 648×384.
3. WS1: `pwd`, `ls`, `echo pocketshell` — text, wrapping and cursor position match a desktop terminal at 54×24.
4. WS4: `top` — header and task rows update, CPU percentages change, no smear from partial redraws.
5. WS3: open a file in `vim`, move with arrows, `i` insert, `Esc`, `:wq` — alternate screen restores the previous WS1 content.
6. WS2: `ranger` directory navigation and selection highlight (inverse) render correctly.
7. Switch WS1↔WS3 repeatedly and confirm `pwd` and vim buffer state survive; no process restart in the WS5 log.
8. WS5: FPS stays near the panel refresh rate, frame time stays low, and `Resize Events`/`PTY Exited` appear as expected.
9. Record the board revision, image hash, and any glitch (colour, wide-glyph, cursor) before closing the issue.

## Future workspace kinds (design only)

A `Workspace` becomes a trait with a common contract: `activate`, `deactivate`, `input`, `render`, `telemetry`.

- `PtyWorkspace` — current model: PTY + child process + `Terminal`.
- `NativePocketJsWorkspace` — a PocketJS app (Music, Store, Agent, Files) mounted as a child surface with its own focus and lifecycle.

The switcher keeps a single `Vec<Box<dyn Workspace>>` and addresses workspaces by ID, so adding SSH, tmux, Docker or an agent workspace requires a new implementation and a registration entry, not a change to the navigation layer. Input routing and the WS5 log stay shared.
