# Platform audit: ROCKNIX and heya-core-minimal

> Scope: platform dependencies of the ROCKNIX source tree, with a focused trace of the heya-core-minimal H700 integration. The requested output is audit and design only; this document makes no runtime/code changes and does not implement profiles.
>
> Baseline: local `heya-core-minimal` at `44e2aa5ab2` (origin branch `heya-core-minimal` at `44e2aa5ab2a125cb9b340254dd493352b2599f38`). The checkout contained pre-existing uncommitted changes in many files; audit findings about tracked ROCKNIX source were checked against the working tree where relevant and are cited to paths and line numbers. heya source is pinned separately by the package recipe to `bca7c0510ac6c857b55c9532b9165dd332b8477c` with an archive SHA-256; findings about heya source refer to that immutable revision.
>
> Method: enumerated 7,063 tracked files; inspected all 3,613 tracked files under `projects/ROCKNIX/` and all 5 under `distributions/ROCKNIX/`; used repository-wide searches for the requested mount/kernel paths, absolute paths and process execution, then followed the boot, package, heya service, input, simulator, system utility and storage call chains. The tree contains extensive third-party source, patch, generated config, device and package content; tables below identify high-value platform seams rather than reproducing every occurrence of `/usr`, `/etc` or every app-private path. Line numbers are for the cited baseline paths; because this branch has an existing working diff, verify them against the committed tree before applying future changes.

## Executive findings

ROCKNIX is a distribution build system and device integration, not a desktop application with one replaceable OS adapter. Its dominant coupling is the boot/image/package pipeline, read-only squashfs plus writable `/storage` model, systemd units and ROCKNIX-specific shell commands/settings, per-device kernel/DTB/udev/quirks, and multiple independent game/input mappings. A profile abstraction is viable for **heya**, whose JSON-driven app UI and SDL input are already portable in principle. It is not a realistic abstraction boundary for the full 3,600-file distribution tree: build and device concerns should remain ROCKNIX-specific.

The lowest-risk future sequence is to extract heya's filesystem layout, read-only system providers, command dispatch, input mapping and app launch policy behind narrow interfaces; then add a Desktop profile; then supply a seeded mock environment. Preserve the current ROCKNIX behavior as the compatibility reference. Do not make these changes in this audit phase.

## Audit baseline and source boundaries

| Area | Current source of truth | Evidence |
|---|---|---|
| Distro defaults and feature switches | `distributions/ROCKNIX/options` | Build options and root filesystem policy; package metadata and default feature selection. |
| Package selection and build | `projects/ROCKNIX/packages`, `projects/ROCKNIX/devices/<device>/packages`, `scripts/` | Package recipes install files into `${INSTALL}`; device recipes provide hardware-specific variants. `projects/ROCKNIX/packages/apps/heya/package.mk:15-33,36-73` shows the cross-build/install contract for heya. |
| Device support | `projects/ROCKNIX/devices/<device>/` | Kernel patches, bootloader, DTB, firmware, udev, options and quirk hooks. Example H700 device overrides live under `projects/ROCKNIX/devices/H700/`. |
| Runtime boot and services | `projects/ROCKNIX/packages/rocknix`, `projects/ROCKNIX/packages/sysutils/systemd`, `distributions/ROCKNIX/filesystem` | systemd targets/units, init, autostart scripts, profile environment and user-data setup. |
| heya application | `iamcheyan/heya` archive pinned by ROCKNIX package | `projects/ROCKNIX/packages/apps/heya/package.mk:4-11` pins the source and target dependencies; Go code is not vendored in ROCKNIX. |
| Desktop simulation | `tools/run-heya-simulator.sh` plus sibling heya checkout | `tools/run-heya-simulator.sh:4-8,14-24,26-37` prepares app JSON in XDG state, sets `HEYA_SIMULATOR=1`, and launches a sibling heya build. This is a useful seed, but currently only prepares the xmplayer entry and depends on that external checkout. |

## Filesystem Paths

The requested roots are grouped by semantic owner. Occurrences are intentionally not listed one-by-one across every package; the representative call chains below show where a future profile should provide paths and where the system's own ABI should remain outside the app profile.

