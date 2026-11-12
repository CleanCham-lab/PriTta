"""Local HTTP bridge used by ``--browser`` mode (and handy on WSL or Linux servers).

Serves the web UI and exposes :class:`pritta.api.Api` methods at
``POST /api/<method>`` (JSON array of arguments). Bound to 127.0.0.1 only and
protected by a per-session token sent in the ``X-PriTta-Token`` header.
"""

from __future__ import annotations

import json
import mimetypes
import os
import secrets
import shutil
import subprocess
import threading
import webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import Any

from .api import Api

WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")
mimetypes.add_type("font/woff2", ".woff2")
mimetypes.add_type("text/javascript", ".js")
mimetypes.add_type("image/svg+xml", ".svg")

ALLOWED = {"init", "parse", "design", "boulder_input", "export_text", "save_settings", "open_external"}


def make_handler(api: Api, token: str):
    class Handler(BaseHTTPRequestHandler):
        server_version = "PriTta"

        def log_message(self, fmt: str, *args: Any) -> None:  # keep the console quiet
            return

        def _send(self, code: int, body: bytes, ctype: str) -> None:
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(body)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self) -> None:
            path = self.path.split("?", 1)[0]
            if path in ("", "/"):
                path = "/index.html"
            full = os.path.normpath(os.path.join(WEB_DIR, path.lstrip("/")))
            if not full.startswith(WEB_DIR + os.sep) or not os.path.isfile(full):
                self._send(404, b"not found", "text/plain")
                return
            ctype = mimetypes.guess_type(full)[0] or "application/octet-stream"
            if ctype.startswith("text/") or ctype.endswith(("javascript", "json", "svg+xml")):
                ctype += "; charset=utf-8"
            with open(full, "rb") as fh:
                self._send(200, fh.read(), ctype)

        def do_POST(self) -> None:
            if self.headers.get("X-PriTta-Token") != token:
                self._send(403, b'{"error":"forbidden"}', "application/json")
                return
            name = self.path.split("?", 1)[0].rsplit("/", 1)[-1]
            if not self.path.startswith("/api/") or name not in ALLOWED:
                self._send(404, b'{"error":"unknown method"}', "application/json")
                return
            try:
                length = int(self.headers.get("Content-Length", "0"))
                args = json.loads(self.rfile.read(length) or b"[]")
                if not isinstance(args, list):
                    raise ValueError("arguments must be a JSON array")
                result = getattr(api, name)(*args)
                body = json.dumps({"result": result}, ensure_ascii=False).encode("utf-8")
                self._send(200, body, "application/json; charset=utf-8")
            except Exception as exc:  # report, never crash the server
                body = json.dumps({"error": f"{exc.__class__.__name__}: {exc}"}).encode("utf-8")
                self._send(500, body, "application/json; charset=utf-8")

    return Handler


def is_wsl() -> bool:
    try:
        with open("/proc/version", encoding="utf-8", errors="ignore") as fh:
            return "microsoft" in fh.read().lower()
    except OSError:
        return False


def open_url(url: str) -> None:
    """Open the UI in a browser; on WSL use the Windows default browser."""
    if is_wsl():
        for cmd in (["wslview", url], ["explorer.exe", url], ["/mnt/c/Windows/explorer.exe", url]):
            if shutil.which(cmd[0]) or os.path.isfile(cmd[0]):
                try:
                    subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                    return
                except OSError:
                    continue
    webbrowser.open(url)


def serve(api: Api, port: int = 0, open_browser: bool = True) -> tuple[ThreadingHTTPServer, str]:
    token = secrets.token_urlsafe(16)
    httpd = ThreadingHTTPServer(("127.0.0.1", port), make_handler(api, token))
    url = f"http://127.0.0.1:{httpd.server_address[1]}/index.html?t={token}"
    if open_browser:
        threading.Timer(0.4, lambda: open_url(url)).start()
    return httpd, url
