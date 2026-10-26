import importlib.util
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]


class MiniRuntime(unittest.TestCase):
    def test_absolute_library_links_stay_inside_image(self):
        spec = importlib.util.spec_from_file_location('mini_rootfs', ROOT / 'tools/check-mini-rootfs.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / 'usr/lib').mkdir(parents=True)
            (root / 'lib').symlink_to('/usr/lib')
            (root / 'usr/lib/libtest.so').symlink_to('libtest.so.1')
            (root / 'usr/lib/libtest.so.1').write_bytes(b'ELF fixture')
            self.assertEqual(module.resolve(root, '/lib/libtest.so'), root / 'usr/lib/libtest.so.1')

    def test_first_bluetooth_enable_does_not_require_a_backup(self):
        source = ROOT / 'projects/ROCKNIX/packages/rocknix/sources/scripts/rocknix-bluetooth'
        with tempfile.TemporaryDirectory() as directory:
            script = Path(directory) / 'bluetooth'
            script.write_text(source.read_text().replace('. /etc/profile', ':').replace('STORAGE_PATH="/storage"', f'STORAGE_PATH="{directory}/storage"'))
            result = subprocess.run(['bash', str(script), 'restore'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_failed_volume_write_does_not_save_a_false_level(self):
        source = ROOT / 'projects/ROCKNIX/packages/rocknix/sources/scripts/volume'
        with tempfile.TemporaryDirectory() as directory:
            persisted = Path(directory) / 'saved'
            functions = f'get_setting() {{ echo 50; }}\npactl() {{ return 7; }}\nset_setting() {{ touch "{persisted}"; }}'
            script = Path(directory) / 'volume'
            script.write_text(source.read_text().replace('. /etc/profile.d/001-functions', functions))
            result = subprocess.run(['bash', str(script), '65'], capture_output=True, text=True)
            self.assertEqual(result.returncode, 7)
            self.assertFalse(persisted.exists())


if __name__ == '__main__':
    unittest.main()
