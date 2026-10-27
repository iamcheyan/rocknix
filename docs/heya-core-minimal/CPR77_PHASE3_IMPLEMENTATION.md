# CPR77 Phase 3 implementation log

Status: partial PoC; hardware launch and release image acceptance blocked.

## Source and upstream behavior

Base `origin/feature/pocketjs-runtime`: `1396a0594b885b6d92a37738d046de063b63aef3`, equal to the remote branch SHA fetched at task start. PocketJS upstream is `pocket-nexus/pocketjs` commit `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f` (exact). The repo is a Rust workspace pinned by `Cargo.lock`/`rust-toolchain.toml` (1.98.1). Linux program: `programs/linux-kms`, crates `pocket-runtime`, `pocket-guest-rquickjs`, `pocket-raster`, `pocket-package`, `pocket-linux-drm`, `pocket-linux-fbdev`, `pocket-linux-evdev`. `pocket.runtime-config.ts` declares Linux ARM64/x64; profile is a compile-time Rust module, exported by `bun tools/pocket.ts profile export --config programs/linux-kms/pocket.runtime-config.ts --out DIR`. CLI runtime build documented upstream is `bun tools/pocket.ts build --config ... --out ...`; source-level Cargo build must set `POCKETJS_PROFILE_RS`.

There is no evidence of a release archive for this exact commit in the checked source; the upstream Buildroot adapter requires a release index, source archive size/SHA and vendor post-processing. Do not claim a reproducible release package from a mutable branch. ROCKNIX recipe currently pins commit URL but still needs an independently verified archive SHA before merge/build acceptance.

## Actual builds

- Native host: `POCKETJS_PROFILE_RS=<exported profile> cargo build --locked --release -p pocket-linux-kms` succeeded. ELF size 2.9 MiB.
- ARM64 cross compile: `RUSTFLAGS='-C linker=aarch64-linux-gnu-gcc' POCKETJS_PROFILE_RS=<exported profile> cargo build --locked --release --target aarch64-unknown-linux-gnu -p pocket-linux-kms` succeeded. `readelf`: 64-bit AArch64 PIE; dynamic dependencies `libgcc_s.so.1`, `libm.so.6`, `libc.so.6`. This is generic GNU cross compilation, not ROCKNIX sysroot/image integration.
- Direct ARM target build initially used host `cc` and failed with `--fix-cortex-a53-843419 is only supported on AArch64`; selecting installed cross-linker fixed it. Cargo target was installed locally.
- Bun was initially absent; `npm exec --yes --package=bun -- bun ...` supplied Bun 1.4.4. JS dependency install without legacy mode failed on an upstream Vue peer range conflict; `npm install --ignore-scripts --no-audit --no-fund --package-lock=false --legacy-peer-deps` installed 260 packages.
- Profile export succeeded and generated `pocket_profile.rs`, `.json`, `.h`. A generic upstream ARM host build is real; recipe build with ROCKNIX's exact compiler/sysroot is not yet performed.

## Package and storage design

New package: `projects/ROCKNIX/packages/apps/pocketjs-runtime/`. Intended installs: `/usr/bin/pocket`, `/usr/libexec/pocket-linux-kms`, `/usr/libexec/pocketjs-session`, systemd unit and app `.pocket` under `/usr/share/pocketjs/apps/`. Runtime has no separate framework runtime asset directory: the profile is compiled in; default app path is only a convenience. App package and mutable state belong on `/storage/pocketjs/apps`, `data`, `cache`, `logs`; session helper creates these directories. App content/data/cache/logs are writable persistent state; binary, profile metadata, licenses and packaged system apps are immutable rootfs assets.

Important current limitation: the `.pocket` artifact is NOT generated. Upstream `pocket check/compile` fails for the custom Linux profile because `tools/pocket.ts` calls `checkAppTypes` with no external-app tsconfig; diagnostics say it cannot resolve `@pocketjs/framework/solid`, `/solid/components`, and `/input`. `checkProjectTypes` in the same upstream compiler resolves these aliases and the Hello TSX typechecks with no diagnostics, but the public CLI does not call it. No third-party code was altered to bypass that failure. Package recipe therefore is an integration draft, not yet buildable end-to-end; image must not ship an ELF renamed as an app package.

## KMS and input source evidence

