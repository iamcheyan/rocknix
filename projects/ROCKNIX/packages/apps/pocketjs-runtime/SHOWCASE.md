# PocketJS Capability Explorer

Pinned baseline: PocketJS `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f` (`package.mk`). The app targets the H700 compile-time profile: 720×480, 60 Hz tick, raster density 1, Linux embedded form, `input.buttons` and `text.glyphs.baked` capabilities.

## Pages and navigation

| Page | Live demonstration | Evidence boundary |
|---|---|---|
| Home | Profile facts, controller instructions, app-owned FPS overlay | Profile facts are compile-time; overlay samples browser host intervals |
| Layout | Flex row/column, alignment, gap, padding, border, radius, clipping | PocketJS native style/core features |
| Focus | Focusable mirror nodes, focus path and event text | `getFocused()` + app mirror traversal; no focus-change callback API |
| Animation | opacity, scale, translateX, bgColor tweens | `animate()` native core animation, fixed 60 Hz profile tick |
| List | 100/1,000/5,000/10,000 logical rows | Official `VirtualList`; mounted window bounded by viewport plus overscan |
| Input | D-pad, face buttons, shoulders, ZL/ZR, START/SELECT and chords | H700 evdev mapping implementation; release/hold observed from frame masks, repeat synthesized by app if implemented |
| Rendering | gradients, border, radius, shadow, stress elements; Image gap | CPU raster is host-selected; H700 profile does not declare image capability and contains no image asset |
| Gallery | every public component export, native modal, component patterns | 18 exports from `framework/src/components.ts` plus `VirtualList`; unsupported product-style names listed below |
| Performance | wall-clock FPS/frame-time windows; generated and visible row counts | Browser preview measurement only; no claim of KMS/device timing or native memory |
| Diagnostics | pinned revision/profile/scale and explicit N/A fields | Source references follow below; no guest query for host backend/build/memory |

Navigation: D-pad moves selected entry, CROSS opens/activates, CIRCLE returns home, LEFT/RIGHT changes page. SELECT toggles the app-drawn FPS panel. START asks the preview host for a screenshot. START+SELECT toggles recording. Button names are the PocketJS semantic constants; Linux evdev aliases L/R to LTRIGGER/RTRIGGER and maps ZL/ZR separately.

## Capability matrix

| Capability | Status in pinned source | Exact reference |
|---|---|---|
| `View`, `Text`, `Image`, `Sprite`, `CompositorSurface` | Exported primitives | `framework/src/components.ts:41-52`; `framework/src/primitives.ts:12-148` |
| `Screen`, `Focusable`, `FocusScope`, `FocusGrid`, `ActionHandler`, `AxisHandler`, `MotionHandler`, `Named`, `For`, `Portal`, `AuxiliarySurface`, `AuxiliaryPortal`, `Modal`, `ActionBar`, `Grid`, `Lazy`, `Gallery` | Exported Solid helpers | `framework/src/components.ts` |
| `VirtualList` | Exported bounded-window list with focus retention, scroll and row callbacks | `framework/src/virtual-list.ts:1-95,110-151` |
| Focus traversal | Document order; FocusGrid overrides; CIRCLE invokes focused onPress | `framework/src/input.ts:1-20,109-180` |
| Focus observation | `getFocused()` returns mirror node or null; app can traverse `NodeMirror.parent/children/debugName` | `framework/src/input-api.ts:8-24`; `framework/src/native-tree.ts:9-32` |
| Controller callbacks | `onButtonPress` invokes rising edge only; `onFrame(buttons)` receives held masks | `framework/src/frame.ts:132-179`; `framework/src/lifecycle.ts:3-20` |
| Text callback detail | key down/up, commit, composition; key has pressed/repeat fields | `contracts/spec/input.ts`; `framework/src/text-input.ts` |
| Animation | native `animate`, spring; opacity/colors/transforms and baked class transitions | `framework/src/anim.ts:1-113`; `docs/DESIGN.md:344-413` |
| Flex/layout/render styles | flex, spacing, gradients, radius, border, shadows, text, transforms, clipping | `docs/DESIGN.md:344-413`; `framework/compiler/tailwind.ts` |
| Image and sprites | API exists, but H700 selected profile does not declare image capability | `framework/src/primitives.ts:51-77`; `config/profile.ts:14` |
| Display backend | Linux program chooses `RasterRenderer`, then DRM/KMS or fbdev output | upstream `programs/linux-kms/src/main.rs:158-208` |
| App-visible FPS/frame time | Not exposed; preview measures browser RAF host intervals | upstream `framework/src/host.ts`; `programs/linux-kms/src/main.rs:250-263` |
| Memory/RSS | Not exposed to guest | upstream `framework/src/host.ts`; `programs/linux-kms/src/main.rs` |
| Native tree counts | No core query in Linux host bindings; app mirror counts are distinguishable and incomplete | upstream `framework/src/native-tree.ts:9-32`; `framework/src/host.ts` |
| Screenshot and filesystem path | No Linux KMS guest screenshot/filesystem binding | upstream `framework/src/host.ts`; KMS `main.rs` |
| Device clock/version/build identity | No guest API | `framework/src/host.ts`; pinned build recipe |

