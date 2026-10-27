#!/usr/bin/env python3
"""Check the mini image's entrypoints and ELF library closure without running ARM code."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import sys


def resolve(root, path):
    parts = list(Path(os.path.normpath('/' + str(path).lstrip('/'))).parts[1:])
    for _ in range(40):
        for i in range(len(parts)):
            current = root.joinpath(*parts[:i + 1])
            if current.is_symlink():
                target = os.readlink(current)
                prefix = [] if target.startswith('/') else parts[:i]
                replacement = '/' + '/'.join(prefix + [target] + parts[i + 1:])
                parts = list(Path(os.path.normpath(replacement)).parts[1:])
                break
        else:
            return root.joinpath(*parts)
    raise ValueError(f'symlink loop: {path}')


def check(root, frontend=None):
    if frontend is None:
        frontend = 'pocketjs' if resolve(root, '/usr/share/pocketjs/pocket-profile.json').is_file() else 'heya'
    commands = [
        'heya', 'heya-control', 'xmplayer',
        'xmplayer-playback', 'mpv', 'gptokeyb', 'nmcli', 'evtest',
        'disk-browser', 'mc', 'rocknix-services',
    ]
    commands += ['pocket', 'pocket-session-run', 'commander', 'chvt'] if frontend == 'pocketjs' else ['foot']
    errors = []
    for command in commands:
        if not os.access(resolve(root, '/usr/bin/' + command), os.X_OK):
            errors.append(f'missing executable: /usr/bin/{command}')
    if not os.access(resolve(root, '/usr/sbin/rfkill'), os.X_OK):
        errors.append('missing executable: /usr/sbin/rfkill')
    for path in [
        '/usr/lib/bluetooth/bluetoothd', '/usr/config/SDL-GameControllerDB/gamecontrollerdb.txt',
        '/usr/lib/autostart/common/050-heya-apps',
        '/usr/lib/udev/rules.d/99-automount.rules', '/usr/lib/tmpfiles.d/rocknix-dirs.conf',
        '/usr/share/heya/apps/xmplayer/app.json', '/usr/share/heya/apps/disk/app.json',
        '/usr/lib/autostart/daemons/003-avahi', '/usr/lib/autostart/daemons/028-telnet',
        '/usr/lib/systemd/system/rsyncd.service', '/usr/lib/systemd/system/telnet.socket',
        '/usr/lib/systemd/system/http.service', '/usr/lib/systemd/system/proftpd.service',
    ]:
        if not resolve(root, path).is_file():
            errors.append(f'missing runtime file: {path}')
    if frontend == 'pocketjs':
        for path in ['/usr/libexec/pocket-linux-kms', '/usr/libexec/pocketjs-session',
                     '/usr/lib/systemd/system/pocketjs-kms.service',
                     '/usr/lib/systemd/system/pocketjs-recovery.service',
                     '/usr/share/pocketjs/apps/boot.pocket']:
            if not resolve(root, path).is_file():
                errors.append(f'missing PocketJS runtime file: {path}')
        if not os.access(resolve(root, '/sbin/agetty'), os.X_OK):
            errors.append('missing recovery console executable: /sbin/agetty')
        quirk = resolve(root, '/usr/lib/autostart/quirks/platforms/H700/090-ui_service')
        if not quirk.is_file() or 'UI_SERVICE="pocketjs-kms.service"' not in quirk.read_text():
            errors.append('H700 does not select the PocketJS startup service')
        for pattern in ['usr/bin/sway*', 'usr/bin/foot', 'usr/bin/weston*', 'usr/bin/Xwayland',
                        'usr/bin/mako*', 'usr/lib/libwayland*', 'usr/lib/libwlroots*',
                        'usr/lib/systemd/system/sway.service', 'usr/lib/systemd/system/heya.service']:
            for path in root.glob(pattern):
                errors.append(f'forbidden compositor runtime file: /{path.relative_to(root)}')
        try:
            profile = json.loads(resolve(root, '/usr/share/pocketjs/pocket-profile.json').read_text())['profile']
            if profile['id'] != 'rocknix-h700-kms' or profile['display']['physicalViewport'] != [720, 480]:
                errors.append('unexpected PocketJS profile or display geometry')
        except (OSError, ValueError, KeyError):
            errors.append('missing or invalid PocketJS profile export')
    elif not resolve(root, '/usr/lib/systemd/system/heya.service').is_file():
        errors.append('missing runtime file: /usr/lib/systemd/system/heya.service')
    for path in sorted((root / 'usr/share/xmplayer/bin').glob('*')):
        if path.name == 'gptokeyb2':
            errors.append('obsolete bundled gptokeyb2 still installed')
    entries = ['/usr/bin/' + name for name in ('heya', 'mpv', 'gptokeyb')]
    if frontend == 'pocketjs':
        entries += ['/usr/libexec/pocket-linux-kms', '/usr/bin/commander']
    entries += ['/usr/share/xmplayer/bin/' + name for name in ('love', 'ffmpeg', 'ffplay')]
    visited = set()
    for entry in entries:
        private = ['/usr/share/xmplayer/libs'] if '/xmplayer/' in entry else []
        pending = [entry]
        while pending:
            path = pending.pop()
            marker = (path, bool(private))
            if marker in visited:
                continue
            visited.add(marker)
            file = resolve(root, path)
            if not file.is_file():
                errors.append(f'missing ELF: {path}')
                continue
            with file.open('rb') as stream:
                magic = stream.read(4)
            if magic != b'\x7fELF':
                errors.append(f'expected ELF: {path}')
                continue
            header = subprocess.check_output(['readelf', '-h', str(file)], text=True)
            if 'AArch64' not in header:
                errors.append(f'not AArch64: {path}')
            dynamic = subprocess.check_output(['readelf', '-d', str(file)], text=True)
            program = subprocess.check_output(['readelf', '-l', str(file)], text=True)
            interpreter = re.search(r'Requesting program interpreter: ([^\]]+)', program)
            if interpreter and not resolve(root, interpreter[1]).is_file():
                errors.append(f'{path}: missing interpreter {interpreter[1]}')
            origin = str(Path(path).parent)
            rpaths = re.findall(r'\((?:RUNPATH|RPATH)\).*?\[([^\]]+)\]', dynamic)
            search = private + [item.replace('${ORIGIN}', origin).replace('$ORIGIN', origin)
                                for group in rpaths for item in group.split(':') if item.startswith('/') or '$ORIGIN' in item or '${ORIGIN}' in item]
            search += ['/usr/lib', '/lib', '/usr/lib64', '/lib64']
            for library in re.findall(r'\(NEEDED\).*?\[([^\]]+)\]', dynamic):
                for directory in search:
                    candidate = directory + '/' + library
                    if resolve(root, candidate).is_file():
                        pending.append(candidate)
                        break
                else:
                    errors.append(f'{path}: missing {library}')
    return sorted(set(errors))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('rootfs', type=Path)
    parser.add_argument('--frontend', choices=['heya', 'pocketjs'])
    args = parser.parse_args()
    root = args.rootfs.resolve()
    if not (root / 'usr').is_dir():
        parser.error('expected a built image/system root containing usr/')
    problems = check(root, args.frontend)
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print('Mini rootfs entrypoints and ELF dependencies: OK (hardware/ABI testing still required)')
