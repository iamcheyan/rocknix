# H700 PocketJS KMS migration

Branch: `feat/h700-pocketjs-kms`, based on `main` at `44529c238f`.
The canonical checkout has another active writer; this task uses a dedicated worktree.

Status: target package and complete HX90 image build verified. Physical RG34XX
acceptance remains pending.

## Scope

RG34XX DDR4 boots PocketJS on DRM/KMS with a 720x480 software-rendered profile.
H700 has no Wayland compositor or client stack. Other devices keep their existing
display choices. Kernel, device tree and mkimage scripts are outside this change.

The initial PocketJS app reports input events. It does not yet implement heya's
application catalog or system settings. `pocket-session-run COMMAND [ARG...]`
provides an explicit display handoff to native KMS apps from SSH, and restores
PocketJS after that app exits. A full launcher migration needs system-service
interfaces that the upstream KMS program does not currently compose.

Native commands for hardware acceptance include `pocket-session-run xmplayer`,
`pocket-session-run disk-browser`, and `pocket-session-run mpv /storage/videos/FILE`.
The native mpv configuration uses DRM/OpenGL instead of Vulkan. Heya is retained
as a manual SDL application, without a Wayland service or a foot terminal entry.
Nested native players launched from inside an already running SDL app still need
device testing; this change proves serialized ownership through the explicit
handoff helper, not arbitrary concurrent native windows.

## Build contract

- PocketJS source: upstream revision `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f`,
  archive SHA-256 `8b33c1f710323f384ecef63a85fae9a329aac11c7d8747d99c01bbdb538d2a87`.
- Bun 1.4.4 is a pinned host-only package. JS packages use upstream `bun.lock`
  with `--frozen-lockfile --ignore-scripts`.
- The host build exports the device profile and compiles the default `.pocket`
  app. The target build uses ROCKNIX's Rust/C cross toolchain and that export.
- The build directory selects only `programs/linux-kms` and its local Cargo
  dependencies. Lockfile pruning follows the mechanism in upstream
  `tools/packaging/esp-idf/vendor.ts`; every external dependency/version/checksum
  must remain a member of the original locked set before `cargo build --locked`.
  This avoids fetching the unrelated PSP/PocketBook SDK submodules.
- A build-only shim enables upstream rquickjs `bindgen` for ROCKNIX's custom
  target triple. It selects the exact locked rquickjs version and uses host
  libclang with the target sysroot; no pre-generated bindings are renamed and
  no upstream runtime/core source is patched.
- The immutable boot app is `/usr/share/pocketjs/apps/boot.pocket`. An optional
  `POCKETJS_APP` in `/storage/.config/pocketjs/runtime.conf` selects a user app;
  package admission failure returns to the immutable boot app.
- `POCKETJS_CARD` can select a DRM node. Otherwise the session selects a card
  with a connected connector. fbdev fallback is owned by upstream.
- The H700 quirk writes `UI_SERVICE=pocketjs-kms.service`. No service restarts
  Sway on normal exit or failure. The graphical session owns tty7, separate
  from normal getty terminals. Repeated boot failures expose a login console
  there through `pocketjs-recovery.service`.

## Acceptance

- Resolve the real H700 image build plan; reject Wayland/Sway dependencies.
- Compile the profile, boot app and AArch64 runtime with the ROCKNIX toolchain.
- Check the built rootfs for the boot app, runtime library closure, startup
  service and absence of Wayland/Sway binaries/libraries.
- Produced the DDR4 `.img.gz` and upgrade `.tar` from commit
  `996755c2049abb4abcd77f855ab54bf918daea89` in the isolated HX90 worktree.
  SHA-256: image `546279cebbb53644faf4706665b33be03cfb524433af4c375472d518495fee16`;
  upgrade tar `2319a0262eda4d468b2b0d36bf13ea4db867ae3a06a17c1e05bae729e5869b9c`.
  Both checksum files verify. Artifacts are under
  `~/development/.worktrees/rocknix-h700-pocketjs-kms-build/target/` on HX90.
- On RG34XX: cold boot, visible first frame/orientation, controller navigation,
  native app handoff/exit, suspend/resume and recovery. Hardware results must be
  recorded separately from host/headless checks.

The image build and rootfs checks below do not replace physical device
verification.

## Verification results

- Resolved H700 image plan: 286 steps on HX90, with PocketJS host/target stages
  and no Wayland/Sway dependency. RK3566 retains its Wayland/Sway plan (693 steps).
- Existing plus new Python tests: 14 passed. Lifecycle cases include rejected
  package fallback, failed native apps, argument/exit-status preservation,
  interruption, exclusive display ownership, and recovery-console restoration.
- Real pinned source: profile export, TypeScript check and `.pocket` compilation
  passed. No compiler style warning remains in the boot app.
- Native host runtime: package admission and five 720x480 headless ticks passed.
- ROCKNIX toolchain: AArch64 release runtime compiled with generated bindings and
  target sysroot headers. Its actual ELF plus ROCKNIX loader/libraries passed
  package admission and five 720x480 headless ticks under `qemu-aarch64`.
- Independent read-only review found no remaining concrete code defect after
  the binding and build fixes.
- HX90 full image build completed for `ROCKNIX-H700.aarch64-20261027-DDR4`.
  `check-mini-rootfs.py --frontend pocketjs` passed, including PocketJS runtime
  closure, agetty recovery entrypoint, and absence of Sway/Wayland files. The
  rebuilt mpv ELF has no X11, Xfixes or Wayland shared-library dependency.
- The image selects `sun50i-h700-anbernic-rg34xx.dtb`; the DDR3-only overlay is
  not selected. No RG34XX hardware boot or display test has been performed.

The remote canonical checkout has unrelated uncommitted work and a separate image
build. This task uses a remote Git worktree and its own copy of the build cache,
mounted at the original `/work` toolchain prefix. Sources are reused read-only in
meaning; outputs go to this task's worktree, not the canonical `target/`.

## Latest mainline integration check

The PocketJS migration was merged in a dedicated worktree based on main
`c96ffa107b40f9e913bdaa7c993f822eaf3ef4ef`; integration commit:
`530f52747ced0597b856f847eda616ed6fd21e59`. The H700 resolved image plan has
281 steps and passed `tools/check-pocketjs-plan.py` with no Wayland/Sway packages.
The existing `996755c2049abb4abcd77f855ab54bf918daea89` image rootfs passed
`tools/check-mini-rootfs.py --frontend pocketjs`. Its ARM64 runtime and Hello
package passed qemu package admission and five 720x480 headless ticks.

These checks do not constitute a new image build from integration commit
`530f52747c`, nor a physical RG34XX display/controller test. The existing image
and runtime artifacts predate the latest-main merge; rebuild from this commit
and test on the device before deploying it.
