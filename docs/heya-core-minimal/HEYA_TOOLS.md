# Heya system tools

The H700 launcher exposes tools shipped by the image without EmulationStation.
Application labels are English. The existing scrolling list and scrollbar handle
all entries; unknown icons now use the application icon instead of losing the
icon column.

## Installed entries

| Label | Existing program |
| --- | --- |
| File Manager | Commander, native SDL file browser |
| Terminal | foot + bash |
| Gamepad Test | ROCKNIX GamepadTester |
| Midnight Commander | mc |
| System Monitor | btop |
| Process Manager | htop |
| Audio Mixer | alsamixer |
| System Information | rocknix-info |
| Storage Information | df and current mounts |
| Network Information | nmcli |
| USB Devices | lsusb |
| Input Devices | libinput |
| System Logs | journalctl |
| Kernel Logs | dmesg |
| Text Editor | nano, editing `/storage/.config/heya/notes.txt` |
| Cloud Backup | ROCKNIX cloud_backup/rclone |
| Cloud Restore | ROCKNIX cloud_restore/rclone |
| Clean macOS Metadata | Existing Remove ._ Files script |

XMPlayer remains an ordinary media application. Cloud operations use existing
rclone configuration; restore and cleanup require confirmation. CLI tools and
scripts intended only for use from other programs are available through Terminal.
Legacy emulator and PortMaster scripts are not shown when their programs are
absent. NFS is disabled in the current H700 configuration. Installation/reset
commands are not added as one-click applications.

Each packaged app has a `requires` file. The seeder checks these commands before
adding an entry. It saves the last system manifest in `/storage/heya/.system-apps`
and updates only unchanged system entries. Exact copies of the old Disk and
Terminal manifests are migrated; user-edited and user-added manifests survive.

## Fixes

The old Disk icon was missing from the icon map. Its command launched foot with
an unavailable UTF-8 locale and a nonexistent XMPlayer controller configuration.
File Manager now uses the already-installed Commander and its H700 controller
configuration, starting at `/storage`.

`heya-terminal` generates a persistent UTF-8 locale on first use, keeps its working
directory writable, and runs a dedicated controller mapper. SELECT emits F12 to
close the terminal and return; A is Enter, B is Escape, X is Tab, Y is q, shoulders
page up/down, and START is F10. Text entry still requires a keyboard. Mapper and
terminal children are cleaned up on exit. The launcher service also stops its
child processes on restart, avoiding leftover error windows.

## Validation and development deployment

- Heya Go suite passed with SDL's dummy drivers; icon fallback and 25-row scrolling
  have focused coverage.
- Seeder tests cover optional dependencies, old manifest migration, managed
  upgrades, and preservation of user customizations.
- All configured icon codepoints exist in the bundled Nerd Font.
- HX90 compiled the ARM64 launcher with the ROCKNIX toolchain.
- On RG34XX, Commander opened with the storage list, terminal output displayed
  correctly, and the launcher scrolled to its last row. Closing the terminal left
  no mapper process. Physical controller operation remains for the user to try.
- Cloud backup/restore and metadata removal were not executed during validation.

The device currently uses development overrides under `/storage/dev/usr/bin`
and `/storage/dev/usr/share/heya`. Writable app manifests invoke these through
`devexec`. The persistent service drop-in is
`/storage/.config/system.d/heya.service.d/30-tools.conf`; it selects the updated
icon map. Existing app and service configurations and screenshots are backed up
under `/storage/backup/heya-tools-before-20261028`.

These changes affect userspace. A production image update needs `SYSTEM` and
`SYSTEM.md5`; no KERNEL or whole-card rewrite is required. After installing that
image, the development drop-in and overrides can be removed together. The
managed app state lets the new image replace unedited development manifests with
its normal `/usr/bin` entrypoints.
