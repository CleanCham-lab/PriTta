"""Primer3 parameters exposed in the GUI, their Primer3 defaults, and presets.

Only parameters whose value differs from the Primer3 default are written to the
Primer3 input, so the "standard" preset produces exactly the same
``.primer3.in`` / ``.primer3.out`` as the original ``primer3.sh`` workflow.
"""

from __future__ import annotations

import re
from typing import Any

# Tags that are always written, in this order (matches the original primer3.sh).
ALWAYS_WRITTEN = [
    "PRIMER_TASK",
    "PRIMER_NUM_RETURN",
    "PRIMER_PRODUCT_SIZE_RANGE",
    "PRIMER_PICK_ANYWAY",
    "PRIMER_EXPLAIN_FLAG",
]

# group, tag, type, primer3 default, min, max, step
# Types: int, float, bool, range (product size ranges such as "150-700 700-1000")
PARAM_SPEC: list[dict[str, Any]] = [
    # --- product -------------------------------------------------------------
    {"group": "product", "tag": "PRIMER_PRODUCT_SIZE_RANGE", "type": "range", "default": "100-300"},
    {"group": "product", "tag": "PRIMER_NUM_RETURN", "type": "int", "default": 5, "min": 1, "max": 50, "step": 1},
    # --- primer --------------------------------------------------------------
    {"group": "primer", "tag": "PRIMER_MIN_SIZE", "type": "int", "default": 18, "min": 8, "max": 36, "step": 1},
    {"group": "primer", "tag": "PRIMER_OPT_SIZE", "type": "int", "default": 20, "min": 8, "max": 36, "step": 1},
    {"group": "primer", "tag": "PRIMER_MAX_SIZE", "type": "int", "default": 27, "min": 8, "max": 36, "step": 1},
    {"group": "primer", "tag": "PRIMER_MIN_TM", "type": "float", "default": 57.0, "min": 30, "max": 85, "step": 0.5},
    {"group": "primer", "tag": "PRIMER_OPT_TM", "type": "float", "default": 60.0, "min": 30, "max": 85, "step": 0.5},
    {"group": "primer", "tag": "PRIMER_MAX_TM", "type": "float", "default": 63.0, "min": 30, "max": 85, "step": 0.5},
    {"group": "primer", "tag": "PRIMER_MIN_GC", "type": "float", "default": 20.0, "min": 0, "max": 100, "step": 1},
    {"group": "primer", "tag": "PRIMER_MAX_GC", "type": "float", "default": 80.0, "min": 0, "max": 100, "step": 1},
    {"group": "primer", "tag": "PRIMER_PAIR_MAX_DIFF_TM", "type": "float", "default": 100.0, "min": 0, "max": 100, "step": 0.5},
    {"group": "primer", "tag": "PRIMER_GC_CLAMP", "type": "int", "default": 0, "min": 0, "max": 5, "step": 1},
    {"group": "primer", "tag": "PRIMER_MAX_POLY_X", "type": "int", "default": 5, "min": 1, "max": 10, "step": 1},
    {"group": "primer", "tag": "PRIMER_MAX_END_GC", "type": "int", "default": 5, "min": 0, "max": 5, "step": 1},
    # --- probe (internal oligo) ---------------------------------------------
    {"group": "probe", "tag": "PRIMER_PICK_INTERNAL_OLIGO", "type": "bool", "default": 0},
    {"group": "probe", "tag": "PRIMER_INTERNAL_MIN_SIZE", "type": "int", "default": 18, "min": 8, "max": 36, "step": 1},
    {"group": "probe", "tag": "PRIMER_INTERNAL_OPT_SIZE", "type": "int", "default": 20, "min": 8, "max": 36, "step": 1},
    {"group": "probe", "tag": "PRIMER_INTERNAL_MAX_SIZE", "type": "int", "default": 27, "min": 8, "max": 36, "step": 1},
    {"group": "probe", "tag": "PRIMER_INTERNAL_MIN_TM", "type": "float", "default": 57.0, "min": 30, "max": 85, "step": 0.5},
    {"group": "probe", "tag": "PRIMER_INTERNAL_OPT_TM", "type": "float", "default": 60.0, "min": 30, "max": 85, "step": 0.5},
    {"group": "probe", "tag": "PRIMER_INTERNAL_MAX_TM", "type": "float", "default": 63.0, "min": 30, "max": 85, "step": 0.5},
    # --- chemistry -----------------------------------------------------------
    {"group": "chemistry", "tag": "PRIMER_SALT_MONOVALENT", "type": "float", "default": 50.0, "min": 0, "max": 1000, "step": 1},
    {"group": "chemistry", "tag": "PRIMER_SALT_DIVALENT", "type": "float", "default": 1.5, "min": 0, "max": 100, "step": 0.1},
    {"group": "chemistry", "tag": "PRIMER_DNTP_CONC", "type": "float", "default": 0.6, "min": 0, "max": 100, "step": 0.1},
    {"group": "chemistry", "tag": "PRIMER_DNA_CONC", "type": "float", "default": 50.0, "min": 0, "max": 10000, "step": 1},
    # --- structure limits ----------------------------------------------------
    {"group": "structure", "tag": "PRIMER_MAX_SELF_ANY_TH", "type": "float", "default": 47.0, "min": 0, "max": 100, "step": 1},
    {"group": "structure", "tag": "PRIMER_MAX_SELF_END_TH", "type": "float", "default": 47.0, "min": 0, "max": 100, "step": 1},
    {"group": "structure", "tag": "PRIMER_PAIR_MAX_COMPL_ANY_TH", "type": "float", "default": 47.0, "min": 0, "max": 100, "step": 1},
    {"group": "structure", "tag": "PRIMER_PAIR_MAX_COMPL_END_TH", "type": "float", "default": 47.0, "min": 0, "max": 100, "step": 1},
    {"group": "structure", "tag": "PRIMER_MAX_HAIRPIN_TH", "type": "float", "default": 47.0, "min": 0, "max": 100, "step": 1},
    # --- run -----------------------------------------------------------------
    {"group": "run", "tag": "PRIMER_PICK_ANYWAY", "type": "bool", "default": 0},
]

