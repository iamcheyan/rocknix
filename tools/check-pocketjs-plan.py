#!/usr/bin/env python3
"""Reject compositor packages from a resolved H700 PocketJS build plan."""
import argparse
from pathlib import Path
import re
import sys

FORBIDDEN = {
    'wayland', 'wayland-protocols', 'sway', 'swaywm-env', 'wlroots', 'foot',
    'weston', 'weston-kiosk-shell-dpms', 'xwayland', 'mako-osd', 'mako-notify',
    'layer-shell-qt', 'qtwayland', 'qterminal',
}

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan', type=Path)
    args = parser.parse_args()
    steps = re.findall(r'^(build|install)\s+(\S+)', args.plan.read_text(), re.M)
    packages = {package.split(':')[0] for _, package in steps}
    errors = [f'forbidden dependency: {package}' for package in sorted(packages & FORBIDDEN)]
    if ('install', 'pocketjs-runtime') not in steps:
        errors.append('PocketJS runtime is not installed by this plan')
    if ('build', 'pocketjs-runtime:host') not in steps:
        errors.append('PocketJS application/profile host build is missing')
    if errors:
        print('\n'.join(errors), file=sys.stderr)
        sys.exit(1)
    print(f'H700 PocketJS plan: {len(steps)} steps, no Wayland/Sway dependency')
