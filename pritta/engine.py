"""Run Primer3 and turn its output into plain JSON-friendly dicts.

Two engines are supported:

* ``primer3-py``  - the official Python bindings (bundled; no external install).
* ``primer3_core`` - an external executable, found via ``$PRIMER3_BIN``,
  ``~/tool/primer3/src/primer3_core`` (the primer3.sh default) or ``PATH``.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
from typing import Any

from . import boulder, params
from .sequence import SeqRecord

try:  # pragma: no cover - import guard
    import primer3 as _primer3
    import primer3.bindings as _p3b

    PRIMER3_PY_VERSION: str | None = getattr(_primer3, "__version__", "?")
except Exception:  # pragma: no cover
    _p3b = None
    PRIMER3_PY_VERSION = None


class EngineError(RuntimeError):
    """Primer3 could not run or reported an error."""


# --------------------------------------------------------------------------- engines

def find_primer3_core() -> str | None:
    candidates = [
        os.environ.get("PRIMER3_BIN", ""),
        os.path.expanduser("~/tool/primer3/src/primer3_core"),
        shutil.which("primer3_core") or "",
        shutil.which("primer3_core.exe") or "",
    ]
    for path in candidates:
        if path and os.path.isfile(path) and os.access(path, os.X_OK):
            return path
    return None


def engine_info() -> dict[str, Any]:
    core = find_primer3_core()
    available = []
    if _p3b is not None:
        available.append("primer3-py")
    if core:
        available.append("primer3_core")
    return {
        "available": available,
        "default": available[0] if available else None,
        "primer3_py": PRIMER3_PY_VERSION,
        "primer3_core": core,
    }


def resolve_engine(engine: str = "auto") -> str:
    info = engine_info()
    if engine in (None, "", "auto"):
        if not info["default"]:
            raise EngineError(
                "No Primer3 engine found. Install primer3-py (pip install primer3-py) "
                "or set PRIMER3_BIN to a primer3_core executable."
            )
        return info["default"]
    if engine not in info["available"]:
        raise EngineError(f"Engine '{engine}' is not available (available: {', '.join(info['available']) or 'none'})")
    return engine


# --------------------------------------------------------------------------- inputs

def _intervals(regions: list[list[int]]) -> str:
    return " ".join(f"{s},{l}" for s, l in regions)


def input_tags(rec: SeqRecord, values: dict[str, Any]) -> list[tuple[str, str]]:
    """Ordered Boulder-IO tags for one record (same layout as primer3.sh)."""
    tags: list[tuple[str, str]] = [("SEQUENCE_ID", rec.id), ("SEQUENCE_TEMPLATE", rec.sequence)]
    if rec.targets:
        tags.append(("SEQUENCE_TARGET", _intervals(rec.targets)))
    if rec.excluded:
        tags.append(("SEQUENCE_EXCLUDED_REGION", _intervals(rec.excluded)))
    if rec.included:
        tags.append(("SEQUENCE_INCLUDED_REGION", _intervals(rec.included[:1])))
    for tag, value in params.global_tags(values):
        tags.append((tag, params.format_value(value)))
    return tags


def boulder_input(rec: SeqRecord, values: dict[str, Any]) -> str:
    return boulder.dumps(input_tags(rec, values))


def _py_args(rec: SeqRecord, values: dict[str, Any]) -> tuple[dict[str, Any], dict[str, Any]]:
    seq_args: dict[str, Any] = {"SEQUENCE_ID": rec.id, "SEQUENCE_TEMPLATE": rec.sequence}
    if rec.targets:
        seq_args["SEQUENCE_TARGET"] = [list(r) for r in rec.targets]
    if rec.excluded:
        seq_args["SEQUENCE_EXCLUDED_REGION"] = [list(r) for r in rec.excluded]
    if rec.included:
        seq_args["SEQUENCE_INCLUDED_REGION"] = list(rec.included[0])
    global_args: dict[str, Any] = {}
    for tag, value in params.global_tags(values):
        if tag == "PRIMER_PRODUCT_SIZE_RANGE":
            value = params.parse_size_ranges(value)
        global_args[tag] = value
    return seq_args, global_args


# --------------------------------------------------------------------------- running

def run_flat(rec: SeqRecord, values: dict[str, Any], engine: str = "auto") -> tuple[dict[str, Any], str]:
    """Run Primer3 and return its flat TAG -> value output and the engine label."""
    engine = resolve_engine(engine)
    if engine == "primer3-py":
        seq_args, global_args = _py_args(rec, values)
        try:
            out = _p3b.design_primers(seq_args, global_args)
        except (OSError, ValueError, TypeError, KeyError) as exc:
            raise EngineError(str(exc).strip() or exc.__class__.__name__) from None
        # primer3-py also returns structured lists (PRIMER_PAIR, PRIMER_LEFT, ...); keep the flat tags only.
        flat = {k: v for k, v in out.items() if k not in {"PRIMER_PAIR", "PRIMER_LEFT", "PRIMER_RIGHT", "PRIMER_INTERNAL"}}
        if flat.get("PRIMER_ERROR"):
            raise EngineError(str(flat["PRIMER_ERROR"]))
        return flat, f"primer3-py {PRIMER3_PY_VERSION}"

    exe = find_primer3_core()
    kwargs: dict[str, Any] = {}
    if os.name == "nt":  # no console flash from the windowed app
        kwargs["creationflags"] = getattr(subprocess, "CREATE_NO_WINDOW", 0)
    try:
        proc = subprocess.run([exe], input=boulder_input(rec, values), capture_output=True,
                              text=True, timeout=600, **kwargs)
    except (OSError, subprocess.SubprocessError) as exc:
        raise EngineError(f"primer3_core failed to start: {exc}") from None
    records = boulder.parse(proc.stdout)
    if not records:
        raise EngineError((proc.stderr or "primer3_core returned no output").strip())
    flat = records[0]
    if flat.get("PRIMER_ERROR"):
        raise EngineError(flat["PRIMER_ERROR"])
    return flat, f"primer3_core ({exe})"


# --------------------------------------------------------------------------- normalizing

def _num(value: Any, default: float | None = None) -> float | None:
    if value is None or value == "":
        return default
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _coords(value: Any) -> tuple[int, int]:
    if isinstance(value, (list, tuple)):
        return int(value[0]), int(value[1])
    s, l = str(value).split(",", 1)
    return int(s), int(l)


def grade(penalty: float | None) -> str:
    """Letter grade from the Primer3 pair penalty (0 = every parameter at its optimum)."""
    if penalty is None:
        return "?"
    for limit, letter in ((0.5, "S"), (1.5, "A"), (3.0, "B"), (6.0, "C")):
        if penalty <= limit:
            return letter
    return "D"


_EXPLAIN_ITEM = re.compile(r"^(.*?)\s+(\d+)$")


def parse_explain(text: Any) -> list[dict[str, Any]]:
    """'considered 3164, GC content failed 1733, ok 238' -> [{label, count}, ...]"""
    items = []
    for part in str(text or "").split(","):
        m = _EXPLAIN_ITEM.match(part.strip())
        if m:
            items.append({"label": m.group(1), "count": int(m.group(2))})
    return items


def _oligo(flat: dict[str, Any], side: str, i: int) -> dict[str, Any] | None:
    key = f"PRIMER_{side}_{i}"
    if f"{key}_SEQUENCE" not in flat or key not in flat:
        return None
    pos, length = _coords(flat[key])
    start, end = (pos - length + 1, pos) if side == "RIGHT" else (pos, pos + length - 1)
    return {
        "seq": str(flat[f"{key}_SEQUENCE"]),
        "start": start,
        "end": end,
        "len": length,
        "tm": _num(flat.get(f"{key}_TM")),
        "gc": _num(flat.get(f"{key}_GC_PERCENT")),
        "self_any_th": _num(flat.get(f"{key}_SELF_ANY_TH")),
        "self_end_th": _num(flat.get(f"{key}_SELF_END_TH")),
        "hairpin_th": _num(flat.get(f"{key}_HAIRPIN_TH")),
        "end_stability": _num(flat.get(f"{key}_END_STABILITY")),
        "penalty": _num(flat.get(f"{key}_PENALTY")),
        "problems": str(flat.get(f"{key}_PROBLEMS", "") or ""),
    }


def _structure(result: Any) -> dict[str, Any]:
    lines = []
    for line in getattr(result, "ascii_structure_lines", None) or []:
        if line.startswith("SEQ\t"):
            line = "5' " + line[4:]
        elif line.startswith("STR\t"):
            line = "3' " + line[4:]
        lines.append(line.replace("\t", " "))
    return {
        "found": bool(getattr(result, "structure_found", False)),
        "tm": round(float(result.tm), 2),
        "dg": round(float(result.dg) / 1000.0, 2),  # cal/mol -> kcal/mol
        "lines": lines,
    }


def _add_structures(pairs: list[dict[str, Any]], values: dict[str, Any]) -> None:
    if _p3b is None:
        return
    cond = {
        "mv_conc": values["PRIMER_SALT_MONOVALENT"],
        "dv_conc": values["PRIMER_SALT_DIVALENT"],
        "dntp_conc": values["PRIMER_DNTP_CONC"],
        "dna_conc": values["PRIMER_DNA_CONC"],
        "output_structure": True,
    }
    for pair in pairs:
        try:
            for side in ("left", "right", "internal"):
                oligo = pair.get(side)
                if not oligo or len(oligo["seq"]) > 60:
                    continue
                oligo["structures"] = {
                    "hairpin": _structure(_p3b.calc_hairpin(oligo["seq"], **cond)),
                    "homodimer": _structure(_p3b.calc_homodimer(oligo["seq"], **cond)),
                }
            if pair.get("left") and pair.get("right"):
                pair["structures"] = {
                    "heterodimer": _structure(_p3b.calc_heterodimer(pair["left"]["seq"], pair["right"]["seq"], **cond)),
                }
        except Exception:  # structures are a nice-to-have; never fail the run for them
            continue


def normalize_output(flat: dict[str, Any], rec: SeqRecord, values: dict[str, Any]) -> dict[str, Any]:
    n_pairs = int(_num(flat.get("PRIMER_PAIR_NUM_RETURNED"), 0) or 0)
    pairs = []
    for i in range(n_pairs):
        penalty = _num(flat.get(f"PRIMER_PAIR_{i}_PENALTY"))
        pairs.append({
            "index": i,
            "rank": i + 1,
            "grade": grade(penalty),
            "penalty": penalty,
            "product_size": int(_num(flat.get(f"PRIMER_PAIR_{i}_PRODUCT_SIZE"), 0) or 0),
            "product_tm": _num(flat.get(f"PRIMER_PAIR_{i}_PRODUCT_TM")),
            "compl_any_th": _num(flat.get(f"PRIMER_PAIR_{i}_COMPL_ANY_TH")),
            "compl_end_th": _num(flat.get(f"PRIMER_PAIR_{i}_COMPL_END_TH")),
            "left": _oligo(flat, "LEFT", i),
            "right": _oligo(flat, "RIGHT", i),
            "internal": _oligo(flat, "INTERNAL", i),
        })
    explain = {
        side: parse_explain(flat.get(f"PRIMER_{side.upper()}_EXPLAIN"))
        for side in ("left", "right", "internal", "pair")
        if flat.get(f"PRIMER_{side.upper()}_EXPLAIN")
    }
    warnings = [w.strip() for w in str(flat.get("PRIMER_WARNING", "") or "").split(";") if w.strip()]
    return {"pairs": pairs, "explain": explain, "warnings": warnings}


# --------------------------------------------------------------------------- Boulder output

_FORMATS = (
    ("_PRODUCT_TM", "%.1f"),
    ("_END_STABILITY", "%.4f"),
    ("_PENALTY", "%f"),
    ("_GC_PERCENT", "%.3f"),
    ("_TM", "%.3f"),
    ("_TH", "%.2f"),
)


def _fmt(tag: str, value: Any) -> str:
    if isinstance(value, str):
        return value
    if isinstance(value, (list, tuple)):
        return ",".join(str(v) for v in value)
    if isinstance(value, float):
        for suffix, fmt in _FORMATS:
            if tag.endswith(suffix):
                return fmt % value
        return params.format_value(value)
    return str(value)


_PER_PAIR_ORDER = [
    "PRIMER_PAIR_{i}_PENALTY", "PRIMER_LEFT_{i}_PENALTY", "PRIMER_RIGHT_{i}_PENALTY", "PRIMER_INTERNAL_{i}_PENALTY",
    "PRIMER_LEFT_{i}_SEQUENCE", "PRIMER_RIGHT_{i}_SEQUENCE", "PRIMER_INTERNAL_{i}_SEQUENCE",
    "PRIMER_LEFT_{i}", "PRIMER_RIGHT_{i}", "PRIMER_INTERNAL_{i}",
    "PRIMER_LEFT_{i}_TM", "PRIMER_RIGHT_{i}_TM", "PRIMER_INTERNAL_{i}_TM",
    "PRIMER_LEFT_{i}_GC_PERCENT", "PRIMER_RIGHT_{i}_GC_PERCENT", "PRIMER_INTERNAL_{i}_GC_PERCENT",
    "PRIMER_LEFT_{i}_SELF_ANY_TH", "PRIMER_RIGHT_{i}_SELF_ANY_TH", "PRIMER_INTERNAL_{i}_SELF_ANY_TH",
    "PRIMER_LEFT_{i}_SELF_END_TH", "PRIMER_RIGHT_{i}_SELF_END_TH", "PRIMER_INTERNAL_{i}_SELF_END_TH",
    "PRIMER_LEFT_{i}_HAIRPIN_TH", "PRIMER_RIGHT_{i}_HAIRPIN_TH", "PRIMER_INTERNAL_{i}_HAIRPIN_TH",
    "PRIMER_LEFT_{i}_END_STABILITY", "PRIMER_RIGHT_{i}_END_STABILITY",
    "PRIMER_LEFT_{i}_PROBLEMS", "PRIMER_RIGHT_{i}_PROBLEMS", "PRIMER_INTERNAL_{i}_PROBLEMS",
    "PRIMER_PAIR_{i}_COMPL_ANY_TH", "PRIMER_PAIR_{i}_COMPL_END_TH",
    "PRIMER_PAIR_{i}_PRODUCT_SIZE", "PRIMER_PAIR_{i}_PRODUCT_TM",
]

_HEADER_ORDER = [
    "PRIMER_ERROR", "PRIMER_WARNING",
    "PRIMER_LEFT_EXPLAIN", "PRIMER_RIGHT_EXPLAIN", "PRIMER_INTERNAL_EXPLAIN", "PRIMER_PAIR_EXPLAIN",
    "PRIMER_LEFT_NUM_RETURNED", "PRIMER_RIGHT_NUM_RETURNED", "PRIMER_INTERNAL_NUM_RETURNED",
    "PRIMER_PAIR_NUM_RETURNED",
]

_INDEXED = re.compile(r"^PRIMER_(?:PAIR|LEFT|RIGHT|INTERNAL)_(\d+)(?:_|$)")


def boulder_output(in_tags: list[tuple[str, str]], flat: dict[str, Any]) -> str:
    """Primer3_core-style ``.primer3.out`` text: echoed input, then results."""
    pairs: list[tuple[str, str]] = list(in_tags)
    echoed = {t for t, _ in in_tags}
    used = set(echoed)
    for tag in _HEADER_ORDER:
        if tag in flat and tag not in echoed:
            pairs.append((tag, _fmt(tag, flat[tag])))
            used.add(tag)
    indices = sorted({int(m.group(1)) for k in flat if (m := _INDEXED.match(k))})
    for i in indices:
        for pattern in _PER_PAIR_ORDER:
            tag = pattern.format(i=i)
            if tag in flat:
                pairs.append((tag, _fmt(tag, flat[tag])))
                used.add(tag)
        for tag in sorted(k for k in flat if k not in used and (m := _INDEXED.match(k)) and int(m.group(1)) == i):
            pairs.append((tag, _fmt(tag, flat[tag])))
            used.add(tag)
    for tag in sorted(k for k in flat if k not in used):
        pairs.append((tag, _fmt(tag, flat[tag])))
    return boulder.dumps(pairs)


# --------------------------------------------------------------------------- public API

def _base_result(rec: SeqRecord, values: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": rec.id,
        "length": len(rec.sequence),
        "targets": rec.targets,
        "excluded": rec.excluded,
        "included": rec.included,
        "params": values,
        "ok": False,
        "error": None,
        "engine": None,
        "pairs": [],
        "explain": {},
        "warnings": list(rec.warnings),
        "boulder_in": "",
        "boulder_out": "",
    }


def design(rec: SeqRecord, values: dict[str, Any] | None = None, engine: str = "auto") -> dict[str, Any]:
    """Design primers for one record. Never raises for Primer3 errors; check ``ok``."""
    values = params.normalize(values)
    result = _base_result(rec, values)
    problems = params.validate(values)
    if problems:
        result["error"] = "; ".join(problems)
        return result
    in_tags = input_tags(rec, values)
    result["boulder_in"] = boulder.dumps(in_tags)
    try:
        flat, label = run_flat(rec, values, engine)
    except EngineError as exc:
        result["error"] = str(exc)
        return result
    result.update(normalize_output(flat, rec, values))
    result["warnings"] = list(rec.warnings) + result["warnings"]
    result["engine"] = label
    result["ok"] = True
    result["boulder_out"] = boulder_output(in_tags, flat)
    _add_structures(result["pairs"], values)
    return result


def result_from_loaded(rec: SeqRecord) -> dict[str, Any]:
    """Build a result from a ``.primer3.out`` file that was opened (no re-run)."""
    values = params.normalize(rec.params)
    result = _base_result(rec, values)
    flat = rec.loaded_output or {}
    if flat.get("PRIMER_ERROR"):
        result["error"] = flat["PRIMER_ERROR"]
        return result
    in_tags = [(k, v) for k, v in flat.items() if k.startswith("SEQUENCE_") or k in params.SPEC_BY_TAG or k in params.ALWAYS_WRITTEN]
    result.update(normalize_output(flat, rec, values))
    result["engine"] = "loaded from file"
    result["ok"] = True
    result["boulder_in"] = boulder.dumps(in_tags)
    result["boulder_out"] = boulder_output(in_tags, {k: v for k, v in flat.items() if k not in dict(in_tags)})
    _add_structures(result["pairs"], values)
    return result
