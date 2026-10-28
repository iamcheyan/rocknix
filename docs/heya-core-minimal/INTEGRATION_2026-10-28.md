# 2026-10-28 integration

Main integrates platform architecture documentation, Remote Dev, the filesystem OTA simulator, Library and Capability Explorer. Shell remains the default boot app; Library and Showcase are separately compiled and installed as library.pocket and showcase.pocket. Select an app with POCKETJS_APP in the existing runtime environment configuration.

Remote Dev creates independent PTY workspaces; it does not attach to the running KMS frontend. The optional service remains off and its wrapper defaults to loopback. Remote use requires an explicit bind setting or a tunnel. OTA remains a filesystem simulator, without device A/B activation.

Integration repairs package syntax, repository-relative build paths, hotkey service installation, compiler cache setup, Rust compiler selection, Input Workspace JSX/styles/font sizes, splash patch applicability and glyph sequence, and canceled/manual OTA rollback state.

Validation: 17 Python tests, 20 Rust unit tests and one protocol integration test passed; Library model verification passed. H700 compilation validates all three guest packages. Full image build and device update results are recorded after completion.

Historical dirty worktrees remain untouched. HX90 edits were preserved in development/rocknix-backup-20261028 before source synchronization. Device SYSTEM and KERNEL backups are under /storage/update-backup-20261028; older flash backups and recovered FAT files were moved into its old-flash directory to free boot partition space.

## Build and device delivery

HX90 full H700 aarch64 build exited 0. Artifacts: `target/ROCKNIX-H700.aarch64-20261028-DDR4.img.gz` and `target/ROCKNIX-H700.aarch64-20261028.tar`; both SHA-256 sidecars verified. Final rootfs entrypoint/ELF dependency check passed.

Additional review fixes include browser log retention, reconnect sequence reset, control-character filtering, canonical Library roots, symlink exclusion, and UTF-8 byte offsets. Three browser regression tests, Library bridge Rust regression and updated model verification passed.

RG34XX updated through HX90 ADB using only SYSTEM/KERNEL plus their MD5 files, extracted with no ownership/permission preservation. Uploaded `.new` files were read back and matched before renaming. Existing U-Boot, dtb.img, extlinux configuration and STORAGE were preserved. The boot partition was synchronized and remounted read-only.

Device reboot verified: kernel build timestamp `Wed Oct 28 13:06:55 UTC 2026`; pocketjs-kms active with zero restarts; all three app packages admitted by runtime `--check`. SYSTEM MD5 `9985242ad0e26c78f09c96f2ad7b932f`; KERNEL MD5 `24a7e84888f9fec5c0d87ae4d79edfdb`. Remote Dev remains inactive. Existing rocknix-usbgadget service still reports exit status 1, as before the update; ADB works. Physical screen/controller acceptance was not performed.
