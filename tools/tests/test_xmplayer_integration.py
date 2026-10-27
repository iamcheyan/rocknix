import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
import shutil

ROOT = Path(__file__).resolve().parents[2]


class XMPlayerIntegration(unittest.TestCase):
    @unittest.skipUnless(shutil.which("love") and shutil.which("ffmpeg"), "needs native LÖVE and FFmpeg")
    def test_music_decodes_pcm_through_the_real_love_worker(self):
        app = ROOT / "projects/ROCKNIX/packages/apps/xmplayer/app"
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            harness = work / "harness"
            shutil.copytree(ROOT / "tools/tests/xmplayer-audio", harness)
            shutil.copytree(app / "workers", harness / "workers")
            shutil.copytree(app / "core", harness / "core")
            fixture = work / "track 'with spaces'.flac"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i",
                            "sine=frequency=440:duration=6", str(fixture)], check=True)
            env = dict(os.environ, XMPLAYER_APP_DIR=str(app), XMPLAYER_TEST_AUDIO=str(fixture),
                       XMPLAYER_SIMULATOR="1", XMPLAYER_FFMPEG=shutil.which("ffmpeg"),
                       SDL_VIDEODRIVER="dummy", ALSOFT_DRIVERS="null")
            result = subprocess.run(["love", str(harness)], env=env, capture_output=True,
                                    text=True, timeout=12)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            self.assertIn("PCM decoding and playback passed", result.stdout)

    def test_heya_preview_uses_json_application_entries(self):
        with tempfile.TemporaryDirectory() as directory:
            env = dict(os.environ, ROCKNIX_SIMULATOR_STATE=directory)
            subprocess.run(["bash", str(ROOT / "tools/run-heya-simulator.sh"), "--prepare-only"],
                           env=env, check=True)
            app = json.loads((Path(directory) / "apps/xmplayer/app.json").read_text())
            self.assertEqual(app["id"], "xmplayer")
            self.assertEqual(app["manifestVersion"], 1)
            self.assertEqual(Path(app["entrypoint"]), ROOT / "tools/run-xmplayer-simulator.sh")

    def test_host_runner_selects_native_ffmpeg_and_preserves_data_directory(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            capture = work / "capture.json"
            native = work / "bin"
            native.mkdir()
            for name in ("mpv", "ffmpeg", "ffplay"):
                file = native / name
                file.write_text("#!/bin/sh\nexit 0\n")
                file.chmod(0o755)
            love = native / "love"
            love.write_text("#!/usr/bin/env python3\nimport json,os,sys\n"
                            "from pathlib import Path\n"
                            "Path(os.environ['CAPTURE']).write_text(json.dumps(dict("
                            "args=sys.argv[1:],cwd=os.getcwd(),env=dict(os.environ))))\n")
            love.chmod(0o755)
            env = dict(os.environ, PATH=f"{native}:{os.environ['PATH']}",
                       CAPTURE=str(capture), XMPLAYER_DATA_DIR=str(work / "data with spaces"))
            subprocess.run([str(ROOT / "tools/run-xmplayer-simulator.sh")], env=env, check=True)
            result = json.loads(capture.read_text())
            self.assertEqual(result["env"]["XMPLAYER_FFMPEG"], str(native / "ffmpeg"))
            self.assertEqual(result["env"]["XMPLAYER_DATA_DIR"], env["XMPLAYER_DATA_DIR"])
            self.assertEqual(result["cwd"], result["args"][0])
            self.assertTrue((Path(result["cwd"]) / "main.lua").is_file())

    def test_external_player_cleans_up_only_its_mapper_and_preserves_exit_status(self):
        with tempfile.TemporaryDirectory() as directory:
            work = Path(directory)
            trace = work / "trace"
            for name, body in (
                ("mpv", "sleep 0.3\nexit 7\n"),
                ("gptokeyb", 'echo started >> "$TRACE"\n'
                 'trap \'echo stopped >> "$TRACE"; exit 0\' TERM\n'
                 "while :; do sleep 0.05; done\n"),
            ):
                file = work / name
                file.write_text("#!/bin/sh\n" + body)
                file.chmod(0o755)
            env = dict(os.environ, PATH=f"{work}:{os.environ['PATH']}", TRACE=str(trace),
                       XMPLAYER_SIMULATOR="0")
            script = ROOT / "projects/ROCKNIX/packages/apps/xmplayer/scripts/xmplayer-playback"
            result = subprocess.run([str(script), str(work / "mpv")], env=env, timeout=5)
            self.assertEqual(result.returncode, 7)
            self.assertEqual(trace.read_text().splitlines(), ["started", "stopped"])


if __name__ == "__main__":
    unittest.main()
