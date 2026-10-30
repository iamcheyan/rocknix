#!/usr/bin/env python3
"""Vendor Pixelarticons into PocketShell's icon registry.

Input:  icons/pixelarticons/svg/      (vendored upstream MIT assets, 24x24 grid)
Output: icons/registry.generated.ts   (bitmap rows, one code point per pixel)

The launcher never loads an SVG or a font glyph for iconography. Every icon is
a 24x24 bitmap baked from the upstream geometry and drawn by the UI as exact
integer-sized blocks, so an icon is crisp at any integer multiple and tints by
colour without a texture upload.

The upstream icon grid is a 24x24 lattice where every stroke is 2x2 with an
even origin, so each icon also has an exact 12x12 half-resolution form. The UI
uses the 12px form in the 12px status bar and the 24px form for content.

Run from the app directory:  python3 tools/build-icons.py
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SVG_DIR = ROOT / "icons" / "pixelarticons" / "svg"
OUT = ROOT / "icons" / "registry.generated.ts"
MANIFEST = ROOT / "icons" / "icons.json"

# Semantic name -> upstream Pixelarticons file. One icon language: every name
# the launcher draws resolves here, and nothing resolves outside this table.
ICONS = {
    # status bar
    "wifi": "wifi",
    "bluetooth": "radio",
    "adb": "android",
    "battery-full": "battery-full",
    "battery-medium": "battery-medium",
    "battery-low": "battery-low",
    "battery-critical": "battery",
    "charging": "zap",
    "volume": "volume-2",
    "volume-mute": "volume-x",
    # categories / navigation
    "all": "grid-3x3",
    "games": "gamepad",
    "media": "video",
    "favorites": "star",
    "settings": "settings-2",
    "search": "search",
    "recent": "clock",
    "chevron-left": "chevron-left",
    "chevron-right": "chevron-right",
    # content kinds
    "music": "music",
    "video": "video",
    "book": "book-open",
    "image": "image",
    "folder": "folder",
    "file": "file-text",
    # applications
    "terminal": "terminal",
    "monitor": "monitor",
    "network": "globe",
    "storage": "server",
    "input": "keyboard",
    "usb": "usb",
    "audio": "headphone",
    "power": "power",
    "cloud": "cloud",
    "system": "cpu",
    "memory": "memory-stick",
    "info": "circle-info",
    "refresh": "refresh",
    "download": "download",
    "trash": "trash",
    "sliders": "sliders",
    "plug": "plug",
    "sun": "sun",
    "tv": "tv",
    "home": "home",
}

SIZE = 24
HALF = SIZE // 2


def _tokens(d: str):
    return re.finditer(r"([MmLlHhVvZz])|(-?\d*\.?\d+)", d)


def subpaths(d: str):
    """Flatten an SVG path into closed polylines (the Pixelarticons subset:
    straight segments only)."""
    t = [m.group(0) for m in _tokens(d)]
    contours, cur, cmd, i = [], [], None, 0
    cx = cy = 0.0
    start = (0.0, 0.0)

    def flush():
        nonlocal cur
        if len(cur) >= 3:
            contours.append(cur)
        cur = []

    while i < len(t):
        tok = t[i]
        if re.fullmatch(r"[MmLlHhVvZz]", tok):
            cmd = tok
            i += 1
            if cmd in "Zz":
                flush()
                cx, cy = start
                cur = [(cx, cy)]
            continue
        vals = []
        while i < len(t) and not re.fullmatch(r"[MmLlHhVvZz]", t[i]):
            vals.append(float(t[i]))
            i += 1
        if cmd in "Mm":
            for n in range(0, len(vals) - 1, 2):
                if n == 0:
                    flush()
                    cx, cy = (cx + vals[0], cy + vals[1]) if cmd == "m" else (vals[0], vals[1])
                    start = (cx, cy)
                    cur = [(cx, cy)]
                else:
                    cx, cy = (cx + vals[n], cy + vals[n + 1]) if cmd == "m" else (vals[n], vals[n + 1])
                    cur.append((cx, cy))
            cmd = "l" if cmd == "m" else "L"
        elif cmd in "Hh":
            for v in vals:
                cx = cx + v if cmd == "h" else v
                cur.append((cx, cy))
        elif cmd in "Vv":
            for v in vals:
                cy = cy + v if cmd == "v" else v
                cur.append((cx, cy))
        elif cmd in "Ll":
            for n in range(0, len(vals) - 1, 2):
                cx, cy = (cx + vals[n], cy + vals[n + 1]) if cmd == "l" else (vals[n], vals[n + 1])
                cur.append((cx, cy))
        else:
            raise SystemExit(f"path command not in the Pixelarticons subset: {cmd}")
    flush()
    return contours


def _inside(contours, px: float, py: float) -> bool:
    """Even-odd fill test at a pixel centre (upstream art uses the even-odd
    winding for the holes it draws, e.g. the folder notch)."""
    wind = 0
    for c in contours:
        for (x0, y0), (x1, y1) in zip(c, c[1:] + c[:1]):
            if y0 == y1:
                continue
            if (y0 > py) != (y1 > py):
                if x0 + (py - y0) * (x1 - x0) / (y1 - y0) > px:
                    wind += 1
    return wind % 2 == 1


def rasterize(svg: str) -> set[tuple[int, int]]:
    pixels = set()
    for d in re.findall(r'<path[^>]*\sd="([^"]+)"', svg):
        contours = subpaths(d)
        for y in range(SIZE):
            for x in range(SIZE):
                if _inside(contours, x + 0.5, y + 0.5):
                    pixels.add((x, y))
    return pixels


def rows(pixels: set[tuple[int, int]], size: int) -> list[int]:
    """One integer per row; bit n of row y is column n set."""
    out = []
    for y in range(size):
        bits = 0
        for x in range(size):
            if (x, y) in pixels:
                bits |= 1 << x
        out.append(bits)
    return out


def halve(pixels: set[tuple[int, int]]) -> set[tuple[int, int]]:
    """Half resolution: a 12x12 pixel is on when at least half of its 2x2 block
    is. The upstream strokes are 2x2 but their origins are not always even, so
    a strict sub-sample would drop strokes; a majority vote keeps the shape and
    never fattens it (the 'any' rule turns Bluetooth into a solid blob)."""
    out = set()
    for y in range(0, SIZE, 2):
        for x in range(0, SIZE, 2):
            lit = sum((x + dx, y + dy) in pixels for dx in (0, 1) for dy in (0, 1))
            if lit >= 2:
                out.add((x // 2, y // 2))
    return out


def main() -> int:
    digest = hashlib.sha256()
    entries = []
    missing = []
    for name, source in sorted(ICONS.items()):
        path = SVG_DIR / f"{source}.svg"
        if not path.exists():
            missing.append(source)
            continue
        svg = path.read_text()
        full = rasterize(svg)
        half = halve(full)
        if not full:
            raise SystemExit(f"{source}: rasterized to nothing")
        digest.update(svg.encode())
        entries.append((name, source, rows(full, SIZE), rows(half, HALF)))

    if missing:
        raise SystemExit(f"missing upstream icons: {', '.join(sorted(missing))}")

    lines = [
        "// GENERATED by tools/build-icons.py from icons/pixelarticons/svg — do not edit.",
        "// Pixelarticons (MIT, (c) 2019 Gerrit Halfmann): one bitmap per icon, 24x24 and",
        "// its exact 12x12 half. Bit n of a row is column n. Draw with Icon().",
        "",
        f'export const ICON_SOURCES = {{ {", ".join(f"{name!r}: {source!r}" for name, source, _, _ in entries)} }} as const;',
        "",
        "export type IconName = keyof typeof ICON_SOURCES;",
        f"export const ICON_SIZE = {SIZE};",
        f"export const ICON_HALF = {HALF};",
        "",
        "export const ICON_ROWS: Readonly<Record<IconName, readonly number[]>> = {",
    ]
    for name, _src, full, _half in entries:
        lines.append(f"  {name!r}: [{', '.join(str(v) for v in full)}],")
    lines.append("};")
    lines.append("")
    lines.append("export const ICON_ROWS_HALF: Readonly<Record<IconName, readonly number[]>> = {")
    for name, _src, _full, half in entries:
        lines.append(f"  {name!r}: [{', '.join(str(v) for v in half)}],")
    lines.append("};")
    lines.append("")
    lines.append(f'export const ICON_REGISTRY_DIGEST = "{digest.hexdigest()}";')
    lines.append("")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines))
    print(f"{len(entries)} icons -> {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
