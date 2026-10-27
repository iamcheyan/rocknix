# Mini launcher screenshots

Captured from the H700 mini launcher (`handheld-launcher`) running in simulator
mode (`ROCKNIX_SIMULATOR=1`) at its native 720x480 resolution.

Regenerate with:

```sh
export DISPLAY=:20 XAUTHORITY=~/.local/state/webdesktop/Xauthority   # any X display
tools/capture-launcher-screenshots.sh
```

The script rebuilds the launcher, launches a fresh simulator instance per screen,
drives it with `xdotool`, and writes the PNGs into this directory.

| File | Screen |
|---|---|
| `01-main-menu.png` | Main menu: XMPlayer, control center, system tools, live info, power |
| `02-control-center.png` | Control center, first page (Wi-Fi, Bluetooth, USB, remote access) |
| `03-control-center-scrolled.png` | Control center scrolled to the radio/cursor/ADB/USB rows |
| `04-wifi-networks.png` | Wi-Fi scan and connect page (no networks in the simulator host) |
| `05-bluetooth-devices.png` | Bluetooth scan and pair page |
| `06-system-tools.png` | System tools: ZRAM status, diagnostic file, backup, restore, audio restart |
| `07-confirm-dialog.png` | Confirmation dialog shown before the backup action runs |
| `08-live-system-info.png` | Live system information read from `/proc` and `/sys` |
| `09-power-actions.png` | Power actions: restart UI, reboot, power off, cancel |

Values such as battery level, IP address and uptime come from the host running the
simulator; on the device they are read from the actual hardware. Missing sources are
shown as `Unavailable` rather than invented values.
