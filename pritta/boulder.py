"""Minimal Boulder-IO reader/writer (the TAG=VALUE format used by primer3_core)."""

from __future__ import annotations

from typing import Iterable


def parse(text: str) -> list[dict[str, str]]:
    """Split Boulder-IO text into records (dicts of TAG -> raw string value)."""
    records: list[dict[str, str]] = []
    current: dict[str, str] = {}
    for line in text.splitlines():
        line = line.rstrip("\r")
        if line.strip() == "=":
            records.append(current)
            current = {}
            continue
        if "=" not in line:
            continue
        tag, value = line.split("=", 1)
        current[tag.strip()] = value.strip()
    if current:
        records.append(current)
    return records


def dumps(pairs: Iterable[tuple[str, object]]) -> str:
    """Write one record; values are written as-is."""
    lines = [f"{tag}={value}" for tag, value in pairs]
    lines.append("=")
    return "\n".join(lines) + "\n"
