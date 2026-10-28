#!/usr/bin/env python3
"""Let the PocketJS launcher build select its own text faces.

Upstream bakes the bundled Inter/JetBrains targets unless the build is given
`--font-regular`/`--font-bold` on the command line; `pocket compile` never
forwards those. The KoroOS launcher renders on a pixel grid, so it ships a
pixel font and points the three faces at it through the environment.
"""
from pathlib import Path
import sys

root = Path(sys.argv[1])
build = root / "tools/build.ts"
source = build.read_text()
if "POCKETJS_FONT_MONO" in source:
    raise SystemExit(0)

old = """let extraChars = "";
let regularFontPath: string | undefined;
let boldFontPath: string | undefined;"""
new = """let extraChars = "";
let regularFontPath: string | undefined = process.env.POCKETJS_FONT_REGULAR;
let boldFontPath: string | undefined = process.env.POCKETJS_FONT_BOLD;
let monoFontPath: string | undefined = process.env.POCKETJS_FONT_MONO;"""
if old not in source:
    raise SystemExit("PocketJS build font declarations not found")
source = source.replace(old, new, 1)

old = """  regularTtf: regularFontPath,
  boldTtf: boldFontPath,"""
new = """  regularTtf: regularFontPath,
  boldTtf: boldFontPath,
  monoTtf: monoFontPath,"""
if old not in source:
    raise SystemExit("PocketJS bakeAtlases call not found")
build.write_text(source.replace(old, new, 1))
