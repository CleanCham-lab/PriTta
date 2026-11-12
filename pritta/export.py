"""Export helpers: result tables and oligo order sheets.

Positions in exported tables are 1-based (the way sequences are usually
numbered in the lab); the raw ``.primer3.out`` keeps Primer3's 0-based values.
"""

from __future__ import annotations

import csv
import io
import re
from typing import Any, Iterable

COLUMNS = [
    "record", "rank", "grade", "pair_penalty", "product_size", "product_tm",
    "left_seq", "left_start", "left_end", "left_len", "left_tm", "left_gc",
    "right_seq", "right_start", "right_end", "right_len", "right_tm", "right_gc",
    "probe_seq", "probe_start", "probe_end", "probe_tm", "probe_gc",
    "left_hairpin_th", "right_hairpin_th", "left_self_end_th", "right_self_end_th",
    "pair_compl_any_th", "pair_compl_end_th", "left_problems", "right_problems",
]


def _r(value: Any, digits: int = 2) -> Any:
    return "" if value is None else round(value, digits)


def rows(results: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
    out = []
    for res in results:
        for p in res.get("pairs", []):
            left, right, probe = p.get("left") or {}, p.get("right") or {}, p.get("internal") or {}
            out.append({
                "record": res.get("id", ""),
                "rank": p["rank"],
                "grade": p["grade"],
                "pair_penalty": _r(p.get("penalty"), 4),
                "product_size": p.get("product_size", ""),
                "product_tm": _r(p.get("product_tm"), 1),
                "left_seq": left.get("seq", ""),
                "left_start": left["start"] + 1 if left else "",
                "left_end": left["end"] + 1 if left else "",
                "left_len": left.get("len", ""),
                "left_tm": _r(left.get("tm")),
                "left_gc": _r(left.get("gc"), 1),
                "right_seq": right.get("seq", ""),
                "right_start": right["start"] + 1 if right else "",
                "right_end": right["end"] + 1 if right else "",
                "right_len": right.get("len", ""),
                "right_tm": _r(right.get("tm")),
                "right_gc": _r(right.get("gc"), 1),
                "probe_seq": probe.get("seq", ""),
                "probe_start": probe["start"] + 1 if probe else "",
                "probe_end": probe["end"] + 1 if probe else "",
                "probe_tm": _r(probe.get("tm")),
                "probe_gc": _r(probe.get("gc"), 1),
                "left_hairpin_th": _r(left.get("hairpin_th")),
                "right_hairpin_th": _r(right.get("hairpin_th")),
                "left_self_end_th": _r(left.get("self_end_th")),
                "right_self_end_th": _r(right.get("self_end_th")),
                "pair_compl_any_th": _r(p.get("compl_any_th")),
                "pair_compl_end_th": _r(p.get("compl_end_th")),
                "left_problems": left.get("problems", ""),
                "right_problems": right.get("problems", ""),
            })
    return out


def to_csv(results: Iterable[dict[str, Any]], delimiter: str = ",") -> str:
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=COLUMNS, delimiter=delimiter, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows(results))
    return buf.getvalue()


def order_sheet(results: Iterable[dict[str, Any]], selection: dict[str, list[int]] | None = None) -> str:
    """Tab-separated oligo list (name, sequence, length, Tm, GC%) ready for an order form.

    ``selection`` maps record id -> pair ranks to include (default: all pairs).
    """
    lines = ["Name\tSequence (5'->3')\tLength\tTm\tGC%"]
    for res in results:
        wanted = None if selection is None else set(selection.get(res.get("id"), []))
        for p in res.get("pairs", []):
            if wanted is not None and p["rank"] not in wanted:
                continue
            stem = re.sub(r"\.(txt|fa|fasta|fna|seq|in|out|primer3)$", "", str(res.get("id") or "seq"), flags=re.I)
            base = f"{stem}_P{p['rank']}"
            for suffix, key in (("F", "left"), ("R", "right"), ("Probe", "internal")):
                o = p.get(key)
                if o:
                    tm = "" if o.get("tm") is None else f"{float(o['tm']):.1f}"
                    gcp = "" if o.get("gc") is None else f"{float(o['gc']):.1f}"
                    lines.append(f"{base}_{suffix}\t{o['seq']}\t{o['len']}\t{tm}\t{gcp}")
    return "\n".join(lines) + "\n"
