# PocketShell POC

PocketShell replaces the PocketJS boot menu with a five workspace terminal shell for the RG34XX 720×480 display. Each workspace owns a Linux PTY and child process inside the PocketJS host runtime. The host PTY manager starts the five workspaces and feeds captured output to the PocketJS app through the existing frame callback.

## Workspaces

- WS1 starts `/bin/sh`.
- WS2 starts `ranger`, falls back to `lf`, then `/bin/sh`.
- WS3 starts `vim`, then `/bin/vi`.
- WS4 starts `htop`, then `top`.
- WS5 returns the PocketShell runtime event log.

## Input

L/R switch workspaces. L1/R1 move the buffer by a page. Up/Down scroll output. A sends Enter. B returns to WS1. START cycles the workspace list. SELECT opens a command prompt on WS1. Text input is forwarded through PocketJS `input.text` when the platform supports it.

## Build and run

The normal ROCKNIX H700 build compiles `hello/main.tsx` into `boot.pocket`, patches the pinned PocketJS runtime with the PocketShell PTY manager, and builds `pocket-linux-kms`. Runtime logs are available through the WS5 buffer.

## Verification

Host-side checks were run against the exact pinned PocketJS revision (`e677037`) with the patch applied:

- `cargo build --release -p pocket-linux-kms` succeeds; the resulting runtime loads the compiled `boot.pocket` and completes 180 headless logical ticks at 720×480.
- `pocket compile` produces the app package with no warnings (59 modules, 20 style records, 3 font slots).
- Two host unit tests pass: WS1 starts a real PTY, survives frame polling, and echoes `echo pocketshell-ok` back through the frame channel; WS5 replays recorded lifecycle events.

These are host-build results. Physical RG34XX display, button mapping, and process persistence across a full boot are still unverified.

## POC limits

For full terminal apps, the next renderer phase must implement VT cursor state, ANSI styling, alternate screens, and resize negotiation. Keyboard text input is available only on a platform that supplies PocketJS `input.text`; this H700 build exposes gamepad buttons. Physical RG34XX verification remains required for screen output, button mappings, process persistence, and event logging.

Future workspace providers register an ID and process/PTY factory; adding an SSH or agent workspace should not require changes to the workspace switcher.
