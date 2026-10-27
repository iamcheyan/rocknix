#!/usr/bin/env sh
set -eu
/usr/bin/python3 /usr/share/rocknix-desktop/mock-services.py &
exec /usr/bin/sleep infinity