| Path | File | Purpose | Suggested Abstraction |
|---|---|---|---|
| `/storage` | `projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service:9,15`; `.../apps/terminal/app.json:7`; `.../scripts/disk-browser:5` | User home, apps, themes, settings, removable media, configs and persistent data on ROCKNIX. | `Platform.Paths().DataRoot()` and narrower `AppsDir()`, `ThemesDir()`, `SavesDir()`. Desktop should use XDG data/config/state roots, not create `/storage`. |
| `/storage/heya/apps` | `projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service:15`; `.../autostart/050-heya-apps:8-33` | User-writable app manifests, seeded from immutable `/usr/share/heya/apps`; seed does not overwrite user files and can remove explicitly retired built-ins. | `AppCatalog`/`AppsDir()` plus a platform-owned seeding/migration policy. Keep user-added apps distinct from built-in defaults. |
| `/usr/share/heya/apps`, `/usr/share/heya/assets`, `/usr/share/heya/settings` | `projects/ROCKNIX/packages/apps/heya/package.mk:42-65`; `.../autostart/050-heya-apps:8-10` | Immutable package defaults: manifests, icons, fonts, service labels, removed-app list. | `Platform.Paths().SystemDataDir()` or a resource resolver; read-only defaults must remain separate from writable user data. |
| `/storage/heya/themes/theme.json`, `/usr/share/heya/themes/default/theme.json` | `projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service:15`; package recipe `:64-65`; pinned heya `cmd/heya/main.go:80-96` | Active mutable theme and installed default theme. heya creates storage directories and seeds a theme on first boot. | `ThemesDir()` plus `ThemeDefaultsDir()`; make precedence explicit (user override, profile default, built-in fallback). |
| `/storage/roms`, `/storage/games-internal`, `/storage/games-external`, `/var/media` | `projects/ROCKNIX/packages/rocknix/sources/scripts/automount:9-12,21-23,38-100,120-174,185-236`; `.../sources/scripts/runemu.sh:35-43` | Game library mounts, merged/overlay storage, USB media and emulator launch paths. | Keep in ROCKNIX storage/automount services. Consumers should receive a resolved library URI/path through a media provider; do not make heya infer mount topology. |
| `/storage/.config`, `/storage/.cache`, `/storage/.update`, `/storage/.emulationstation` | `projects/ROCKNIX/packages/rocknix/sources/scripts/automount:9`; `.../runemu.sh:35-43`; `.../setsettings.sh:11-23` | Writable settings, logs/cache, OTA staging and EmulationStation state. | Per-subsystem `ConfigDir`, `CacheDir`, `UpdateDir`, and `FrontendStateDir`; avoid a single generic storage root in app logic. |
| `/tmp` | `projects/ROCKNIX/packages/rocknix/sources/scripts/runemu.sh:11,40-43,101-115,261,398,680-714`; `.../setsettings.sh:20-23,335-342` | Volatile launch/config files, emulator cores, error handoff, performance values and caches. | `RuntimeDir()` / temp-file service. Preserve volatile lifecycle and permissions; never map this into persistent mock data by default. |
| `/sys` | `projects/ROCKNIX/packages/rocknix/sources/scripts/rocknix-power-key:23,35-38`; `.../sources/scripts/automount:198`; many device quirks | Kernel ABI: backlight controls, input devices and block-device topology. | `BrightnessProvider`, `InputDeviceProvider`, and `StorageDeviceProvider`; model supported/unsupported responses rather than requiring these nodes on desktop. |
| `/proc` | `projects/ROCKNIX/packages/rocknix/sources/scripts/automount:77,157,191,204`; `.../setsettings.sh:352-358`; `scripts/pkgbuilder.py:809-812` | Runtime mount/device/input inspection; build-host load and memory probes. | Runtime probes belong behind system providers. Build-host monitoring is a separate build utility and should not be pulled into a device profile. |
| `/dev/input/event*`, `/dev/input/js*`, `/dev/dri/*`, `/dev/fb*`, `/dev/mmc*` | `projects/ROCKNIX/packages/rocknix/sources/scripts/rocknix-power-key:35-38`; `.../setsettings.sh:352-358`; device quirk and graphics packages | Kernel device nodes for controllers, display/GPU, storage and input monitoring. | SDL/input and graphics backends for heya; kernel-specific consumers remain in device adapters. Desktop uses host SDL devices and must not assume handheld nodes. |
| `/run`, `/var/run/0-runtime-dir`, `/run/systemd`, `/run/udev` | `projects/ROCKNIX/packages/apps/heya/integrations/rocknix/heya.service:10`; systemd units, udev rules and ROCKNIX scripts | Ephemeral runtime state, Wayland socket, service manager and device discovery. | Inject session/runtime endpoints through launch environment and platform services; do not hardcode the ROCKNIX UID/runtime path in portable UI code. |
| `/etc/profile.d/001-functions`, `/etc/systemd/system`, `/usr/lib/systemd/system`, `/usr/config` | `projects/ROCKNIX/packages/apps/heya/scripts/heya-control:4`; `.../package.mk:67-73`; service and first-boot scripts | ROCKNIX shell helper API, systemd units and factory configuration. | `RocknixProfile` owns these integration paths. Desktop profile should use user-level configuration and must not emulate privileged system configuration by writing host `/etc`. |
| `/roms` | No active canonical runtime root found in the inspected ROCKNIX source; canonical library is `/storage/roms`, with per-device/external mount points. | Legacy path in some external emulator/application conventions may occur, but it is not the distro storage authority in this baseline. | If supporting a frontend that requires `/roms`, expose it as a configured alias at the emulator boundary; do not substitute it globally for `/storage/roms`. |
| `/userdata` | No active canonical ROCKNIX root found in inspected source; user data is `/storage`. | Common in other handheld distributions, not evidence of a ROCKNIX contract. | A future profile may map its data paths to a target distro's `/userdata`, but keep it an implementation detail of that profile. |

