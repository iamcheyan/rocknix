# 2026-10-28 integration

Main integrates platform architecture documentation, Remote Dev, the filesystem OTA simulator, Library and Capability Explorer. Shell remains the default boot app; Library and Showcase are separately compiled and installed as library.pocket and showcase.pocket. Select an app with POCKETJS_APP in the existing runtime environment configuration.

Remote Dev creates independent PTY workspaces; it does not attach to the running KMS frontend. The optional service remains off and its wrapper defaults to loopback. Remote use requires an explicit bind setting or a tunnel. OTA remains a filesystem simulator, without device A/B activation.

Integration repairs package syntax, repository-relative build paths, hotkey service installation, compiler cache setup, Rust compiler selection, Input Workspace JSX/styles/font sizes, splash patch applicability and glyph sequence, and canceled/manual OTA rollback state.

Validation: 17 Python tests, 20 Rust unit tests and one protocol integration test passed; Library model verification passed. H700 compilation validates all three guest packages. Full image build and device update results are recorded after completion.

Historical dirty worktrees remain untouched. HX90 edits were preserved in development/rocknix-backup-20261028 before source synchronization. Device SYSTEM and KERNEL backups are under /storage/update-backup-20261028; older flash backups and recovered FAT files were moved into its old-flash directory to free boot partition space.
