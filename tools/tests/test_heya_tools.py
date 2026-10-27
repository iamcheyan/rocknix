import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest


ROOT = Path(__file__).resolve().parents[2]
PACKAGE = ROOT / "projects/ROCKNIX/packages/apps/heya"


class HeyaToolsTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.source = self.root / "system"
        shutil.copytree(PACKAGE / "apps", self.source)
        self.target = self.root / "apps"
        self.state = self.root / "state"
        self.bin = self.root / "bin"
        self.bin.mkdir()
        for utility in ("mkdir", "cp", "mv", "rm", "cmp"):
            (self.bin / utility).symlink_to(shutil.which(utility))
        for requirements in self.source.glob("*/requires"):
            commands = []
            for command in requirements.read_text().splitlines():
                stub = self.bin / Path(command).name
                commands.append(str(stub) if command.startswith("/") else command)
                if not stub.exists():
                    stub.write_text("#!/bin/sh\nexit 0\n")
                    stub.chmod(0o755)
            requirements.write_text("\n".join(commands) + "\n")
        self.env = dict(os.environ, PATH=str(self.bin),
                        HEYA_SYSTEM_APPS=str(self.source), HEYA_USER_APPS=str(self.target),
                        HEYA_APP_STATE=str(self.state), HEYA_LEGACY_APPS=str(PACKAGE / "legacy-apps"),
                        HEYA_REMOVED_APPS=str(self.root / "removed"))

    def seed(self):
        subprocess.run(["/bin/sh", str(PACKAGE / "autostart/050-heya-apps")],
                       env=self.env, check=True, capture_output=True)

    def test_catalog_icons_and_dependencies(self):
        icons = json.loads((PACKAGE / "assets/icons.json").read_text())
        for path in self.source.glob("*/app.json"):
            manifest = json.loads(path.read_text())
            self.assertEqual(manifest["id"], path.parent.name)
            self.assertIn(manifest["icon"], icons)
            self.assertTrue((path.parent / "requires").is_file())

    def test_seed_updates_managed_entries_and_preserves_customizations(self):
        self.seed()
        self.assertEqual(len(list(self.target.glob("*/app.json"))), 18)
        custom = self.target / "terminal/app.json"
        custom.write_text('{"name":"My shell"}\n')
        updated = self.source / "disk/app.json"
        data = json.loads(updated.read_text())
        data["description"] = "Updated file manager"
        updated.write_text(json.dumps(data))
        self.seed()
        self.assertEqual((self.target / "disk/app.json").read_bytes(), updated.read_bytes())
        self.assertEqual(custom.read_text(), '{"name":"My shell"}\n')

    def test_missing_tool_is_hidden_and_unmodified_legacy_disk_is_migrated(self):
        (self.bin / "btop").unlink()
        (self.target / "disk").mkdir(parents=True)
        shutil.copyfile(PACKAGE / "legacy-apps/disk.json", self.target / "disk/app.json")
        self.seed()
        self.assertFalse((self.target / "monitor/app.json").exists())
        self.assertEqual((self.target / "disk/app.json").read_bytes(),
                         (self.source / "disk/app.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