## Component coverage

Available component exports in the selected Solid barrel: **23/23 demonstrated or listed** — `View`, `Text`, `Image`, `Sprite`, `CompositorSurface`, `DeepZoom`, `Screen`, `Focusable`, `Named`, `FocusScope`, `FocusGrid`, `ActionHandler`, `AxisHandler`, `MotionHandler`, `For`, `Portal`, `AuxiliarySurface`, `AuxiliaryPortal`, `Modal`, `ActionBar`, `Grid`, `Lazy`, `Gallery` (verified by enumeration of `framework/src/components.ts` at the pin) — plus the separate official `VirtualList` module, demonstrated with 100/1,000/5,000/10,000-row datasets where the 10,000 case mounts only a 13-row window.

`Button`, `Card`, `Progress`, `Tabs`, `Dialog`, `Overlay`, and `ScrollView` are not exported component symbols at this revision. The explorer demonstrates button/card-like patterns with `View` and `Text`, tabs via app page state, dialogs through `Modal`, overlays through `Portal`, and scrolling through `VirtualList`/kinetics.
`showcase-model.ts` defines additive `pocketjs.explorer.snapshot.v1`: source revision, frame, page, focus ID/path, render size/scale/backend, metrics with nullable values, and recording state. Nullable measurements intentionally separate unsupported host instrumentation from zero-valued measurements. `serializeSnapshot()` validates version, non-negative safe frame and positive render geometry. `showcase-model.test.ts` checks round-trip JSON and invalid-boundary rejection. This is a local serialization contract test only; it does not implement or claim live integration with CPR #85 Remote Dev, whose existing API is terminal workspace state (`tools/pocketshell-dev/src/main.rs`).

## Measurement and screenshots

Pixel capture runs the compiled bundle in a private pinned-source worktree with the official Rust/WASM core and rasterizer (`hello/capture.ts`):

```sh
git worktree add --detach /tmp/pocketjs-showcase-e677037 e6770376626a4de5c93eaa6fb048e7e9ffb81f9f
cp -a projects/ROCKNIX/packages/apps/pocketjs-runtime/hello/. /tmp/pocketjs-showcase-e677037/apps/rocknix-showcase/
cp -a projects/ROCKNIX/packages/apps/pocketjs-runtime/config/. /tmp/pocketjs-showcase-e677037/programs/rocknix-h700/
cd /tmp/pocketjs-showcase-e677037 && bun install --frozen-lockfile --ignore-scripts
bun tools/pocket.ts compile --runtime-config programs/rocknix-h700/pocket.runtime-config.ts \
  --target rocknix-h700-kms --manifest apps/rocknix-showcase/pocket.json \
  --output apps/rocknix-showcase/showcase.pocket
bun tools/wasm.ts
bun apps/rocknix-showcase/capture.ts /tmp/pocketjs-showcase-shots
```

Captured pages: home, home-fps-overlay, layout, focus, animation, list, list-1000, list-5000, list-10000, input, rendering, gallery, performance, diagnostics (committed under `showcase/screenshots/`). All are `WasmUi.render()` output from the bundle that passes `pocket check` (66 modules) and KMS admission; list-1000/5000/10000 differ from list by pixel hash, and the 10,000-row case shows `ROWS 10000` with a 13-row mounted window.

Native runtime evidence (same scratch tree):

```sh
bun tools/pocket.ts profile export --config programs/rocknix-h700/pocket.runtime-config.ts --out programs/rocknix-h700/generated
POCKETJS_PROFILE_RS=programs/rocknix-h700/generated/pocket_profile.rs \
  cargo build --locked --release -p pocket-linux-kms --target x86_64-unknown-linux-gnu
./target/x86_64-unknown-linux-gnu/release/pocket-linux-kms \
  --package apps/rocknix-showcase/showcase.pocket --check
./target/x86_64-unknown-linux-gnu/release/pocket-linux-kms \
  --package apps/rocknix-showcase/showcase.pocket --headless --frames 300
```

Observed: `package admitted … (rocknix-h700-kms)` and `completed 300 logical ticks; 720x480; rocknix-h700-kms`. The headless mode verifies boot/tick/shutdown only; it exposes no pixels or controller input.

Browser RAF cadence is a browser measurement, not KMS or RG34XX performance. Serialization unit tests: `bun test apps/rocknix-showcase/showcase-model.test.ts` (2 pass). Physical RG34XX state: not tested in this task — no display, button, or boot verification was performed.
