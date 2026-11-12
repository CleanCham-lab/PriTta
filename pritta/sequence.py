"""Sequence input parsing.

Supported inputs
----------------
* Plain text or FASTA (one or many records). Region markup inside the sequence:
    ``[...]``  target           -> SEQUENCE_TARGET (primers must flank it)
    ``<...>``  excluded region  -> SEQUENCE_EXCLUDED_REGION (no primer may overlap)
    ``{...}``  included region  -> SEQUENCE_INCLUDED_REGION (primers must lie inside)
  This is the same markup Primer3Web uses, and ``[...]`` matches primer3.sh.
* Boulder-IO files (``.primer3.in`` / ``.primer3.out``). Results contained in a
  ``.primer3.out`` file are kept so they can be viewed without re-running.

All coordinates are 0-based ``[start, length]`` like Primer3's defaults.
"""

from __future__ import annotations

import os
from collections import Counter
from dataclasses import asdict, dataclass, field
from typing import Any

from . import boulder
from .params import SPEC_BY_TAG

IUPAC = set("ACGTRYSWKMBDHVN")
OPEN = {"[": "targets", "<": "excluded", "{": "included"}
CLOSE = {"]": "targets", ">": "excluded", "}": "included"}
MARK = {"targets": ("[", "]"), "excluded": ("<", ">"), "included": ("{", "}")}


class SequenceError(ValueError):
    """Raised when a sequence cannot be parsed."""


@dataclass
class SeqRecord:
    id: str
    sequence: str
    targets: list[list[int]] = field(default_factory=list)
    excluded: list[list[int]] = field(default_factory=list)
    included: list[list[int]] = field(default_factory=list)  # Primer3 allows at most one
    warnings: list[str] = field(default_factory=list)
    params: dict[str, Any] = field(default_factory=dict)  # overrides read from Boulder input
    loaded_output: dict[str, Any] | None = None  # flat Primer3 output read from .primer3.out

    def to_dict(self) -> dict[str, Any]:
        d = asdict(self)
        d.pop("loaded_output", None)
        return d

    @classmethod
    def from_dict(cls, d: dict[str, Any]) -> "SeqRecord":
        rec = cls(
            id=str(d.get("id") or "sequence"),
            sequence=clean_sequence(d.get("sequence", "")),
            targets=[list(map(int, r)) for r in d.get("targets") or []],
            excluded=[list(map(int, r)) for r in d.get("excluded") or []],
            included=[list(map(int, r)) for r in d.get("included") or []],
        )
        check_regions(rec)
        return rec


def clean_sequence(seq: str) -> str:
    out = []
    for ch in str(seq):
        u = ch.upper()
        if u in IUPAC:
            out.append(u)
    return "".join(out)


TEXT_CHARS = set(".,_():;=~/\\|!?\"'@#$%^&+")


def is_text_line(line: str) -> bool:
    """True for note/label lines (gene names, HGVS, coordinates) that are not DNA.

    Without this, letters such as M, Y, H, R, S, K in "MYH7" or "hg38" would be
    read as IUPAC bases and silently added to the template.
    """
    s = line.strip()
    if not s:
        return False
    letters = [c for c in s if c.isalpha()]
    if not letters:
        return False  # numbering only; digits are ignored later anyway
    if any(c in TEXT_CHARS for c in s):
        return True
    digits = sum(c.isdigit() for c in s)
    if digits > len(letters):
        return True  # e.g. "14-23425316-C-T"
    dna = sum(c in "ACGTNacgtn" for c in letters)
    return dna / len(letters) < 0.9


def drop_text_lines(raw: str) -> tuple[str, list[str]]:
    kept, dropped = [], []
    for line in raw.splitlines():
        (dropped if is_text_line(line) else kept).append(line)
    return "\n".join(kept), [d.strip() for d in dropped]


def parse_markup(raw: str, rec_id: str = "sequence") -> SeqRecord:
    """Parse a single sequence that may contain [ ] < > { } markup."""
    seq: list[str] = []
    regions: dict[str, list[list[int]]] = {"targets": [], "excluded": [], "included": []}
    opened: dict[str, int] = {}
    invalid: Counter[str] = Counter()
    warnings: list[str] = []

    raw, dropped = drop_text_lines(raw)
    if dropped:
        shown = ", ".join(f"'{d[:24]}'" for d in dropped[:5]) + (" …" if len(dropped) > 5 else "")
        warnings.append(f"Ignored {len(dropped)} non-sequence line(s): {shown}")

    for ch in raw:
        if ch.isspace() or ch.isdigit():
            continue  # tolerate GenBank-style numbering and line breaks
        if ch in OPEN:
            kind = OPEN[ch]
            if kind in opened:
                raise SequenceError(f"'{ch}' opened twice before closing (position {len(seq) + 1})")
            opened[kind] = len(seq)
            continue
        if ch in CLOSE:
            kind = CLOSE[ch]
            if kind not in opened:
                raise SequenceError(f"'{ch}' closed without a matching opening bracket (position {len(seq) + 1})")
            start = opened.pop(kind)
            length = len(seq) - start
            if length > 0:
                regions[kind].append([start, length])
            else:
                warnings.append(f"Empty {MARK[kind][0]}{MARK[kind][1]} region ignored")
            continue
        u = ch.upper()
        if u in IUPAC:
            seq.append(u)
        else:
            invalid[ch] += 1

    if opened:
        names = ", ".join(MARK[k][0] for k in opened)
        raise SequenceError(f"Unclosed bracket: {names}")
    if invalid:
        detail = ", ".join(f"'{c}'x{n}" for c, n in invalid.most_common(6))
        warnings.append(f"Removed {sum(invalid.values())} non-DNA characters ({detail})")
    if len(regions["included"]) > 1:
        raise SequenceError("Only one { } included region is allowed")

    rec = SeqRecord(id=rec_id, sequence="".join(seq), warnings=warnings, **regions)
    return rec


