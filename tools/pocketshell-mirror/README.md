# RG34XX LCD mirror

Reads the active DRM plane on the RG34XX, relays it over HX90 ADB, and serves JPEG snapshots at up to 2.5 fps. This shows the actual LCD scanout, including its current PocketJS workspace. Buttons inject press/release events into the existing H700 Gamepad event device; they do not control independent terminal sessions.

Build `capture.c` with the H700 cross compiler and libdrm, then install it at `/storage/pocketshell-dev/capture` on the handheld. Run `server.py` on a host with Python Pillow and SSH access to `hx90`; bind a specific private LAN address through `POCKET_MIRROR_BIND`. Default is loopback, port 8081. The current hardware mapping is DRM card1 and Gamepad event3; verify these after hardware changes.

The relay requires the handheld attached to HX90 ADB. It reads the first active linear XRGB/ARGB plane, not a composition of multiple hardware planes. Browser requests are same-origin checked; this development viewer has no authentication and must stay on a trusted LAN. Stop the active transient user service with `systemctl --user stop rg34xx-mirror`.

Verified on RG34XX: actual 720x480 capture, browser image decode, and START input changing the rendered workspace from Shell to VIM. No SYSTEM or KERNEL replacement is needed for this storage-installed diagnostic helper.
