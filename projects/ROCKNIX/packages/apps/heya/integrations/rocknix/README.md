# ROCKNIX integration

The authoritative package recipe, heya-control helper, first-boot app seeder and
H700 frontend quirk live in [iamcheyan/rocknix](https://github.com/iamcheyan/rocknix/tree/heya-core-minimal/projects/ROCKNIX/packages/apps/heya).
ROCKNIX downloads a pinned heya source archive and builds it with its ARM64 Go/SDL2
toolchain. The local desktop preview builds the sibling heya checkout instead.

On the H700 KMS image, the boot sequence is rocknix-autostart → H700 quirks →
app seeder → PocketJS. The heya package installs its ROCKNIX service from the
authoritative package recipe; this directory contains integration assets only.

When `DEVELOPER_MODE=true` (or `PROJECT_DEVELOPER_MODE=true`) is set for the
ROCKNIX build, the package builds and installs `/usr/bin/devexec` and rewrites
`heya.service` to execute `/usr/bin/devexec /usr/bin/heya ...`. The helper checks
only `/storage/dev/usr/bin/heya`; with no override it execs the immutable SYSTEM
binary. The package and unit keep their normal direct-exec form when the option is
unset or false. Set the option before building; changing it requires rebuilding the
`heya` package/image configuration.

Applications live in /storage/heya/apps/<id>/app.json. The active JSON theme is
/storage/heya/themes/theme.json. Existing user manifests and themes are preserved.
Wi-Fi profiles are saved by NetworkManager, Bluetooth bonds by BlueZ, and basic
controls persist through the ROCKNIX settings helper.

See the ROCKNIX device checklist for HX90 builds and hardware validation. Source
and desktop tests do not establish that a device image boots or plays audio.
