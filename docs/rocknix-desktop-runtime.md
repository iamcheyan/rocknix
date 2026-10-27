# ROCKNIX desktop runtime

## Runtime contract

`./run-rocknix-desktop.sh` consumes an authentic, extracted ROCKNIX x86_64 image root at `.runtime/rootfs` by default. It never generates a substitute root filesystem. Set `ROCKNIX_ROOTFS` to use a root produced by an isolated official ROCKNIX build.

The container image is `FROM scratch` and copies that root tree. `/storage` is the only writable fixture bind mount; service fixtures are read-only at `/run/rocknix-mocks`. `/run`, `/tmp`, and `/var/log` use container tmpfs. No host home, credentials, ROMs, saves, or devices are mounted.

## GUI opt-in

The default is `ROCKNIX_GUI=none`: the isolated userspace container starts without host display sockets and does not launch an app.

- `ROCKNIX_GUI=x11 ./run-rocknix-desktop.sh` adds `docker-compose.x11.yml`, binds the host X11 socket directory read-only, forwards a temporary Xauthority cookie, and starts heya.
- `ROCKNIX_GUI=wayland ./run-rocknix-desktop.sh` adds only the selected Wayland socket through `docker-compose.wayland.yml`, then starts heya using the container's `/run/wayland-0` path.

No `xhost` access-control changes are made. SDL audio defaults to the dummy backend unless explicitly set.

## Automated report

Run `scripts/test-runtime.sh` with the container running to inspect the x86_64 RootFS, systemd heya-to-sway dependency, application discovery paths, dynamic library resolution and app launch outcomes. It writes `.runtime/report.txt`; failures and skips are nonzero and remain visible. It reports the bundled xmplayer Love binary's architecture and reports RetroArch absent when the official image did not install it.

## Authentic, mocked, and not reproduced

- **Authentic:** files copied directly from the official ROCKNIX AMD64 image's extracted `image/system` root. The build output and commit are recorded in the runtime report.
- **Mocked:** `/storage`, sample heya app/theme, empty ROM/save/media folders, and battery/network/storage status fixtures.
- **Host-integrated:** selected X11 or Wayland display socket only after explicit GUI opt-in; audio defaults to dummy.
- **Not reproduced:** H700 bootloader/kernel/device tree, Panfrost/H700 GPU behavior, handheld LCD/backlight, codec/DSP, physical buttons/controller, battery, temperature, suspend/resume, device performance.

The repository heya recipe normally sets `PKG_ARCH=aarch64` and `GOARCH=arm64`. The isolated build copy is adjusted to `PKG_ARCH=any` and selects Go architecture from the requested target so AMD64 heya can be compiled without altering the canonical checkout. This is a CPR71 desktop packaging change; it does not alter the H700 target. xmplayer's bundled Love, ffplay and helper are AArch64 ELF files, and no Love source package exists in the ROCKNIX package tree, so an AMD64 runtime cannot execute those files. That result is reported as an architecture blocker, not a successful xmplayer launch.

The repository does not currently produce official AMD64 binaries for heya and xmplayer. The desktop desktop runtime therefore reports architecture constraints as a known limitation; a future build or upstream patch would be required before successful x86_64 launches.

App results in `.runtime/report.txt` distinguish successful runtime behavior from absent package files, wrong-architecture ELF binaries, loader errors, and GUI-unavailable conditions. A successful image build alone is not proof that heya, xmplayer, or RetroArch launched.