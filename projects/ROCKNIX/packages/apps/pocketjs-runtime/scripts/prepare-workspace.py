#!/usr/bin/env python3
"""Select the Linux KMS workspace without changing upstream dependency pins."""
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tomllib


def external_packages(lock):
    return {(p['name'], p['version'], p['source'], p.get('checksum'))
            for p in lock['package'] if 'source' in p}


def prepare(source, cargo):
    manifest = source / 'Cargo.toml'
    lock = source / 'Cargo.lock'
    for file in [manifest, lock]:
        backup = file.with_name(file.name + '.upstream')
        if not backup.exists():
            shutil.copy2(file, backup)
    text = manifest.with_name('Cargo.toml.upstream').read_text()
    for key in ['members', 'default-members']:
        text, count = re.subn(r'(?ms)^' + key + r' = \[.*?^\]',
                              key + ' = ["programs/linux-kms"]', text, count=1)
        if count != 1:
            raise ValueError(f'upstream workspace has no recognized {key} declaration')
    manifest.write_text(text)
    subprocess.run([cargo, 'metadata', '--format-version', '1', '--manifest-path', str(manifest)],
                   check=True, stdout=subprocess.DEVNULL)
    upstream = tomllib.loads(lock.with_name('Cargo.lock.upstream').read_text())
    selected = tomllib.loads(lock.read_text())
    added = external_packages(selected) - external_packages(upstream)
    if added:
        names = ', '.join(sorted({name for name, *_ in added}))
        raise ValueError(f'dependencies differ from the pinned upstream lockfile: {names}')
    print(f'Linux KMS workspace: {len(selected["package"])} locked packages; upstream pins preserved')


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve(), sys.argv[2])
