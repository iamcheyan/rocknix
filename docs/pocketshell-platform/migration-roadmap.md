# PocketShell Platform Migration Roadmap

Design companion to [the CPR #89 architecture audit](audit.md). No implementation is included.

## Goal

Make Shell, Input, Library, Theme/assets, and Agent capabilities independently versioned and deliverable to PocketShell without rebuilding ROCKNIX `SYSTEM` or a full image. Preserve user data and provide a recoverable boot path.

## Current constraint

At the audited mainline baseline, `pocketjs-runtime` builds the guest `boot.pocket`, patched native runtime, launch scripts, and systemd units into one ROCKNIX package. The service starts files from `/usr`; current OTA replaces `SYSTEM` during reboot. `/storage` contains configuration/user data but does not own the executable runtime by default. See [audit](audit.md#1-verdict).

## Proposed stages

### 1. Define stable runtime contracts

Specify:

- Host ABI for workspace lifecycle, PTY/session management, input, rendering, events, logs and capability discovery.
- Guest app manifest: app ID, version, required ABI, resources, permissions, entry point and health probe.
- Input event semantics independent of controller button labels.
- Theme token and asset resolution with user overrides separated from packaged defaults.
- Error and incompatibility behavior, including unsupported optional capabilities.

Freeze the contract with compatibility tests before extracting package boundaries.

### 2. Separate code, data, and recovery paths

Proposed writable tree:

```text
/storage/pocketshell/
  platform/versions/<version>/
  apps/<app-id>/versions/<version>/
  themes/<theme-id>/versions/<version>/
  state/                 # app settings and user workspace metadata
  cache/
  logs/
  current -> selected version
  last-known-good -> previous healthy version
```

The system image retains only the bootstrap service, minimal compatible runtime/recovery console, trust roots and update client. Keep durable workspace/user data outside version directories. `/opt/pocketshell` is an alternative only when the target system explicitly provisions it as writable and persistent; do not assume ordinary `/opt` survives a SYSTEM replacement.

### 3. Split version and package units

- **Platform runtime:** native host, PTY manager, ANSI parser, renderer bridge, input adapter, bootstrap ABI.
- **Shell app:** shell workspace navigation and UI.
- **Input app:** keyboard, history, command/session/agent prompt UI.
- **Library app:** library browsing integration, with privileged operations delegated to a host service.
- **Themes/assets:** data packages with declared minimum app/runtime requirements.
- **Agent app/backend:** UI and backend independently versioned; backend must declare permissions and remote dependencies.

One signed manifest per artifact; explicit ABI and capability requirements; content hash and version pinning; no package may silently replace user state.

### 4. Keep startup small and recoverable

An image-baked systemd unit starts the bootstrap from a fixed trusted path. Bootstrap validates the selected runtime/app and starts the last-known-good version if validation fails. Provide a service-level escape to a console/recovery screen independent of the current guest app. Config selects an installed version; it does not contain executable code.

### 5. Implement an atomic component update transaction

1. Fetch signed metadata and artifacts from a dedicated component channel.
2. Check signature, hash, device/architecture, runtime ABI, free space and declared dependencies.
3. Download into a staging directory on the same filesystem as final versions.
4. Validate archive paths and permissions; unpack to an immutable version directory.
5. Preserve app state and user data; apply only explicit, versioned migrations with backup.
6. Flush staged data and atomically update the selected-version pointer.
7. Restart PocketShell through systemd; run a bounded startup/health check.
8. On success, mark the version healthy and retain the previous version for rollback.
9. On failure or interrupted activation, restore the prior pointer and restart the previous version; leave user data intact.

Updates should be signed, authenticated and replay-protected. A hash alone proves transfer integrity only when its metadata is trusted.

### 6. Integrate with ROCKNIX OTA without conflating channels

Keep the existing ROCKNIX updater responsible for kernel, bootloader and SYSTEM updates. PocketShell component packages must not be presented to initramfs as SYSTEM update tar files. Use a separate client/manifest protocol and enforce package signatures, compatibility and rollback independently. SYSTEM updates must preserve `/storage/pocketshell` and the bootstrap must remain able to launch its recovery mode after an OS update.

### 7. Rollout and acceptance gates

1. Establish browser/harness parity with guest UI modules and a mock host ABI.
2. Ship bootstrap, minimal recovery and first runtime ABI in SYSTEM; validate existing boot and user data preservation.
3. Enable runtime-only signed update and rollback.
4. Enable Shell/Input app updates without SYSTEM build.
5. Enable theme/assets updates independently.
6. Add Library and Agent modules after capability/permission contracts exist.
7. Exercise interrupted download, corrupt signature/archive, no free space, ABI mismatch, failed health check, rollback and SYSTEM-upgrade preservation.
8. Measure actual developer change mix; tune the proposed 90% workflow allocation in the audit from observed results.

Hardware acceptance must include the supported board/display revisions, controller mappings, service recovery, persistent data preservation and power-loss simulation. None of these stages or device checks is performed by the audit.
