# Mini Launcher: system controls and support tools

**Source baseline:** project fork `next`, commit `742bd52562` (2026-10-26).

## Goal and boundary

Expand the H700 mini launcher into a useful system-control and support surface while it owns the boot UI. Reuse ROCKNIX system commands and settings contracts where appropriate. Do not restore or embed EmulationStation's launcher behavior: no game lists, collections, favorites, themes, scraper, boot-game selection, emulator/core/per-game controls, or ES navigation/settings screens.

This inventory was checked against `ROCKNIX/emulationstation-next` `f6c542872e` (`es-app/src/guis/GuiMenu.cpp`), ROCKNIX system scripts, H700 configuration, and the current `handheld-launcher/src/main.c`.

## Existing mini-launcher controls

The launcher already has Wi-Fi enable/scan/connect and IP display; Bluetooth enable/scan/connect; USB gadget roles; remote access toggle; brightness and volume adjustment; screen-off audio mode; free storage, battery and CPU-temperature display; XMPlayer launch; and reboot/poweroff actions. These should be retained, but report live hardware/service values instead of optimistic hard-coded defaults and show command failures in the UI.

## Candidate features

| Priority | Function found in original ES / ROCKNIX | Mini-launcher treatment | Notes |
|---|---|---|---|
| P0 | System information (`openSystemInformations`) | Expand live system page: model, OS/build, kernel, uptime, IP, battery/charging, storage, RAM/swap, temperature | Read `/proc`, `/sys`, and existing ROCKNIX tools; display unavailable when a source is absent. |
| P0 | Network settings / Wi-Fi networks (`openNetworkSettings`) | Keep compact Wi-Fi toggle, live IP/status and scan/connect; add forget/disconnect only if ROCKNIX command supports it | Never display saved credentials. Escape SSIDs before passing them to commands; avoid shell interpolation. |
| P0 | System services (`openServicesSettings`) | Add a curated service page for SSH, SMB, Bluetooth and adbd where installed | Show running/enabled separately. Do not expose every internal service. SSH/adbd need clear access/port status. |
| P0 | USB gadget settings | Keep ADB/MTP/network/charge-only roles and display the active role from system state | Validate transitions and errors; coordinate with adbd/sshd controls. |
| P1 | Sound settings / audio reset | Add mute/volume and a confirmation-gated audio service restart/reset | Never invoke reset without explaining it can restart the system and reset audio configuration. |
| P1 | ZRAM settings (`openZramSettings`) | Add enabled state, size (50/75/100/125/150%), LZ4/ZSTD, using `rocknix-memory-manager` | Show current values from `--get-zram`; apply through the supported utility. No custom sysfs writes. |
| P1 | System settings | Add time zone, power-saving mode, and keyboard layout only when the required ROCKNIX utility/device supports them | Use existing ROCKNIX tools and config keys. Some settings require reboot; show that before applying. |
| P1 | Cooling profile and CPU governor | Surface H700-supported cooling profiles and governor choices only after confirming the backing control scripts and device capabilities | Hide unsupported controls. Do not expose generic overclock or unrelated per-emulator profiles. |
| P1 | Display scaling/sharpening and refresh calibration | Surface only when the H700 advertises the relevant capability; calibration is an explicit long-running action | Explain display changes/reboot requirements. Never invent unsupported modes. |
| P1 | Backup/restore configurations (`backuptool`) | Add backup and restore with confirmation, archive-path/result display, and post-action guidance | Original backup contains an ES config glob; for the mini launcher, first verify its own config is included by ROCKNIX's backup rules. Do not claim launcher settings are backed up until verified. Restore overwrites configuration and may reboot. |
| P1 | Support file (`generateSupportFile`) | Add “Create support bundle” using the ROCKNIX-supported helper or a narrow curated diagnostic archive | Tell users what is collected; redact secrets, Wi-Fi credentials, tokens and personal ROM metadata; show output path and failure state. |
| P2 | Component reset (`factoryreset`) | Offer narrow, named resets only (audio, BatteryPlus calibration, possibly one emulator configuration if explicitly useful) | Never expose `factoryreset ALL`, overlay wipe, disk format, or broad emulator resets in the mini launcher. Confirm first and state restart/poweroff effects. |
| P2 | Update branch/check settings | Consider only read-only update status/channel display | Do not implement system image updates in the mini launcher until a recoverable, user-confirmed update flow is specified and verified. |
| Exclude | Gamelist cleanup, metadata/language detection, scraper, collections, themes, Bezel Project, boot game, ES UI modes/screensaver/font/layout | Do not add | These are original frontend/library functions, not system support controls. |
| Exclude | Factory reset all, disk formatting/install, full overlay deletion, raw arbitrary service toggles | Do not add | High-impact, hard-to-recover operations or unsafe generic controls. |

## Implementation sequence

1. Add a scrollable **System** section and a separate **Support & Recovery** section to the existing launcher UI; retain its top-level XMPlayer entry.
2. Replace hard-coded initial values with bounded reads of the actual device state. Represent each external operation as a result with success/failure and a user-readable status.
3. Add first: live system information, curated services/remote access, ZRAM, power saving/time zone/keyboard layout where supported, and backup/support actions.
4. Add confirmation dialogs for actions that restart services, reboot, restore files, calibrate hardware, reset a component, or power off. Never run destructive actions as a side effect of entering a page.
5. Gate controls by detected H700 capabilities and executable availability. Unsupported controls are omitted or marked unavailable; do not guess commands from another device family.
6. Keep desktop simulator guards for reboot/poweroff and add simulation-only command handling for the new actions.

## Acceptance checks

- Build the launcher through the H700 package in the current fork; do not validate against the upstream checkout.
- Exercise menu navigation/scrolling, return/cancel, live readouts, missing-command behavior, and success/failure feedback in the simulator.
- Verify H700 script names, config keys and service units against this branch before wiring each action.
- Confirm dangerous operations always require a second explicit confirmation and that no full factory reset, disk format, game-list maintenance, theme, scraper, collection, boot-game, or per-emulator item is present.
- Confirm backup/support output does not include Wi-Fi passwords, keys/tokens, or unrelated ROM/user data.
- Run the full `make docker-H700` build after implementation and inspect the resulting H700 artifacts.