`platforms/linux/drm/src/native.rs`: opens selected DRM card; fetches resources/connectors, requires connector state `Connected`, selects a mode matching compiled profile physical dimensions, obtains encoder/CRTC, creates dumb buffer and DRM framebuffer, sets CRTC, page-flips; teardown restores old CRTC/framebuffer and destroys framebuffer. DRM open requests master, so a live Sway DRM master prevents exclusive KMS use. Program main attempts DRM first, then fbdev; `--card`, `--fb`, repeated `--input` are supported. Default input discovery enumerates `/dev/input/event*`; `platforms/linux/evdev` opens event fds and decodes events. `/dev/fb0` is only the fbdev fallback. `--headless --frames 3` is a diagnostic path, not a hardware fallback.

On this Debian builder, `/dev/dri/card0` and multiple `/dev/input/event*` nodes exist, but they do not identify the target device. H700's physical resolution/mode, button mapping, permissions and hardware scanout have not been tested. Sway-master failure is supported by DRM master semantics in source, not measured on H700.

## Launch chain

Current H700 quirk `projects/ROCKNIX/packages/hardware/quirks/platforms/H700/090-ui_service` writes `UI_SERVICE="sway.service heya.service"`. `autostart` starts `${UI_SERVICE}`; `heya.service` requires/starts after `sway.service` and sets Wayland environment. Sway is a `graphical.target` service with `Restart=always` and `WLR_BACKENDS=drm,libinput`. Proposed foreground transition helper stops heya and Sway, runs KMS in foreground, then unit post/stop actions restart Sway; this requires lifecycle testing before using it. Current systemd unit's `WantedBy=rocknix.target` is not sufficient to make PocketJS the UI: H700 `UI_SERVICE` must be changed to `pocketjs-kms.service` and the app launcher must choose a valid app. Main UI migration is NOT complete.

## Sway/Wayland package graph evidence

H700 options set `DISPLAYSERVER="wl"`, `WINDOWMANAGER="swaywm-env"`, `MINI_DISTRO="yes"`, `EMULATION_DEVICE="no"`. `virtual/image/package.mk` unconditionally includes `mako-osd`; MINI sets multimedia to mpv, which enables Wayland in `multimedia/mpv/package.mk` when DISPLAYSERVER is `wl`. Other concrete Wayland-conditioned package edges: GStreamer base → Wayland/protocols; SDL2/SDL3 → Wayland; `virtual/swaywm-env` → sway/wlr-randr/swayimg/rocknix-screenshot; Sway → wlroots and Wayland; `gamesupport` conditionally adds touchscreen keyboard; emulators choose foot command and many standalone/libretro recipes add Wayland/window-manager dependencies. Therefore removing just the `swaywm-env` virtual package does not remove Wayland from the graph. No broad removal was applied because a full H700 emulation graph and option-load-order build simulation are still required; no rootfs size/RAM comparison is available.

## Verification matrix

| Criterion | State | Evidence / next step |
|---|---|---|
| Exact upstream source | PASS | Checkout exact commit; inspected workspace and KMS source |
| Native runtime build | PASS | Cargo release host build, 2.9 MiB |
| Generic AArch64 cross-link | PASS | AArch64 PIE ELF, libc/libm/libgcc_s |
| ROCKNIX recipe build/rootfs inclusion | BLOCKED | No exact ROCKNIX sysroot build or image run; upstream CLI app packaging bug blocks `.pocket` asset |
| Hello `.pocket` build | BLOCKED | Public CLI typecheck path fails aliases; standalone `checkProjectTypes` succeeds |
| Hello launch/display/buttons/exit/return | NOT TESTED | No H700 device; need valid `.pocket` and device |
| KMS source path | PASS (source only) | Connector/mode/dumb-buffer/master/pageflip/restore inspected |
| H700 KMS operation | NOT TESTED | Requires H700 and DRM master access |
| Main UI boot chain | NOT COMPLETE | H700 UI_SERVICE remains sway+heya |
| Sway/Wayland removal | NOT COMPLETE | Edges enumerated; package graph rebuild and per-dependency fixes remain |
| Image size/RAM delta | NOT MEASURED | No target image/rootfs or device RSS |

No image or RAM estimates are fabricated. Package installation, app package validation and H700 real-device steps are follow-up gates.
