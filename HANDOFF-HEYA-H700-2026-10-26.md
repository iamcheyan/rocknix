# HeYa / ROCKNIX H700 handoff

## Repositories and branches

- ROCKNIX: `~/development/rocknix`, branch `heya-core-minimal`, remote `iamcheyan/rocknix`.
- HeYa: `~/development/heya`, branch `master`, remote `iamcheyan/heya`.
- HeYa changes are committed and pushed as `bca7c0510ac6c857b55c9532b9165dd332b8477c`.
- ROCKNIX pins that HeYa commit and its GitHub archive SHA-256 in `projects/ROCKNIX/packages/apps/heya/package.mk`.

## Implemented

- H700 physical A confirms and B backs out. Direction pad, L/R, Start and Select follow the H700 GameControllerDB. X/Y remain unassigned in HeYa. XMPlayer A/B mappings were corrected too.
- B on HeYa's root apps page does nothing, so it no longer quits and flashes the launcher. F10 remains the explicit quit key.
- Wi-Fi passwords and Bluetooth PIN/passkey entry are visible while typing.
- The System page shows the current USB mode and opens USB settings: MTP file transfer, USB ADB, USB network, charge only, Wireless ADB on and off. These call the existing `/usr/bin/usbgadget` commands.
- MTP is the existing safe file-transfer mode. The old control center called it “MTP PC Disk”; it did not expose the SD card as raw USB Mass Storage.
- H700 explicitly includes `umtprd` and `adbd`. `adbd` is no longer started as an always-on service; USB and Wireless ADB start it on demand, avoiding a prestarted daemon taking the FunctionFS endpoint.
- H700 images default to `ssh.enabled=1`. SSH uses the existing default credentials: `root` / `rocknix`.

## Verification

- HX90: `go test ./... -count=1` passed for every HeYa package. The host `PKG_CONFIG_PATH` used SDL2 and SDL2_ttf from Nix.
- `bash -n projects/ROCKNIX/packages/rocknix/sources/scripts/usbgadget` passed.
- `git diff --check` passed for both repositories before committing.
- H700 kernel config contains ConfigFS, FunctionFS gadget, NCM, and Mass Storage support; the RG34XX USB OTG board patch is present.

## Still required on the handheld / build host

- Build a fresh H700 DDR4 image on HX90 with the updated HeYa pin. No image has been built or written to the TF card in this change.
- On the RG34XX, check A/B and root-page B behavior; test MTP enumeration/file transfer; use a PC to run `adb devices` and `adb shell` in USB ADB mode; test Wireless ADB with `adb connect <device-ip>:5555`.
- Check SSH over Wi-Fi with `ssh root@<device-ip>` and the existing `rocknix` password.
- ADB hardware enumeration and SSH login have not yet been tested on the handheld.

## 2026-10-26 follow-up

Full details, file list and verification: `docs/heya-core-minimal/WORKLOG_2026-10-26.md`.

- Sonata was removed from the image and from the heya app list; XMPlayer is the only media app.
- New heya `Disk` app opens midnight commander on `/storage` and mounted SD cards, mapped through `xmplayer/config/disk.gptk`.
- `system.cfg` now carries `adbd`, `avahi`, `ftp`, `http`, `rsyncd`, `samba`, `syncthing`, `telnet` and `ssh` toggles. `rocknix-services` lists/toggles them, `098-devservices` starts the enabled ones at boot, `099-networkservices` stops the disabled ones, and heya reaches them via `heya-control service KEY on|off`.
- Resulting packages: proftpd and telnet units are built into the image, rsyncd/http units ship with their packages, and busybox now builds `telnetd`.
