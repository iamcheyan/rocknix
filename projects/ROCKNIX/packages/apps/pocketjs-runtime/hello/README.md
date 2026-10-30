# PocketShell Launcher V2 (boot app)

The handheld home screen for the RG34XX: 360×240 logical pixels presented at an
exact 2x to the 720×480 panel. Nintendo Switch information architecture — a 12 px
status bar, one horizontal content flow, a persistent bottom navigation — on a
pixel-art visual language.

Design source of truth: issue #92 (information architecture) and issue #93 (single
icon language). The audit, conflict resolution and acceptance record live in
`docs/launcher-v2/`.

## Layout

```
┌──────────────────────────────────────────────────────────────┐
│ 📶 192.168.3.57      ‹ ゲーム ›        ADB BT 🔊 🔋           │  12 px status bar
├──────────────────────────────────────────────────────────────┤
│    ┌────┐   ┌────┐   ┌────┐   ┌────┐                        │
│    │ 🎮 │   │ 🎮 │   │ 🎮 │   │ 📁 │   one horizontal row    │
│    │name│   │name│   │name│   │name│   of icon + name cards  │
│    └────┘   └────┘   └────┘   └────┘                        │
│    🎮  Metroid Fusion                                        │
├──────────────────────────────────────────────────────────────┤
│  すべて   メディア   ゲーム   お気に入り   設定               │  28 px nav, always on
└──────────────────────────────────────────────────────────────┘
```

## Modules

| File | Role |
|---|---|
| `main.tsx` | Shell: category state, selection, overlays, input dispatch, view composition |
| `status-bar.tsx` | 12 px bar: network/IP, `<分類>`, ADB/BT/volume/battery |
| `bottom-nav.tsx` | Persistent five-category navigation |
| `content-flow.tsx` | The horizontal card strip and the focused-item title |
| `overlay.tsx` | X (search) and Y (recent) panels |
| `settings-page.tsx` | 設定 category: group row + horizontal value tiles |
| `terminal-workspace.tsx` | The PTY terminal (5 workspaces, input workspace) — unchanged from pre-V2 |
| `icon.tsx` + `icons/registry.generated.ts` | The only icon renderer and its bitmaps |
| `model.ts` | Content items, category filtering, live search, recents |
| `bridge.ts` | `ui.__launcher` / `ui.__pocketshell` access and persisted preferences |
| `theme.ts`, `strings.ts`, `text-fit.ts` | Tokens, Japanese strings, pixel-grid text fitting |
| `library.tsx` | Separate Library reader app (own package, unaffected) |

## Icon pipeline

Pixelarticons (MIT) are vendored as SVG under `icons/pixelarticons/svg/`. Run

```sh
python3 tools/build-icons.py
```

after changing the icon set. It rasterizes each SVG on the 24×24 grid, derives the
exact 12×12 half for the status bar, and writes `icons/registry.generated.ts`.
Nothing outside that registry can be drawn: `Icon` rejects any size other than 12
or 24, so no icon is ever resampled.

## Fonts

`fonts.json` bakes Tamzen 6x12 as the body face, with Terminus, Fusion Pixel 12px
JA and GNU Unifont as per-glyph fallbacks. Japanese therefore resolves through
Fusion Pixel while ASCII uses Tamzen. Nerd Font is *not* used for UI icons
(issue #93); it stays available for terminal text only.

## Input

| Pad | Home | 設定 |
|---|---|---|
| D-pad ←/→ | move selection | adjust the focused value |
| D-pad ↑/↓ | — | previous / next setting group |
| A (CIRCLE) | open | apply |
| B (CROSS) | previous category / close overlay | previous category |
| L1 / R1 | previous / next category | previous / next category |
| X (SQUARE) | search | search |
| Y (TRIANGLE) | recent | recent |
| START | open the terminal | open the terminal |
| SELECT | toggle favorite | — |

## Build

`package.mk` copies this directory into the pinned PocketJS tree, then runs
`tools/pocket.ts check` and `compile` against `programs/rocknix-h700`. Pass the
font faces through `POCKETJS_FONT_REGULAR` / `_BOLD` / `_MONO` (see `package.mk`).

Frame capture for docs and regression:

```sh
bun tools/capture-launcher-v2-frames.ts <pocketjs-tree> docs/evidence/launcher-v2
```