SPEC_BY_TAG = {p["tag"]: p for p in PARAM_SPEC}

# Values that every preset starts from (the original primer3.sh settings).
BASE_VALUES: dict[str, Any] = {p["tag"]: p["default"] for p in PARAM_SPEC}
BASE_VALUES.update({
    "PRIMER_PRODUCT_SIZE_RANGE": "150-700",
    "PRIMER_NUM_RETURN": 5,
    "PRIMER_PICK_ANYWAY": 1,
})

PRESETS: dict[str, dict[str, Any]] = {
    # Identical to the original primer3.sh script.
    "standard": {},
    "qpcr": {
        "PRIMER_PRODUCT_SIZE_RANGE": "70-150",
        "PRIMER_MIN_SIZE": 18, "PRIMER_OPT_SIZE": 20, "PRIMER_MAX_SIZE": 25,
        "PRIMER_MIN_TM": 58.0, "PRIMER_OPT_TM": 60.0, "PRIMER_MAX_TM": 62.0,
        "PRIMER_MIN_GC": 40.0, "PRIMER_MAX_GC": 60.0,
        "PRIMER_PAIR_MAX_DIFF_TM": 2.0,
        "PRIMER_GC_CLAMP": 1, "PRIMER_MAX_POLY_X": 4,
    },
    "taqman": {
        "PRIMER_PRODUCT_SIZE_RANGE": "70-150",
        "PRIMER_MIN_SIZE": 18, "PRIMER_OPT_SIZE": 20, "PRIMER_MAX_SIZE": 25,
        "PRIMER_MIN_TM": 58.0, "PRIMER_OPT_TM": 60.0, "PRIMER_MAX_TM": 62.0,
        "PRIMER_MIN_GC": 40.0, "PRIMER_MAX_GC": 60.0,
        "PRIMER_PAIR_MAX_DIFF_TM": 2.0,
        "PRIMER_GC_CLAMP": 1, "PRIMER_MAX_POLY_X": 4,
        "PRIMER_PICK_INTERNAL_OLIGO": 1,
        "PRIMER_INTERNAL_MIN_SIZE": 20, "PRIMER_INTERNAL_OPT_SIZE": 24, "PRIMER_INTERNAL_MAX_SIZE": 30,
        "PRIMER_INTERNAL_MIN_TM": 65.0, "PRIMER_INTERNAL_OPT_TM": 68.0, "PRIMER_INTERNAL_MAX_TM": 70.0,
    },
    "sanger": {
        "PRIMER_PRODUCT_SIZE_RANGE": "400-800",
        "PRIMER_MIN_GC": 40.0, "PRIMER_MAX_GC": 60.0,
        "PRIMER_PAIR_MAX_DIFF_TM": 3.0,
        "PRIMER_GC_CLAMP": 1,
    },
}

