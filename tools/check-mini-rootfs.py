#!/usr/bin/env python3
"""Check the mini image's entrypoints and ELF library closure without running ARM code."""
import argparse
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


def check(root):
    commands = [
        'heya', 'heya-control', 'sonata', 'sonata-launch', 'xmplayer',
        'xmplayer-playback', 'mpv', 'foot', 'gptokeyb', 'nmcli', 'rfkill', 'evtest',
    ]
    errors = []
    for command in commands:
        if not os.access(resolve(root, '/usr/bin/' + command), os.X_OK):
            errors.append(f'missing executable: /usr/bin/{command}')
    for path in [
        '/usr/lib/bluetooth/bluetoothd', '/usr/config/SDL-GameControllerDB/gamecontrollerdb.txt',
        '/usr/lib/systemd/system/heya.service', '/usr/lib/autostart/common/050-heya-apps',
        '/usr/lib/udev/rules.d/99-automount.rules', '/usr/lib/tmpfiles.d/rocknix-dirs.conf',
        '/usr/share/heya/apps/sonata/app.json', '/usr/share/heya/apps/xmplayer/app.json',
    ]:
        if not resolve(root, path).is_file():
            errors.append(f'missing runtime file: {path}')
    for path in sorted((root / 'usr/share/xmplayer/bin').glob('*')):
        if path.name == 'gptokeyb2':
            errors.append('obsolete bundled gptokeyb2 still installed')
    entries = ['/usr/bin/' + name for name in ('heya', 'sonata', 'mpv', 'foot', 'gptokeyb')]
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
    args = parser.parse_args()
    root = args.rootfs.resolve()
    if not (root / 'usr').is_dir():
        parser.error('expected a built image/system root containing usr/')
    problems = check(root)
    for problem in problems:
        print(problem, file=sys.stderr)
    if problems:
        sys.exit(1)
    print('Mini rootfs entrypoints and ELF dependencies: OK (hardware/ABI testing still required)')
