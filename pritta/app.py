"""PriTta launcher: desktop window (pywebview) or browser mode."""

from __future__ import annotations

import argparse
import os
import sys

from . import APP_NAME, __version__
from .api import Api

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, "web", "index.html")


def window_icon() -> str | None:
    """Icon file for the desktop window.

    Windows (WinForms) builds the icon with System.Drawing.Icon, which only
    accepts .ico files: a PNG there throws inside the GUI thread and the app
    dies with error 0xe0434352. A frozen PriTta.exe already carries its icon,
    which pywebview picks up when no icon is given, so pass nothing there.
    """
    if sys.platform == "win32":
        if getattr(sys, "frozen", False):
            return None
        names = ("icon.ico", "helly-icon.ico")
    else:
        names = ("icon.png", "helly-icon.png")
    for name in names:
        path = os.path.join(HERE, "web", "img", name)
        if os.path.isfile(path):
            return path
    return None


def run_browser(startup_file: str | None, port: int, open_browser: bool = True) -> int:
    from .server import serve

    api = Api(mode="browser", startup_file=startup_file)
    httpd, url = serve(api, port=port, open_browser=open_browser)
    print(f"{APP_NAME} {__version__} is running at {url}", flush=True)
    print("Press Ctrl+C to stop.", flush=True)
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.server_close()
    return 0


def run_desktop(startup_file: str | None, debug: bool = False) -> int:
    import webview

    api = Api(mode="desktop", startup_file=startup_file)
    window = webview.create_window(
        f"{APP_NAME} {__version__}",
        url=INDEX,
        js_api=api,
        width=1440,
        height=900,
        min_size=(1120, 720),
        background_color="#1A1640",
        text_select=True,
    )
    api._window = window
    webview.start(debug=debug, http_server=True, icon=window_icon())
    return 0


def _linux_gui_backend() -> bool:
    import importlib.util

    return any(importlib.util.find_spec(m) is not None for m in ("gi", "qtpy"))


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="pritta", description=f"{APP_NAME} - a friendly GUI for Primer3")
    ap.add_argument("file", nargs="?", help="sequence / .primer3.in / .primer3.out file to open")
    ap.add_argument("--browser", action="store_true", help="open in your web browser instead of a desktop window")
    ap.add_argument("--port", type=int, default=0, help="port for --browser mode (default: random)")
    ap.add_argument("--no-open", action="store_true", help="--browser mode: do not open a browser automatically")
    ap.add_argument("--debug", action="store_true", help="desktop mode: enable developer tools")
    ap.add_argument("--version", action="version", version=f"{APP_NAME} {__version__}")
    args = ap.parse_args(argv)

    if not args.browser:
        from .server import is_wsl

        if is_wsl():
            print("WSL detected: opening PriTta in your Windows browser.", file=sys.stderr)
            args.browser = True
        elif sys.platform.startswith("linux") and not _linux_gui_backend():
            print("No GTK/Qt backend for a desktop window; opening PriTta in your browser.", file=sys.stderr)
            args.browser = True
    if not args.browser:
        try:
            import webview  # noqa: F401
        except Exception as exc:
            print(f"Desktop window unavailable ({exc}); falling back to browser mode.", file=sys.stderr)
            args.browser = True
    if args.browser:
        return run_browser(args.file, args.port, open_browser=not args.no_open)
    try:
        return run_desktop(args.file, debug=args.debug)
    except Exception as exc:  # e.g. no GUI backend on a headless Linux box
        print(f"Desktop window failed ({exc}); falling back to browser mode.", file=sys.stderr)
        return run_browser(args.file, args.port, open_browser=not args.no_open)


if __name__ == "__main__":
    sys.exit(main())
