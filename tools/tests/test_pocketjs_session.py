import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
import unittest

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'projects/ROCKNIX/packages/apps/pocketjs-runtime/scripts'


class PocketSession(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.log = self.root / 'calls.jsonl'
        self.env = dict(os.environ, PATH=f'{self.root}:{os.environ["PATH"]}',
                        CALLS=str(self.log), POCKETJS_CARD='/dev/dri/card7')

    def executable(self, name, source):
        path = self.root / name
        path.write_text(source)
        path.chmod(0o755)
        return path

    def calls(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()]

    def session(self, reject=''):
        runtime = self.executable('runtime', '''#!/usr/bin/env python3
import json, os, sys
with open(os.environ['CALLS'], 'a') as f:
    f.write(json.dumps(sys.argv[1:]) + '\\n')
if '--check' in sys.argv and sys.argv[2] == os.environ.get('REJECT'):
    sys.exit(9)
''')
        self.env['REJECT'] = reject
        source = (SCRIPTS / 'pocketjs-session').read_text()
        source = source.replace('/usr/libexec/pocket-linux-kms', str(runtime))
        source = source.replace('/storage/pocketjs', str(self.root / 'storage'))
        return self.executable('session', source)

    def test_invalid_user_package_falls_back_before_opening_display(self):
        app = str(self.root / 'invalid app.pocket')
        self.env['POCKETJS_APP'] = app
        result = subprocess.run([str(self.session(reject=app))], env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        default = '/usr/share/pocketjs/apps/boot.pocket'
        self.assertEqual(self.calls(), [
            ['--package', app, '--check'], ['--package', default, '--check'],
            ['--package', default, '--card', '/dev/dri/card7'],
        ])

    def test_invalid_system_package_never_opens_display(self):
        default = '/usr/share/pocketjs/apps/boot.pocket'
        self.env.pop('POCKETJS_APP', None)
        result = subprocess.run([str(self.session(reject=default))], env=self.env, capture_output=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(self.calls(), [['--package', default, '--check']])

    def native(self):
        self.executable('systemctl', '''#!/usr/bin/env python3
import json, os, sys
with open(os.environ['CALLS'], 'a') as f:
    f.write(json.dumps(['systemctl', *sys.argv[1:]]) + '\\n')
if sys.argv[1] == 'is-active':
    key = 'RECOVERY' if sys.argv[-1] == 'pocketjs-recovery.service' else 'ACTIVE'
    sys.exit(0 if os.environ.get(key) == '1' else 3)
''')
        self.executable('systemd-run', '''#!/usr/bin/env python3
import json, os, sys, time
with open(os.environ['CALLS'], 'a') as f:
    f.write(json.dumps(['systemd-run', *sys.argv[1:]]) + '\\n')
if os.environ.get('WAIT') == '1':
    time.sleep(60)
sys.exit(int(os.environ.get('APP_STATUS', '0')))
''')
        source = (SCRIPTS / 'pocket-session-run').read_text()
        return self.executable('native', source.replace('/run/lock', str(self.root / 'lock')))

    def test_native_failure_restores_ui_and_preserves_arguments_and_exit_status(self):
        self.env.update(ACTIVE='1', APP_STATUS='42')
        result = subprocess.run([str(self.native()), '/usr/bin/mpv', 'a movie.mp4'],
                                env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 42, result.stderr)
        calls = self.calls()
        self.assertIn(['systemctl', 'stop', 'pocketjs-kms.service'], calls)
        launch = next(call for call in calls if call[0] == 'systemd-run')
        self.assertEqual(launch[-3:], ['--', '/usr/bin/mpv', 'a movie.mp4'])
        self.assertEqual(calls[-2:], [['systemctl', 'stop', 'pocketjs-foreground.service'],
                                     ['systemctl', 'start', 'pocketjs-kms.service']])

    def test_native_does_not_start_a_previously_inactive_ui(self):
        self.env.update(ACTIVE='0', APP_STATUS='0')
        result = subprocess.run([str(self.native()), '/bin/true'], env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertNotIn(['systemctl', 'start', 'pocketjs-kms.service'], self.calls())

    def test_missing_native_command_leaves_display_untouched(self):
        result = subprocess.run([str(self.native())], env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(self.log.exists())

    def test_recovery_console_is_restored_if_it_owned_the_display(self):
        self.env.update(ACTIVE='0', RECOVERY='1')
        result = subprocess.run([str(self.native()), '/bin/true'], env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(self.calls()[-1], ['systemctl', 'start', 'pocketjs-recovery.service'])

    def test_interrupt_stops_foreground_service_and_releases_display_lock(self):
        self.env.update(ACTIVE='1', WAIT='1')
        script = self.native()
        process = subprocess.Popen([str(script), '/bin/true'], env=self.env,
                                   stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        self.addCleanup(lambda: process.poll() is None and process.kill())
        deadline = time.monotonic() + 5
        while time.monotonic() < deadline:
            if self.log.exists() and any(call[0] == 'systemd-run' for call in self.calls()):
                break
            time.sleep(0.02)
        else:
            self.fail('foreground service was not launched')
        blocked = subprocess.run([str(script), '/bin/true'], env=self.env, capture_output=True)
        self.assertEqual(blocked.returncode, 1)
        self.assertIn(b'owns the display', blocked.stderr)
        process.terminate()
        _, stderr = process.communicate(timeout=5)
        self.assertEqual(process.returncode, 143, stderr)
        self.assertEqual(self.calls()[-1], ['systemctl', 'start', 'pocketjs-kms.service'])
        self.env['WAIT'] = '0'
        result = subprocess.run([str(script), '/bin/true'], env=self.env, capture_output=True)
        self.assertEqual(result.returncode, 0, result.stderr)


if __name__ == '__main__':
    unittest.main()
