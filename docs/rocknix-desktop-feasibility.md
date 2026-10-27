# ROCKNIX desktop runtime feasibility

This report answers issue #71 from repository code and the current local build artifacts. Confirmed statements cite the source; runtime conclusions that follow from those facts are marked **Inference**.

## Q1. Can the official ROCKNIX RootFS be extracted and run in Docker?

**The userspace directory can serve as a container root, but current artifacts do not yet support the requested runtime.** `scripts/image` assembles an install root at `build.<distro>-<device>.<arch>/image/system`, then packages it as compressed SquashFS `SYSTEM` ([scripts/image:122-134](scripts/image#L122), [scripts/image:244-253](scripts/image#L244)). The repository's official target list includes `AMD64` (`ARCH=x86_64`) and H700 ARM64 builds ([Makefile:37-40](Makefile#L37), [Makefile:71-74](Makefile#L71)).

The rootfs is not a complete device boot: the actual boot uses a kernel, initramfs, mounts boot/storage partitions, then `switch_root`s to systemd ([busybox init:281-291](projects/ROCKNIX/packages/sysutils/busybox/scripts/init#L281), [busybox init:1331-1372](projects/ROCKNIX/packages/sysutils/busybox/scripts/init#L1331)). Docker can use the userspace tree but does not reproduce that boot path automatically.

**Current checkout evidence:** the existing generated H700 root contains an AArch64 `bash` ELF with `/lib/ld-linux-aarch64.so.1` interpreter, while the host and Docker engine are x86_64. It is therefore not directly executable as a native container on this host. This tree also lacks heya, xmplayer, RetroArch, and the heya service. H700 options set `MINI_DISTRO=yes`, `EMULATION_DEVICE=no`, and list heya/xmplayer as additional packages, but the extant image tree is incomplete ([H700/options:71-88](projects/ROCKNIX/devices/H700/options#L71)).

**Inference:** For the requested PC runtime, the closest maintainable route is a ROCKNIX `AMD64` build and extraction of its generated `image/system`; the official target is configured for x86_64 with Mesa, Wayland, Sway and RadeonSI graphics ([AMD64/options:4-50](projects/ROCKNIX/devices/AMD64/options#L4)). Building with the current ordinary `make image` entry point in the canonical checkout is unsafe while it contains unrelated dirty work: `scripts/image` deletes the existing install tree and truncates/releases target outputs ([scripts/image:122-126](scripts/image#L122), [scripts/build_distro:78-84](scripts/build_distro#L78)). A clean isolated worktree or equivalent separate source/build root is a prerequisite for a build that does not disturb that work.

## Q2. Which parts depend on ARM64?

**Confirmed:** H700 is configured for AArch64/Cortex-A53; heya's package is restricted to `aarch64` and builds Go with `GOARCH=arm64`; xmplayer is also restricted to `aarch64` ([H700/options:5-18](projects/ROCKNIX/devices/H700/options#L5), [heya/package.mk:4-33](projects/ROCKNIX/packages/apps/heya/package.mk#L4), [xmplayer/package.mk:4-10](projects/ROCKNIX/packages/apps/xmplayer/package.mk#L4)). The image includes a board kernel, bootloader, Allwinner ATF, device trees/overlays, Panfrost GPU stack and device-specific services ([H700/options:21-55](projects/ROCKNIX/devices/H700/options#L21)). These are not portable x86_64 userspace components.

**Inference:** A H700 ARM64 executable requires ARM64 userspace and an ARM64 execution environment. On x86_64 it needs emulation such as QEMU user mode plus binfmt registration, or the apps must be rebuilt for x86_64. Merely extracting files does not change ELF architecture. The repository's current package metadata sets `PKG_ARCH="aarch64"` for both heya and xmplayer, so the normal AMD64 package graph will not install them; enabling a desktop build requires changing those target constraints and confirming app portability.

## Q3. What can run directly on x86_64?

**Confirmed:** ROCKNIX declares an `AMD64` image target built with `ARCH=x86_64`. Its device options select Wayland, Sway environment, Mesa OpenGL/OpenGL ES, Vulkan loader, RadeonSI and x86-64-v3 default CPU target ([Makefile:37-40](Makefile#L37), [AMD64/options:4-50](projects/ROCKNIX/devices/AMD64/options#L4)). Package dependency graphs can build native platform components, shared userspace libraries and service units for that target.

**Not confirmed for the current package set:** H700-target heya and xmplayer are marked AArch64-only. RetroArch and cores are introduced through emulator dependency selection when `EMULATION_DEVICE=yes` ([image/package.mk:71-72](projects/ROCKNIX/packages/virtual/image/package.mk#L71)); the H700 configuration sets it to `no`. The present H700 mini image lacks all three apps. Therefore source support for an AMD64 ROCKNIX image does not prove the requested apps are present/runnable in that image.

**Inference:** Host-native x86_64 ROCKNIX libraries and binaries are the viable Docker base for PC GUI tests once the package set includes compatible builds of the desired applications. SDL applications may display through host Wayland/X11 only if the in-container SDL build has the matching video backend and the selected host socket is explicitly forwarded.

## Q4. What needs mocking?

At minimum, use isolated fixture data for `/storage` and `/storage/heya` (including manifests/theme), `/storage/roms`, saves, and media folders. The heya service reads its theme/apps from `/storage`, while its seeder creates `/storage/heya/apps`; runtime tmpfiles creates common storage directories ([heya.service:9-15](projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service#L9), [050-heya-apps:8-34](projects/ROCKNIX/packages/apps/heya/autostart/050-heya-apps#L8), [rocknix-dirs.conf:5-9](projects/ROCKNIX/packages/rocknix/tmpfiles.d/rocknix-dirs.conf#L5)). No real ROMs, saves, or host home directories are needed.

Battery/charge, Wi-Fi/radio, brightness/backlight, temperature/fan, physical storage discovery, controller/input and power/suspend interfaces should be represented only by deterministic fixture files/services if an app under test calls them. **Confirmed:** H700 enables Batteryplus and configures platform device-tree overlays ([H700/options:48-55](projects/ROCKNIX/devices/H700/options#L48), [H700/options:92-94](projects/ROCKNIX/devices/H700/options#L92)). **Inference:** a regular container lacks those H700 device nodes and kernel drivers, so corresponding app reads need mock providers or must be marked unavailable.

Systemd dependencies can be run inside a container only with an appropriate init/cgroup setup and a restricted set of services. An app-focused test can instead start the compositor/audio session and app directly, but that does not verify the full systemd boot dependency graph. Mock/no-op service substitutes must be clearly labeled and must not claim hardware behavior.

## Q5. What cannot Docker simulate?

Docker does not reproduce the H700 bootloader, board kernel and device tree, Allwinner/GPU drivers, handheld LCD panel/backlight, hardware video/audio codecs, physical buttons/controller wiring, battery gauge, thermal sensors or suspend/resume behavior. It also cannot establish hardware performance, frame pacing, codec acceleration, or the exact panel modes. These require device or suitable hardware-backed virtualization tests.

A host GPU may be exposed to a container to exercise the desktop host's driver stack, but that tests the host GPU/driver combination, not H700 Panfrost behavior. Passing a DRM device also increases host access and is not required for an initial socket-based desktop session. Audio can be forwarded to host audio, but that does not emulate the handheld codec/DSP route.

## Exact, mocked, and unavailable coverage

| Coverage | Status |
| --- | --- |
| ROCKNIX package-installed userspace and libraries | Exact only when taken from the matching official build `image/system`; current H700 tree has ARM64 system files but is missing requested applications. |
| x86_64 ROCKNIX userspace | Official target exists; an isolated build/export is required. |
| `/storage`, heya manifests/theme, ROM/save fixtures | Must be isolated mock data. |
| Battery/network/storage services | Mock only when needed by app flows; no real host devices/data. |
| GUI | Host X11/Wayland session forwarding can exercise desktop presentation with explicit opt-in and narrow socket access. |
| heya, xmplayer, RetroArch launches | Not verified by available artifacts; app package architecture and absent image files prevent a truthful success claim now. |
| H700 GPU, LCD, codec, controls, battery, thermal/power behavior | Not reproducible in ordinary Docker; device testing remains required. |

## Current blocker and safe next route

The machine has Docker/BuildKit and rootless Podman. The repository also has 64 GiB free, but its existing 34 GiB build tree is shared generated state; the RootFS there lacks the apps and is ARM64. Building another image with the existing in-tree `scripts/image` would delete/recreate install state and remove target outputs. No image build was run. To continue safely, build an AMD64 configuration from a separate clean source/build checkout (or implement a truly isolated output-root mechanism), resolve native package support for heya/xmplayer/RetroArch, then extract that authentic output and test it. Until those prerequisites and real launches are verified, a Debian-based substitute or shell-only scaffold would not satisfy the issue's authenticity and success criteria.