### Path ownership and propagation

ROCKNIX's mount hierarchy is established by init/systemd and automount; package recipes install defaults into the immutable root; first-boot/user-config scripts create or link writable configuration; apps then consume those absolute paths. A Desktop profile must replace this whole ownership chain at the **heya boundary**: directory layout, default seeding, writable user data, theme lookup, temp/runtime paths and app manifests. Changing only one Go constant would leave service unit paths, environment variables and app JSON tied to `/storage`.

## System Providers

| Feature | Current Implementation | Suggested Interface |
|---|---|---|
| Battery | Kernel power-supply sysfs, ROCKNIX status scripts and device-specific naming/units; the distro has different device trees/drivers. | `BatteryProvider.Snapshot() (BatteryState, error)` with percentage, charging state and optional temperature; `Unsupported`/unknown is valid. |
| Brightness | `/sys/class/backlight/*` and ROCKNIX `brightness` helper; device-specific backlight node and ranges. `rocknix-power-key:23` probes nodes; heya control calls `brightness set` via `/etc/profile.d/001-functions` (`heya-control:4,9-11`). | `BrightnessProvider.Get/Set` with normalized 0–100 value and capability detection. Desktop may report unsupported or integrate a documented host API. |
| Volume/audio | ALSA mixer or PulseAudio/PipeWire; `heya-control` calls ROCKNIX `volume`, while service sets `SDL_AUDIODRIVER=pulseaudio` (`heya.service:13`). | `AudioProvider` for display/control if required; UI should distinguish read-only level from writable capability. |
| Wi-Fi | `wifictl`, `nmcli radio`, ROCKNIX `set_setting wifi.enabled`; profiles/state managed by NetworkManager and distribution scripts (`heya-control:13-20`). | `NetworkProvider` with radio state and scan/connect operations. Keep credentials/profiles in the host network manager; never mock or own secrets in heya. |
| Bluetooth | `rocknix-bluetooth enable/disable`; BlueZ bonds and discovery are managed by distro services (`heya-control:13-20`; `systemd`/network packages). | `BluetoothProvider` with support, radio state, scan/pair/disconnect; delegate pairing secrets to BlueZ/host. |
| Network interfaces/IP | `ip -4 addr`, `rfkill`, `systemctl`, `nmcli`, and online probes are spread through ROCKNIX scripts and pinned heya system probe. | `NetworkStatusProvider` returning interfaces/connectivity without assuming a command binary or interface name. |
| Memory / CPU / temperature | `/proc/meminfo`, `/proc/loadavg`, thermal sysfs and SoC-specific paths; build-time probes also use `/proc` (`scripts/pkgbuilder.py:809-812`). | `SystemInfoProvider` with optional fields and source metadata; separate build-host probes from runtime telemetry. |
| Storage / removable media | `automount` parses `/proc/mounts`, `/proc/partitions`, `/sys/class/block`, then mounts devices and merges ROM directories; fsck/mount behavior is distro-controlled. | `StorageProvider` lists volumes and mount points; mutation/mounting remains privileged platform service code. heya should consume capabilities, not issue mount commands. |
| Power key / suspend / display blanking | `rocknix-power-key` reads `/sys/class/input`, grabs `/dev/input/event*` via `evtest`, and writes device backlight nodes; systemd/sway and device quirks supply suspend behavior. | `PowerProvider` plus `DisplayProvider`; use platform capability checks and no-op/unsupported implementations on desktops that do not expose handheld controls. |
| Services | `rocknix-services` reads ROCKNIX settings, maps known service keys to processes/units and invokes `systemctl`; heya forwards validated commands (`heya-control` and service settings). | `ServiceManager` with a fixed typed service catalog. Keep arbitrary unit/process control out of a generic API. |
| Update / immutable system | `/flash`, read-only squashfs, initramfs and ROCKNIX OTA scripts. | Not a heya profile concern. If heya needs version/update status, use a read-only `PlatformInfo` provider. |