def check_regions(rec: SeqRecord) -> None:
    n = len(rec.sequence)
    for kind in ("targets", "excluded", "included"):
        for start, length in getattr(rec, kind):
            if start < 0 or length <= 0 or start + length > n:
                raise SequenceError(f"{kind} region {start},{length} is outside the sequence (length {n})")
    if len(rec.included) > 1:
        raise SequenceError("Only one included region is allowed")


def to_markup(rec: SeqRecord) -> str:
    """Inverse of :func:`parse_markup` (regions of one kind are merged if they overlap)."""
    events: dict[int, list[str]] = {}

    def merged(regs: list[list[int]]) -> list[list[int]]:
        out: list[list[int]] = []
        for s, l in sorted(regs):
            e = s + l
            if out and s <= out[-1][1]:
                out[-1][1] = max(out[-1][1], e)
            else:
                out.append([s, e])
        return out

    for kind in ("included", "excluded", "targets"):
        o, c = MARK[kind]
        for s, e in merged(getattr(rec, kind)):
            events.setdefault(s, []).append(o)
            events.setdefault(e, []).insert(0, c)
    parts: list[str] = []
    for i, base in enumerate(rec.sequence + "\0"):
        if i in events:
            closes = [m for m in events[i] if m in CLOSE]
            opens = [m for m in events[i] if m in OPEN]
            parts.extend(closes + opens)
        if base != "\0":
            parts.append(base)
    return "".join(parts)


def _parse_fasta(text: str) -> list[tuple[str, str]]:
    entries: list[tuple[str, str]] = []
    header: str | None = None
    chunk: list[str] = []
    preamble: list[str] = []
    for line in text.splitlines():
        if line.startswith(">"):
            if header is not None:
                entries.append((header, "\n".join(chunk)))
            header = line[1:].strip()
            chunk = []
        elif header is None:
            preamble.append(line)
        else:
            chunk.append(line)
    if header is not None:
        entries.append((header, "\n".join(chunk)))
    pre = "\n".join(preamble).strip()
    if pre:
        entries.insert(0, ("", pre))
    return entries


def _unique_ids(records: list[SeqRecord]) -> None:
    seen: Counter[str] = Counter()
    for rec in records:
        seen[rec.id] += 1
        if seen[rec.id] > 1:
            rec.id = f"{rec.id}_{seen[rec.id]}"


def _regions_from_tag(value: str, first_base: int) -> list[list[int]]:
    out = []
    for chunk in str(value).replace(";", " ").split():
        if "," not in chunk:
            continue
        s, l = chunk.split(",", 1)
        out.append([int(s) - first_base, int(l)])
    return out


def _from_boulder(text: str, default_id: str) -> list[SeqRecord]:
    records: list[SeqRecord] = []
    globals_: dict[str, str] = {}
    for i, rec in enumerate(boulder.parse(text), 1):
        template = rec.get("SEQUENCE_TEMPLATE", "")
        for tag, value in rec.items():
            if tag.startswith("PRIMER_") and tag in SPEC_BY_TAG:
                globals_[tag] = value  # Boulder global tags persist across records
        if not template:
            continue
        first = int(rec.get("PRIMER_FIRST_BASE_INDEX", 0) or 0)
        sr = SeqRecord(
            id=rec.get("SEQUENCE_ID") or (default_id if i == 1 else f"{default_id}_{i}"),
            sequence=clean_sequence(template),
            targets=_regions_from_tag(rec.get("SEQUENCE_TARGET", ""), first),
            excluded=_regions_from_tag(rec.get("SEQUENCE_EXCLUDED_REGION", ""), first),
            included=_regions_from_tag(rec.get("SEQUENCE_INCLUDED_REGION", ""), first)[:1],
            params=dict(globals_),
        )
        if "PRIMER_PAIR_NUM_RETURNED" in rec or "PRIMER_ERROR" in rec:
            sr.loaded_output = dict(rec)
        check_regions(sr)
        records.append(sr)
    return records


def parse_text(text: str, default_id: str = "sequence") -> list[SeqRecord]:
    """Parse pasted/loaded text into one or more records."""
    text = (text or "").replace("\r\n", "\n").replace("\r", "\n").lstrip("﻿")
    if not text.strip():
        raise SequenceError("No sequence found")
    if "SEQUENCE_TEMPLATE=" in text:
        records = _from_boulder(text, default_id)
    elif any(line.startswith(">") for line in text.splitlines()):
        records = []
        for n, (header, body) in enumerate(_parse_fasta(text), 1):
            rec_id = header.split()[0] if header.split() else (default_id if n == 1 else f"{default_id}_{n}")
            rec = parse_markup(body, rec_id)
            if rec.sequence:
                records.append(rec)
    else:
        records = [parse_markup(text, default_id)]
    records = [r for r in records if r.sequence]
    if not records:
        raise SequenceError("No DNA sequence found")
    _unique_ids(records)
    return records


def read_file(path: str) -> list[SeqRecord]:
    with open(path, encoding="utf-8-sig", errors="replace") as fh:
        text = fh.read()
    return parse_text(text, os.path.basename(path))


def gc_percent(seq: str) -> float:
    if not seq:
        return 0.0
    gc = sum(1 for b in seq if b in "GCS")
    return 100.0 * gc / len(seq)
