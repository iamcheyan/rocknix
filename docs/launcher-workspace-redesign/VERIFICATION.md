# CPR95 Launcher Redesign — Verification Record

Branch: `feature/launcher-workspace-redesign`  
Base: `origin/main` at `30c39d01a4ae988149d09f7281f5c3f2e647666d`

## Completed

- Added the design brief in `DESIGN.md` with layout, interaction flow, focus states, animation plan, PocketJS component tree, refactor steps, and old/new comparison.
- Added Japanese/Chinese/English workspace metadata and launcher labels, default locale `ja`, a language setting action, and a native launcher preference read/write command.
- Rebuilt the boot app using the pinned PocketJS revision on HX90.

## Checks performed

- `bun tools/pocket.ts check --runtime-config programs/rocknix-h700/pocket.runtime-config.ts --target rocknix-h700-kms --manifest apps/rocknix-h700/pocket.json` — passed (TypeScript, manifest, capability checks).
- Matching `bun tools/pocket.ts compile ... --output /tmp/cpr95-launcher-redesign/boot.pocket` — passed.
- Official PocketJS WASM host was built on HX90 after installing `wasm32-unknown-unknown` for the already installed Rust 1.98.1 toolchain.
- Host rendering produced nonempty PNGs at 720×480 and 1280×720. The scripted input run did not successfully verify expected launcher navigation, language persistence, or SELECT/START behavior; screenshots are not accepted as visual evidence until inspected.

## Incomplete acceptance

- Workspace navigation still requires correction and successful end-to-end key validation. A smoke run showed the app-list/session path receiving keys when Launcher workspace navigation was expected.
- Animation is not implemented; compiler output reports zero baked timelines.
- Uniform pixel treatment for all settings/list glyphs and locale coverage for every visible Launcher string are not verified.
- The Rust bridge preference command has not been compiled/exercised independently; restart persistence is unverified.
- Physical RG34XX behavior, display clipping, and screenshots have not been verified.
- Do not commit or push until these items pass. Issue #95 remains OPEN; no merge or issue closure was performed.