The main abstraction seam is the **provider interface**, not direct path substitution. Providers should return typed data and explicit unsupported/error states; only the ROCKNIX implementation should know sysfs nodes, shell commands and persistent settings formats.

## External Commands

The tree-wide search found process launching in shell, Python, Lua, C/C++ and package scripts. The list below covers the representative platform contract and heya call boundary rather than every emulator's private executable invocations.

| Command | Purpose | Platform Dependency |
|---|---|---|
| `systemctl` | Starts/stops/enables ROCKNIX services, scopes, targets and frontend units; used by boot scripts, automount, service settings and game launch. | systemd-specific; desktop may also use systemd but user session ownership and unit names differ. Keep inside `RocknixProfile`/`ServiceManager`. |
| `rocknix-services` | Queries or changes the ROCKNIX allow-listed service toggles; called by heya's `heya-control` (`scripts/heya-control:22-32`). | ROCKNIX-only command and config schema. Replace with an unsupported or host-specific provider on desktop; never invoke arbitrary service names. |
| `wifictl`, `nmcli`, `rocknix-bluetooth` | Controls radios and saves ROCKNIX settings (`scripts/heya-control:13-20`). | Mix of distro helpers and NetworkManager/BlueZ CLI. Prefer D-Bus/provider APIs over shell command dependencies in portable code. |
| `volume`, `brightness` | Changes handheld audio/backlight from heya control (`scripts/heya-control:9-11`). | Functions exported by `/etc/profile.d/001-functions`; desktop availability/semantics differ. Wrap in providers and report unsupported. |
| `usbgadget` | Switches MTP, ADB, network, charge-only and wireless ADB modes through USB gadget controller (`apps/heya` integration source). | Kernel gadget/H700 distro helper; unavailable on ordinary desktops and other handhelds without an equivalent. |
| `evtest`, `find`, `kill`, `nohup`, `mount`, `umount`, `modprobe`, `fsck` | Power-key event grabs and automount/device lifecycle. | Privileged Linux/ROCKNIX runtime, device node and utility assumptions. Keep in OS scripts/services, never in launcher core. |
| `retroarch`, libretro cores, standalone emulator commands, `gptokeyb` | Launch games, map controller hotkeys and run emulator frontends. | Package-set, device and emulator-specific; important for distribution, but not a universal launcher dependency. Use app manifests/launch adapters when a frontend needs it. |
| `heya-control` | heya app/control bridge for volume, brightness, Wi-Fi, Bluetooth, services and disk browser (`heya-control:6-37`). | ROCKNIX-only privileged command wrapper. Replace UI-to-shell coupling with a typed control interface; preserve this script as a thin Rocknix adapter. |
| `disk-browser`, `mc`, `foot` | Opens a controller-mapped Midnight Commander with mounted storage links (`scripts/disk-browser:1-34`). | Assumes ROCKNIX storage topology, terminal and gamepad mapping. Desktop profile needs a different file browser integration or marks the app unavailable. |
| `bash`, `sh`, `python3`, `git`, `go`, `make`, compiler/toolchain and Docker | Build recipes, developer simulator and repository tooling. | Build-host/developer environment, not handheld runtime. Do not fold build tools into runtime `Platform`. |
| C/C++ `system()`/`popen()` and package scripts | App-specific controls and settings; search found 70 process-launch call sites in selected project runtime/build source types. | Heterogeneous app behavior. Audit each owner before abstracting; global shell replacement is unsafe and outside the heya profile scope. |

