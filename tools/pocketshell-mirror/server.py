#!/usr/bin/env python3
"""LAN viewer for the RG34XX active DRM plane, relayed through HX90 ADB."""
import io
import os
import json
import subprocess
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from PIL import Image

KEYS = dict(UP=544, DOWN=545, LEFT=546, RIGHT=547, A=304, B=305,
            X=307, Y=308, L=310, R=311, L1=312, R1=313, START=315, SELECT=314)
lock = threading.Lock()
frame = b''
error = 'Connecting to handheld'
sequence = 0

def device(*args):
    return subprocess.check_output(['ssh', '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=3',
                                    'hx90', 'adb', *args], timeout=6)

def capture():
    global frame, error, sequence
    while True:
        started = time.monotonic()
        try:
            with lock:
                raw = device('exec-out', '/storage/pocketshell-dev/capture')
            image = Image.open(io.BytesIO(raw))
            image.load()
            output = io.BytesIO()
            image.save(output, 'JPEG', quality=85)
            frame = output.getvalue()
            sequence += 1
            error = ''
        except Exception as exc:
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
            with lock:
                device('shell', '/storage/pocketshell-dev/capture', 'key', '/dev/input/event3', str(KEYS[key]))
            self.send(200, b'ok', 'text/plain')
        except Exception as exc:
            self.send(503, str(exc).encode(), 'text/plain')

    def log_message(self, *args):
        pass

if __name__ == '__main__':
    threading.Thread(target=capture, daemon=True).start()
    ThreadingHTTPServer((os.environ.get('POCKET_MIRROR_BIND', '127.0.0.1'), 8081), Handler).serve_forever()
