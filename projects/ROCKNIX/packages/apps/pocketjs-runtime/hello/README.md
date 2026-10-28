# H700 boot application

The package host build typechecks and compiles this app into `boot.pocket` for
`rocknix-h700-kms` (720x480, native presentation). The app is installed under
`/usr/share/pocketjs/apps` and records button presses on screen.

This is the direct-display bring-up interface. It does not implement the heya
application catalog or settings. Native apps can be run through
`pocket-session-run COMMAND [ARG...]` over SSH.