The heya source pin uses Go `exec.Command` for manifest-declared app launches (`cmd/heya/main.go:378,434-438`) and system probes (`internal/system/system.go:78`); controls are routed through `heya-control` (`internal/system/control.go:9-27`). This is a useful seam, but app manifests can still contain absolute commands/working directories, so a profile must resolve and validate launch policy rather than simply wrap `exec.Command`.

## Input Dependencies

### ROCKNIX distribution input path

Physical buttons, analog controls and device-specific drivers become Linux evdev/joystick devices. udev and kernel configuration classify them; EmulationStation uses `es_input.cfg` GUID mappings, RetroArch uses its own autoconfig, SDL apps use `gamecontrollerdb.txt`, and standalone emulators can use `gptokeyb` or input filters. The mapping is therefore not one global table. Evidence: `projects/ROCKNIX/packages/ui/emulationstation/config/common/es_input.cfg`; `projects/ROCKNIX/packages/rocknix/profile.d/001-functions` (exports SDL game-controller database); `projects/ROCKNIX/packages/sysutils/systemd/scripts/userconfig-setup:40-48`; `projects/ROCKNIX/packages/apps/xmplayer/scripts/xmplayer:14`; `projects/ROCKNIX/packages/rocknix/sources/scripts/input_sense`.

### heya input actions

The pinned heya source translates device-independent actions using `internal/input/input.go:14-30,68-95,105-118`; configuration can replace the mapping. Default mapping:

| Action / requested control | Keyboard | SDL game-controller button / axis | Current behavior |
|---|---|---|---|
| LEFT | Left, A/a | D-pad left | Move selection left. |
| RIGHT | Right, D/d | D-pad right | Move selection right. |
| UP | Up, W/w | D-pad up | Move selection up. |
| DOWN | Down, S/s | D-pad down | Move selection down. |
| A | N/A as physical keyboard name | controller A → Confirm | Activate selected item. |
| B | Escape, Backspace → Cancel | controller B → Cancel | Return/back. |
| X | Not mapped by default | SDL X available in parser but no default action assignment | Unused by default; configurable only if assigned to an action. |
| Y | Not mapped by default | SDL Y available in parser but no default action assignment | Unused by default; configurable only if assigned to an action. |
| START | Space | controller Start | Semantic Start action; actual page behavior is owned by launcher. |
| SELECT | Tab | controller Back | Semantic Select action. |
| Page up/down | Q/q, E/e | Left/right shoulder | Scroll/page navigation. |
| Quit | F10 | No default controller binding | Keyboard-only quit in the default map. |

Recommended `InputProfile` scope: map host events to heya's existing semantic actions, with profile-specific SDL GUID/controller corrections and optional key equivalents. Keep navigation/UI logic device-independent. Distinguish controller A/B/X/Y from semantic confirm/cancel; those labels can differ by controller layout and user configuration. Desktop should support keyboard and ordinary game controllers without requiring the ROCKNIX SDL database or `gptokeyb`.

