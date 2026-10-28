#!/usr/bin/env python3
"""Select the Linux KMS workspace without changing upstream dependency pins."""
from pathlib import Path
import json
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
    upstream = tomllib.loads(lock.with_name('Cargo.lock.upstream').read_text())
    quickjs = [p for p in upstream['package'] if p['name'] == 'rquickjs' and p.get('source', '').startswith('registry+')]
    if len(quickjs) != 1:
        raise ValueError('expected one pinned registry rquickjs package')
    shim = source / 'programs/rocknix-bindings'
    (shim / 'src').mkdir(parents=True, exist_ok=True)
    (shim / 'src/lib.rs').write_text('')
    (shim / 'Cargo.toml').write_text(
        '[package]\nname = "rocknix-pocketjs-bindings"\nversion = "0.0.0"\nedition = "2021"\n'
        '[dependencies]\nrquickjs = { version = "=' + quickjs[0]['version'] + '", features = ["bindgen"] }\n')
    text = manifest.with_name('Cargo.toml.upstream').read_text()
    for key in ['members', 'default-members']:
        text, count = re.subn(r'(?ms)^' + key + r' = \[.*?^\]',
                              key + ' = ["programs/linux-kms", "programs/rocknix-bindings"]', text, count=1)
        if count != 1:
            raise ValueError(f'upstream workspace has no recognized {key} declaration')
    manifest.write_text(text)
    shutil.copy2(lock.with_name('Cargo.lock.upstream'), lock)
    result = subprocess.run([cargo, 'metadata', '--format-version', '1', '--manifest-path', str(manifest)],
                            capture_output=True, text=True)
    if result.returncode:
        print(result.stderr, file=sys.stderr)
        result.check_returncode()
    metadata = json.loads(result.stdout)
    selected = tomllib.loads(lock.read_text())
    added = external_packages(selected) - external_packages(upstream)
    pinned = {(name, version, source) for name, version, source, _ in external_packages(upstream)}
    resolved = {(p['name'], p['version'], p['source'])
                for p in metadata['packages'] if p.get('source')}
    if resolved - pinned:
        raise ValueError('resolved Cargo metadata differs from the pinned upstream dependencies')
    if added:
        names = ', '.join(sorted({name for name, *_ in added}))
        raise ValueError(f'dependencies differ from the pinned upstream lockfile: {names}')
    print(f'Linux KMS workspace: {len(selected["package"])} locked packages; upstream pins preserved')


if __name__ == '__main__':
    prepare(Path(sys.argv[1]).resolve(), sys.argv[2])
