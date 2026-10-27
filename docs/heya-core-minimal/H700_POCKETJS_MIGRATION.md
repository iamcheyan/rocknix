# H700 PocketJS KMS migration

Branch: `feat/h700-pocketjs-kms`, based on `main` at `44529c238f`.
The canonical checkout has another active writer; this task uses a dedicated worktree.

Status: implementation and build verification in progress.

## Scope

RG34XX DDR4 boots PocketJS on DRM/KMS with a 720x480 software-rendered profile.
H700 has no Wayland compositor or client stack. Other devices keep their existing
display choices. Kernel, device tree and mkimage scripts are outside this change.

The initial PocketJS app reports input events. It does not yet implement heya's
application catalog or system settings. `pocket-session-run COMMAND [ARG...]`
provides an explicit display handoff to native KMS apps from SSH, and restores
PocketJS after that app exits. A full launcher migration needs system-service
interfaces that the upstream KMS program does not currently compose.

## Build contract

- PocketJS source: upstream revision `e6770376626a4de5c93eaa6fb048e7e9ffb81f9f`,
  archive SHA-256 `8b33c1f710323f384ecef63a85fae9a329aac11c7d8747d99c01bbdb538d2a87`.
- Bun 1.4.4 is a pinned host-only package. JS packages use upstream `bun.lock`
  with `--frozen-lockfile --ignore-scripts`.
- The host build exports the device profile and compiles the default `.pocket`
  app. The target build uses ROCKNIX's Rust/C cross toolchain and that export.
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
- Produce the DDR4 `.img.gz` and upgrade `.tar`, recording their source commit
  and SHA-256. Do not overwrite the build host's dirty checkout.
- On RG34XX: cold boot, visible first frame/orientation, controller navigation,
  native app handoff/exit, suspend/resume and recovery. Hardware results must be
  recorded separately from host/headless checks.

No hardware verification or completed image build is claimed by this record.