## Environment Assumptions

1. **Immutable image plus writable data partition.** Package defaults under `/usr` are read-only; user settings and apps under `/storage` are writable and survive upgrades. `050-heya-apps` seeds only missing manifests and protects user edits. A Desktop profile needs an equivalent user-data lifecycle, not an image updater.
2. **The expected directories exist or can be created.** heya's first-boot seeder and launcher create app/theme/state directories in known locations; many distro scripts create mountpoints lazily. Desktop setup must create its own profile tree and produce actionable errors if a requested path is not writable.
3. **The service manager is systemd.** Targets, units, slices, `systemctl`, and boot ordering are core runtime assumptions across ROCKNIX; user-level desktop execution cannot reuse system service semantics.
4. **A sway/Wayland session exists.** `heya.service:3-15` requires `sway.service`, fixes `WAYLAND_DISPLAY=wayland-1`, SDL video to Wayland, audio to PulseAudio, and points the SDL DB at ROCKNIX config. These are service integration settings, not UI logic.
5. **The current process has the device's expected UID/runtime paths and permissions.** `/var/run/0-runtime-dir`, `/storage` home and USB/backlight/input operations assume ROCKNIX user/session policy; desktop users differ.
6. **ROCKNIX helpers and functions are on PATH / sourced.** `heya-control` sources `/etc/profile.d/001-functions`, then calls distro shell functions and binaries. A missing or renamed helper fails at operation time.
7. **Wi-Fi, Bluetooth, audio and brightness are present and controllable.** Devices may omit radios or brightness nodes; provider APIs must make capability optional and separate “not present” from runtime failure.
8. **Network access may be absent or delayed.** Some probes/operations assume NetworkManager/radio services; startup/UI should not block waiting for connectivity. Desktop mock mode must return deterministic local state without reaching external networks.
9. **Storage mounts are dynamic.** Removable volumes may appear/disappear; `/proc/mounts` and sysfs are runtime data, not static directories. Consumers need refresh/error states and must not assume `/storage/games-external` exists.
10. **SDL2, SDL_ttf, Wayland and controller DB are installed.** Package dependencies provide SDL2/SDL_ttf and `gamecontrollerdb`; fonts/assets must be installed at expected paths. Cross-compile success alone does not prove the runtime shared libraries, display backend or CJK font are usable on a particular image.
11. **ROCKNIX command and config formats are stable.** Service keys, `system.cfg`, shell function names, USB mode arguments and app manifest fields are private integration contracts; other Linux systems do not promise them.
12. **App manifests are trusted and executable.** They may name a command, arguments, environment and working directory. Desktop profile needs an explicit launch policy and should not silently run arbitrary copied manifests with broader host access.
13. **Controller layout is represented consistently by SDL.** Default heya mapping assumes SDL's standardized A/B and D-pad/shoulder buttons; device database and physical labels can vary. Desktop and other handhelds may expose different GUIDs or axes.
14. **First boot and upgrade have ordered setup.** The heya unit must start after its UI/session and seeded user manifests/theme exist. Enabling heya independently or changing service order can cause fallback paths, empty catalogues or restart loops.
15. **Hardware-specific behavior is distributed across device trees and quirks.** `/sys` node names, suspend, brightness, power key and gamepad behavior vary by SoC/board; a generic Linux profile cannot promise those capabilities merely because the kernel is Linux.
16. **Build tools and build host are separate from target runtime.** `/proc` load/memory in `scripts/pkgbuilder.py`, toolchain variables and Docker describe the build machine, not the eventual handheld profile.
17. **Other distro path names are not interchangeable.** `/userdata` is common elsewhere but not the ROCKNIX data contract; `/roms` may be a compatibility alias, while the canonical library is `/storage/roms`.

## Proposed Architecture

This is a design proposal only; none of these interfaces or profiles are implemented by this audit.

### Boundary

