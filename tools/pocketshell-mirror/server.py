#!/usr/bin/env python3
"""LAN viewer for the RG34XX active DRM plane, relayed through HX90 ADB."""
import io
import os
import json
import shlex
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image

KEYS = dict(UP=544, DOWN=545, LEFT=546, RIGHT=547, A=305, B=304,
            X=307, Y=308, L=310, R=311, L1=312, R1=313, START=315, SELECT=314)
lock = threading.Lock()
frame = b''
error = 'Connecting to handheld'
sequence = 0

# Probe script run on the device. Finds the H700 gamepad event node by name and
# the DRM card that has a connected connector, so neither is hardcoded. Falls
# back to event3 / card1 (the historical values) when probing fails.
PROBE_SHELL = (
    "ev=; for e in /dev/input/event*; do "
    "n=$(cat /sys/class/input/$(basename $e)/device/name 2>/dev/null); "
    "case \"$n\" in *Gamepad*) ev=$e; break;; esac; done; "
    "card=; for d in /sys/class/drm/card[0-9]; do "
    "[ -e \"$d\" ] || continue; "
    "if grep -qs connected \"$d\"-*/status; then card=/dev/dri/$(basename \"$d\"); break; fi; "
    "done; "
    "echo \"${ev:-/dev/input/event3} ${card:-/dev/dri/card1}\""
)

probe_lock = threading.Lock()
probe_cache = {'event': None, 'card': None}


def device(*args):
    return subprocess.check_output(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3',
                                    'hx90', 'adb', *args], timeout=6)


def device_script(script):
    # One ssh argument, quoted for the remote login shell, so the device runs
    # the script as a single command.
    return subprocess.check_output(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3',
                                    'hx90', 'adb shell ' + shlex.quote(script)], timeout=6)


def probe():
    """Resolve (gamepad_event_node, drm_card), cached; re-probed after failures."""
    with probe_lock:
        if probe_cache['event'] and probe_cache['card']:
            return probe_cache['event'], probe_cache['card']
        try:
            out = device_script(PROBE_SHELL).decode().split()
            probe_cache['event'] = out[0] if out else '/dev/input/event3'
            probe_cache['card'] = out[1] if len(out) > 1 else '/dev/dri/card1'
        except Exception:
            probe_cache['event'] = probe_cache['event'] or '/dev/input/event3'
            probe_cache['card'] = probe_cache['card'] or '/dev/dri/card1'
        return probe_cache['event'], probe_cache['card']


def invalidate_probe():
    with probe_lock:
        probe_cache['event'] = None
        probe_cache['card'] = None


def capture():
    global frame, error, sequence
    while True:
        started = time.monotonic()
        try:
            _, card = probe()
            with lock:
                raw = device('exec-out', '/storage/pocketshell-dev/capture', card)
            image = Image.open(io.BytesIO(raw))
            image.load()
            output = io.BytesIO()
            image.save(output, 'JPEG', quality=85)
            frame = output.getvalue()
            sequence += 1
            error = ''
        except Exception as exc:
            invalidate_probe()
            error = str(exc)
        time.sleep(max(0.05, 0.4 - (time.monotonic() - started)))


class Handler(BaseHTTPRequestHandler):
    def send(self, code, content, kind):
        self.send_response(code)
        self.send_header('Content-Type', kind)
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Content-Length', str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def do_GET(self):
        if self.path == '/':
            self.send(200, Path(__file__).with_name('index.html').read_bytes(), 'text/html; charset=utf-8')
        elif self.path.startswith('/frame.jpg'):
            self.send(200 if frame else 503, frame or error.encode(), 'image/jpeg' if frame else 'text/plain')
        elif self.path == '/status':
            self.send(200, json.dumps(dict(sequence=sequence, error=error)).encode(), 'application/json')
        else:
            self.send(404, b'not found', 'text/plain')

    def do_POST(self):
        if self.headers.get('Origin') not in (None, 'http://' + self.headers.get('Host', '')):
            self.send(403, b'origin rejected', 'text/plain'); return
        key = self.path.removeprefix('/key/') if self.path.startswith('/key/') else ''
        if key not in KEYS:
            self.send(400, b'unknown key', 'text/plain'); return
        try:
            event, _ = probe()
            with lock:
                device('shell', '/storage/pocketshell-dev/capture', 'key', event, str(KEYS[key]))
            self.send(200, b'ok', 'text/plain')
        except Exception as exc:
            invalidate_probe()
            self.send(503, str(exc).encode(), 'text/plain')

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    threading.Thread(target=capture, daemon=True).start()
    ThreadingHTTPServer((os.environ.get('POCKET_MIRROR_BIND', '127.0.0.1'), 8081), Handler).serve_forever()
