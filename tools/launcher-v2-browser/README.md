# Launcher V2 browser verification (headless Chromium)

Confirms the compiled launcher bundle renders at exactly 360×240 logical scaled by
an integer 2× in a real Chromium, with no console errors, no page errors and no
failed requests — the check the WASM frame capture cannot make, because the
browser adds its own rasterisation path.

## What it proves

| Claim | How |
|---|---|
| Canvas is 360×240 logical, 2× on screen | The canvas backing store stays `360×240`; CSS box is `720×480` via `transform: scale(2)` with `image-rendering: pixelated`. No fractional scale factor is involved. |
| Screenshots are 720×480 | The driver clips the capture to the stage element and asserts the box. |
| No console/page errors | `console` (type `error`), `pageerror` and `requestfailed` are all collected; any entry fails the run. |
| Every screen actually differs | Screenshot SHA-256s are compared; identical frames across screens fail the run. |

## Layout expected under `$HARNESS`

```
index.html            this directory
host.js               this directory
server.ts             this directory
platforms/web/*       from <pocketjs-tree>/platforms/web (wasm-ops.js, pocketjs.wasm, ...)
engine/guest-web/src/ from <pocketjs-tree>/engine/guest-web/src (generated-ui.js, ui-descriptors.js)
dist/                 compiled rocknix-pocketjs-boot.{js,pak}
```

## Run

```sh
# 1. assemble the harness
HARNESS=/tmp/launcher-v2-browser
POCKETJS=<pinned pocketjs tree>
mkdir -p "$HARNESS"/{platforms/web,engine/guest-web/src,dist}
cp tools/launcher-v2-browser/{index.html,host.js,server.ts} "$HARNESS"/
cp "$POCKETJS"/platforms/web/*.js "$POCKETJS"/platforms/web/*.wasm "$HARNESS"/platforms/web/
cp "$POCKETJS"/engine/guest-web/src/{generated-ui.js,ui-descriptors.js} "$HARNESS"/engine/guest-web/src/
cp "$POCKETJS"/apps/rocknix-h700/dist/rocknix-pocketjs-boot.{js,pak} "$HARNESS"/dist/

# 2. serve it
(cd "$HARNESS" && bun server.ts) &      # http://127.0.0.1:8199

# 3. drive Chromium
CHROME=/run/current-system/sw/bin/chromium \
PLAYWRIGHT=/path/to/playwright-core \
HARNESS="$HARNESS" bun tools/launcher-v2-browser/drive.mjs docs/evidence/launcher-v2/browser
```

`drive.mjs` reads `CHROME`, `PLAYWRIGHT` and the base URL from the environment so
no path is baked into the repo.

## Notes

- The bridge is installed **before** the bundle is evaluated (`globalThis.ui`
  plus `__launcher`/`__pocketshell`), matching the Rust host's order. Installing
  it after evaluation silently yields a mount with no data — screens then render
  but every variant looks identical, which is why the driver compares hashes.
- `tick()` is only valid on the harness-mount path (`ui.ops` + `__pak` + plain
  `eval`), not after `ui.boot()`; the latter raises `Pocket Runtime: InvalidState`.
- A missing `favicon.ico` is the browser's own request and is filtered by
  message location, not by text.