Keep the existing heya menu/model/rendering and semantic action handling in the core. At startup, select an explicit profile, inject its paths/providers/launcher/input map, and render capabilities from the returned provider state. Avoid scattered `if ROCKNIX` checks and avoid exposing generic shell execution as an interface.

```go
type Platform interface {
    ID() string
    Paths() Paths
    Battery() BatteryProvider
    Network() NetworkProvider
    Brightness() BrightnessProvider
    Audio() AudioProvider
    Storage() StorageProvider
    Services() ServiceProvider
    Launcher() AppLauncher
    Input() InputProfile
    Capabilities() Capabilities
}

type Paths interface {
    AppsDir() string
    ThemesDir() string
    ThemeDefaultsDir() string
    SavesDir() string
    ConfigDir() string
    CacheDir() string
    RuntimeDir() string
    MockDataDir() string
}
```

Provider methods should return typed snapshots/results, honor context cancellation, avoid blocking UI, and distinguish unsupported from transient errors. Mutating operations should be narrow and validated. Do not expose arbitrary `Exec(command string)` to UI; use typed operations such as `SetBrightness(0..100)`, `SetWifiEnabled(bool)`, `ConnectWiFi(...)`, or an allow-listed `SetService(key, enabled)`.

### RocknixProfile

- Own current `/storage` and `/usr/share/heya` layout, first-boot seeding and upgrade compatibility.
- Use ROCKNIX service/helper commands through narrow, validated adapters; keep privileged shell calls out of core.
- Detect device capabilities from available services/sysfs and device configuration; use explicit unsupported states for absent hardware.
- Keep systemd/Wayland/SDL environment setup in the existing distro service integration rather than in core UI.
- Preserve app manifest semantics and return a launch result/error to the UI.

### DesktopProfile

- Resolve paths under XDG: user apps/theme/config/state/cache under the current account; bundled defaults/resources remain read-only and separate.
- Use SDL keyboard/game-controller events and the host SDL database where available; do not require ROCKNIX `gamecontrollerdb.txt`, `gptokeyb`, or specific controller labels.
- Provide safe host launch policy for app manifests; validate working directories, environment overrides and executable selection, and show clear errors for unavailable apps.
- Implement read-only battery/network/audio/brightness providers only where a documented host API is available; otherwise report unsupported rather than guessing from shell output.
- Run as a normal user. Never change host services, mount devices or write `/etc` to simulate handheld controls.

### Future LinuxHandheldProfile

- Reuse shared Linux providers when their APIs are standard (SDL, UPower, NetworkManager D-Bus, BlueZ D-Bus, XDG paths), and add a distro/device capability adapter only for genuine differences.
- Do not assume all handhelds use `/storage`, sway, systemd, NetworkManager, or the same A/B labels. Capabilities should be discovered and user-overridable.
- Keep distro package/build integration outside heya core; provide a small packaging adapter per distribution.

## Desktop Mock Environment

A filesystem-backed mock can make app discovery, theme selection, status displays and UI flows deterministic without a handheld. Proposed repository layout:

```text
dev-env/
├── storage/heya/apps/             # writable seeded manifests / test user apps
├── storage/heya/themes/           # active theme override
├── storage/roms/                  # optional ROM tree for integration fixtures
├── storage/saves/                 # isolated save fixtures; never user's real saves
├── mock/battery.json
├── mock/network.json
├── mock/system.json
├── mock/storage.json
└── README.md                      # reset, seed, run, fixtures and safety boundary
```

Required supporting abstractions: profile-owned path resolution; deterministic mock providers; controllable clock/time; simulated device capabilities; app discovery independent of absolute root; theme default/user precedence; isolated process launcher with a fixture allow-list; seeded data/reset tooling; and a simulator flag that cannot invoke mutating host controls. The existing `tools/run-heya-simulator.sh` is a starting point (`:5-8,14-24`) but currently generates only the xmplayer app state and expects a sibling heya checkout. Move toward fixture data in-repo or make that dependency an explicit configurable checkout, and verify simulation cannot call ROCKNIX control commands. Never place copied ROMs, personal paths, real Wi-Fi credentials, or real saves in the mock tree.

## Risk Analysis

### Low risk

