#!/usr/bin/env python3
"""Serve deterministic ROCKNIX hardware/service fixtures on container loopback."""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import os
from pathlib import Path

FIXTURE_ROOT = Path(os.environ.get("ROCKNIX_FIXTURES_DIR", "/run/rocknix-mocks"))
ENDPOINTS = {
    "/battery/status": "battery/status",
    "/network/status": "network/status",
    "/storage/status": "storage/status",
}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self):
        fixture = ENDPOINTS.get(self.path)
        if fixture is None:
            self.send_error(404)
            return
        try:
            payload = json.loads((FIXTURE_ROOT / fixture).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            self.send_error(503, "fixture unavailable")
            return
        body = (json.dumps(payload, separators=(",", ":")) + "\n").encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, fmt, *args):
        print("mock-service: " + fmt % args, flush=True)


if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8765), Handler).serve_forever()