_RANGE_RE = re.compile(r"^\s*(\d+)\s*-\s*(\d+)\s*$")


def preset_values(name: str) -> dict[str, Any]:
    values = dict(BASE_VALUES)
    values.update(PRESETS.get(name, {}))
    return values


def parse_size_ranges(text: str) -> list[list[int]]:
    """'150-700 700-1000' -> [[150, 700], [700, 1000]]"""
    ranges: list[list[int]] = []
    for chunk in re.split(r"[\s,;]+", str(text).strip()):
        if not chunk:
            continue
        m = _RANGE_RE.match(chunk)
        if not m:
            raise ValueError(f"Invalid product size range: '{chunk}' (use e.g. 150-700)")
        lo, hi = int(m.group(1)), int(m.group(2))
        if lo > hi:
            raise ValueError(f"Invalid product size range: '{chunk}' (min > max)")
        ranges.append([lo, hi])
    if not ranges:
        raise ValueError("Product size range is empty (use e.g. 150-700)")
    return ranges


def _coerce(spec: dict[str, Any], value: Any) -> Any:
    t = spec["type"]
    if t == "range":
        parse_size_ranges(value)  # validate
        return " ".join(str(value).split())
    if t == "bool":
        if isinstance(value, str):
            return 1 if value.strip().lower() in {"1", "true", "yes", "on"} else 0
        return 1 if value else 0
    if t == "int":
        return int(round(float(value)))
    return float(value)


def normalize(values: dict[str, Any] | None) -> dict[str, Any]:
    """Fill missing values from the base preset and coerce types."""
    out = dict(BASE_VALUES)
    for tag, value in (values or {}).items():
        spec = SPEC_BY_TAG.get(tag)
        if spec is None or value is None or value == "":
            continue
        try:
            out[tag] = _coerce(spec, value)
        except (TypeError, ValueError) as exc:
            raise ValueError(f"{tag}: {exc}") from None
    return out


def validate(values: dict[str, Any]) -> list[str]:
    """Return human-readable problems with a parameter set (empty = OK)."""
    v = values
    problems = []

    def order(a: str, b: str, c: str) -> None:
        if not (v[a] <= v[b] <= v[c]):
            problems.append(f"{a} <= {b} <= {c} is required ({v[a]}, {v[b]}, {v[c]})")

    order("PRIMER_MIN_SIZE", "PRIMER_OPT_SIZE", "PRIMER_MAX_SIZE")
    order("PRIMER_MIN_TM", "PRIMER_OPT_TM", "PRIMER_MAX_TM")
    if v["PRIMER_MIN_GC"] > v["PRIMER_MAX_GC"]:
        problems.append("PRIMER_MIN_GC must be <= PRIMER_MAX_GC")
    if v.get("PRIMER_PICK_INTERNAL_OLIGO"):
        order("PRIMER_INTERNAL_MIN_SIZE", "PRIMER_INTERNAL_OPT_SIZE", "PRIMER_INTERNAL_MAX_SIZE")
        order("PRIMER_INTERNAL_MIN_TM", "PRIMER_INTERNAL_OPT_TM", "PRIMER_INTERNAL_MAX_TM")
    return problems


def global_tags(values: dict[str, Any]) -> list[tuple[str, Any]]:
    """Ordered (tag, value) pairs for the Primer3 global settings.

    Always-written tags come first (same order as primer3.sh), followed only by
    the parameters that differ from the Primer3 defaults.
    """
    v = normalize(values)
    tags: list[tuple[str, Any]] = []
    for tag in ALWAYS_WRITTEN:
        if tag == "PRIMER_TASK":
            tags.append((tag, "generic"))
        elif tag == "PRIMER_EXPLAIN_FLAG":
            tags.append((tag, 1))
        else:
            tags.append((tag, v[tag]))
    internal = bool(v.get("PRIMER_PICK_INTERNAL_OLIGO"))
    for spec in PARAM_SPEC:
        tag = spec["tag"]
        if tag in ALWAYS_WRITTEN:
            continue
        if spec["group"] == "probe" and tag != "PRIMER_PICK_INTERNAL_OLIGO" and not internal:
            continue
        if v[tag] != spec["default"]:
            tags.append((tag, v[tag]))
    return tags


def format_value(value: Any) -> str:
    if isinstance(value, float):
        return str(int(value)) if value.is_integer() else repr(value)
    return str(value)