- Add path/provider interfaces around read-only status and deterministic theme/app discovery in heya, preserving the current ROCKNIX provider as the default.
- Build a Desktop mock with fake battery/network/system/storage snapshots and no privileged controls.
- Make unsupported capability states explicit and add contract-level tests for each provider.

### Medium risk

- App launching and manifest path resolution: absolute executables, working directories and environment overrides can expose the host or fail differently across distributions. Require explicit launch policy and validate paths.
- Input parity: SDL mappings and physical A/B labels vary; preserve semantic actions and test keyboard, SDL controller and custom mapping together.
- First-boot seeding and upgrades: user edits must survive package updates while removed built-ins are retired safely. Changes to merge/delete policy can lose user data.
- Network/audio/brightness provider differences: host APIs and permissions vary; shelling out creates latency, localization and parsing risks.
- Desktop display/session lifecycle: replacing systemd unit assumptions while retaining SDL/Wayland behavior can produce startup loops or hidden windows.

### High risk

- Removing the `/storage` and immutable-root contract from ROCKNIX package/runtime scripts; many unrelated packages, updates, mounts and saves depend on it.
- Abstracting boot, partitioning, squashfs, initramfs, OTA, device tree, kernel patches, udev rules or suspend into a profile concept. These are build/distribution and per-device contracts, not app runtime policy.
- Generic privileged command or service interfaces: an unrestricted launcher could execute arbitrary commands, stop critical services, alter radios, mount/unmount storage or interfere with updates.
- Broad search-and-replace of absolute paths: same path tokens can mean package staging, target runtime, build host, temporary data or a third-party app's private convention.

The hardest dependencies to leave behind are **the full ROCKNIX distribution pipeline** and, within the heya application, **privileged hardware/system controls and app launch policy**. The menu renderer and semantic input layer are the most portable parts.

## Phased Roadmap

### Phase 1 — Platform Layer

Define path resolution, capability model, typed providers, app-launch boundary and semantic input profile. Move only heya's existing ROCKNIX behavior behind adapters; no feature changes. Add contract tests and compare ROCKNIX behavior against the current pin.

### Phase 2 — Desktop Profile

Add an explicit desktop profile using XDG directories, host SDL input, a safe app launcher and unsupported/read-only status providers where appropriate. Run it as a normal user and preserve the Rocknix profile as the default for the ROCKNIX service.

### Phase 3 — Desktop Mock Environment

Seed filesystem and provider fixtures under an isolated state directory. Verify app discovery, themes, status panels, input, navigation and error states offline. Ensure mutating controls fail closed and no fixture can touch host services or user data.

### Phase 4 — PocketJS UI Prototype

Use the stable profile/provider contracts as a model for a PocketJS UI prototype. Keep it as a UI experiment until behavior and data contracts are compared against heya; do not duplicate ROCKNIX system logic in the prototype.

Acceptance target: the same app manifests, theme selection, directory semantics and semantic controls should produce comparable UI on desktop and handheld, while platform-specific capabilities are reported honestly. Full parity is not established by a desktop build alone.

## Evidence and verification limits

- Full-tree inventory: `git ls-files` returned 7,063 tracked files; 3,613 under `projects/ROCKNIX/` and 5 under `distributions/ROCKNIX/`.
- Search counts are discovery aids, not occurrence totals for every semantic category: 5,071 matches for selected storage/kernel path tokens in selected runtime/build roots; 774 absolute-path string matches in selected source/recipe/config types; 70 process-launch matches in selected implementation types. Generated files, patches and vendored dependencies can add hits and need owner-by-owner triage before implementation.
- heya pinned source was checked in a detached worktree. `go test ./... -count=1`, `go vet ./...`, and `go build ./cmd/heya` passed on the Linux desktop host. Simulator frame dumps had non-background text pixels across all nine emitted frames. These checks verify the pinned source on this host only.
- No ROCKNIX ARM64 cross-build, image build, boot test, H700 physical-device test, radio/audio/backlight test, or other Linux handheld test was run. No new profile or behavior was implemented. Those are explicit follow-up validation tasks, not implied by this report.
