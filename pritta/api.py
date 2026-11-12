"""The bridge between the web UI and the Python engine.

Every public method of :class:`Api` is callable from JavaScript, either through
pywebview (desktop window) or through the local HTTP bridge (``--browser``).
Methods return plain JSON-friendly values and report expected problems as
``{"error": "..."}`` instead of raising.
"""

from __future__ import annotations

import json
import os
import sys
import webbrowser
from typing import Any

from . import APP_NAME, REPO_URL, __version__, engine, export, params
from .sequence import SeqRecord, SequenceError, parse_text, to_markup


def settings_path() -> str:
    if os.name == "nt":
        base = os.environ.get("APPDATA") or os.path.expanduser("~")
        return os.path.join(base, APP_NAME, "settings.json")
    base = os.environ.get("XDG_CONFIG_HOME") or os.path.expanduser("~/.config")
    return os.path.join(base, "pritta", "settings.json")


WEB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "web")


def mascot_config() -> dict[str, Any] | None:
    """Image mascot from web/img/mascot.png (+ optional mascot.json); None = built-in Helly."""
    if not os.path.isfile(os.path.join(WEB_DIR, "img", "mascot.png")):
        return None
    cfg: dict[str, Any] = {"src": "img/mascot.png", "name": APP_NAME, "size": [1, 1], "head": None}
    try:
        with open(os.path.join(WEB_DIR, "img", "mascot.json"), encoding="utf-8") as fh:
            cfg.update({k: v for k, v in json.load(fh).items() if k in {"name", "size", "head"}})
    except (OSError, ValueError):
        pass
    return cfg


class Api:
    def __init__(self, mode: str = "desktop", startup_file: str | None = None) -> None:
        self._mode = mode
        self._window = None  # set by the desktop launcher; private so pywebview does not expose it
        self._startup_file = startup_file
        self._last_dir = os.path.expanduser("~")

    # ------------------------------------------------------------------ app
    def init(self) -> dict[str, Any]:
        settings = self._load_settings()
        self._last_dir = settings.get("last_dir") or self._last_dir
        startup = None
        if self._startup_file and os.path.isfile(self._startup_file):
            try:
                with open(self._startup_file, encoding="utf-8-sig", errors="replace") as fh:
                    startup = {"name": os.path.basename(self._startup_file), "text": fh.read()}
            except OSError:
                startup = None
        return {
            "app": APP_NAME,
            "version": __version__,
            "repo": REPO_URL,
            "mode": self._mode,
            "platform": sys.platform,
            "engine": engine.engine_info(),
            "spec": params.PARAM_SPEC,
            "presets": {name: params.preset_values(name) for name in params.PRESETS},
            "settings": settings,
            "startup": startup,
            "mascot": mascot_config(),
        }

    # ------------------------------------------------------------------ sequences
    def parse(self, text: str, name: str = "sequence") -> dict[str, Any]:
        try:
            records = parse_text(text, name or "sequence")
        except SequenceError as exc:
            return {"error": str(exc)}
        out = []
        for rec in records:
            item = rec.to_dict()
            item["markup"] = to_markup(rec)
            if rec.loaded_output is not None:
                item["result"] = engine.result_from_loaded(rec)
            out.append(item)
        return {"records": out}

    def design(self, record: dict[str, Any], values: dict[str, Any], engine_name: str = "auto") -> dict[str, Any]:
        try:
            rec = SeqRecord.from_dict(record)
            vals = params.normalize(values)
        except (SequenceError, ValueError) as exc:
            return {"ok": False, "error": str(exc), "id": record.get("id"), "pairs": []}
        if not rec.sequence:
            return {"ok": False, "error": "Empty sequence", "id": rec.id, "pairs": []}
        return engine.design(rec, vals, engine_name or "auto")

    def boulder_input(self, record: dict[str, Any], values: dict[str, Any]) -> dict[str, Any]:
        try:
            return {"text": engine.boulder_input(SeqRecord.from_dict(record), params.normalize(values))}
        except (SequenceError, ValueError) as exc:
            return {"error": str(exc)}

    # ------------------------------------------------------------------ export
    def export_text(self, results: list[dict[str, Any]], kind: str, selection: dict[str, list[int]] | None = None) -> dict[str, Any]:
        if kind == "csv":
            return {"text": export.to_csv(results)}
        if kind == "tsv":
            return {"text": export.to_csv(results, delimiter="\t")}
        if kind == "order":
            return {"text": export.order_sheet(results, selection)}
        return {"error": f"Unknown export kind '{kind}'"}

    def save_text(self, filename: str, content: str) -> dict[str, Any]:
        """Desktop only: ask where to save, then write the file."""
        if self._window is None:
            return {"error": "Saving through a dialog is only available in the desktop app"}
        import webview  # local import: not needed in browser mode

        ext = os.path.splitext(filename)[1].lstrip(".").lower()
        file_types = (f"{ext.upper()} file (*.{ext})", "All files (*.*)") if ext else ("All files (*.*)",)
        dialog = getattr(getattr(webview, "FileDialog", None), "SAVE", None) or webview.SAVE_DIALOG
        try:
            chosen = self._window.create_file_dialog(dialog, directory=self._last_dir,
                                                     save_filename=filename, file_types=file_types)
        except Exception as exc:  # pragma: no cover - GUI specific
            return {"error": str(exc)}
        if not chosen:
            return {"cancelled": True}
        path = chosen if isinstance(chosen, str) else chosen[0]
        encoding = "utf-8-sig" if ext in {"csv", "tsv"} else "utf-8"
        try:
            with open(path, "w", encoding=encoding, newline="\n") as fh:
                fh.write(content)
        except OSError as exc:
            return {"error": str(exc)}
        self._last_dir = os.path.dirname(path)
        self._save_settings_key("last_dir", self._last_dir)
        return {"saved": path}

    # ------------------------------------------------------------------ settings
    def save_settings(self, settings: dict[str, Any]) -> dict[str, Any]:
        current = self._load_settings()
        current.update(settings or {})
        return self._write_settings(current)

    def open_external(self, url: str) -> dict[str, Any]:
        if not str(url).startswith(("https://", "http://")):
            return {"error": "Only web links can be opened"}
        webbrowser.open(url)
        return {"ok": True}

    # ------------------------------------------------------------------ private
    def _load_settings(self) -> dict[str, Any]:
        try:
            with open(settings_path(), encoding="utf-8") as fh:
                data = json.load(fh)
            return data if isinstance(data, dict) else {}
        except (OSError, ValueError):
            return {}

    def _write_settings(self, data: dict[str, Any]) -> dict[str, Any]:
        path = settings_path()
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2)
        except OSError as exc:
            return {"error": str(exc)}
        return {"ok": True}

    def _save_settings_key(self, key: str, value: Any) -> None:
        data = self._load_settings()
        data[key] = value
        self._write_settings(data)
