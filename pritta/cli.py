"""Command-line interface - a cross-platform drop-in for primer3.sh.

    pritta-cli example_seq.txt ex_example
    pritta-cli targets.fa run1 --preset qpcr --csv
    pritta-cli seq.txt out --set PRIMER_PRODUCT_SIZE_RANGE=200-400 --set PRIMER_NUM_RETURN=10
"""

from __future__ import annotations

import argparse
import os
import re
import sys

from . import __version__, engine, export, params
from .sequence import SequenceError, read_file


def _safe(name: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "_", name).strip("_") or "seq"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="pritta-cli",
        description="Design PCR primers with Primer3. Mark the target inside the sequence with [ ].",
    )
    ap.add_argument("sequence_file", help="text/FASTA with [target], <excluded> or {included} markup, or a .primer3.in file")
    ap.add_argument("output_prefix", nargs="?", default="primer3_result", help="output prefix (default: primer3_result)")
    ap.add_argument("--preset", choices=sorted(params.PRESETS), default="standard", help="parameter preset (default: standard = primer3.sh)")
    ap.add_argument("--set", action="append", default=[], metavar="TAG=VALUE", help="override a Primer3 parameter (repeatable)")
    ap.add_argument("--engine", choices=["auto", "primer3-py", "primer3_core"], default="auto")
    ap.add_argument("--csv", action="store_true", help="also write <prefix>.primers.csv and <prefix>.order.tsv")
    ap.add_argument("--version", action="version", version=f"PriTta {__version__}")
    args = ap.parse_args(argv)

    if not os.path.isfile(args.sequence_file):
        print(f"Error: sequence file '{args.sequence_file}' not found", file=sys.stderr)
        return 1
    try:
        records = read_file(args.sequence_file)
    except SequenceError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    values = params.preset_values(args.preset)
    for item in args.set:
        if "=" not in item:
            print(f"Error: --set expects TAG=VALUE, got '{item}'", file=sys.stderr)
            return 1
        tag, value = item.split("=", 1)
        if tag not in params.SPEC_BY_TAG:
            print(f"Error: unknown parameter '{tag}'", file=sys.stderr)
            return 1
        values[tag] = value
    try:
        values = params.normalize(values)
    except ValueError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1

    results = []
    status = 0
    for rec in records:
        if not rec.targets:
            print(f"Warning: '{rec.id}' has no [target] region; primers may land anywhere.", file=sys.stderr)
        prefix = args.output_prefix if len(records) == 1 else f"{args.output_prefix}.{_safe(rec.id)}"
        res = engine.design(rec, values, args.engine)
        results.append(res)
        with open(f"{prefix}.primer3.in", "w", encoding="utf-8", newline="\n") as fh:
            fh.write(res["boulder_in"])
        if not res["ok"]:
            print(f"[{rec.id}] Error: {res['error']}", file=sys.stderr)
            status = 1
            continue
        with open(f"{prefix}.primer3.out", "w", encoding="utf-8", newline="\n") as fh:
            fh.write(res["boulder_out"])
        print(f"[{rec.id}] Primer3 finished ({res['engine']}).")
        print(f"  Input : {prefix}.primer3.in")
        print(f"  Output: {prefix}.primer3.out")
        for w in res["warnings"]:
            print(f"  Warning: {w}")
        if res["pairs"]:
            top = res["pairs"][0]
            print("\n  Top primer pair (rank 1, grade %s)" % top["grade"])
            print(f"    LEFT : {top['left']['seq']}  (Tm {top['left']['tm']:.1f})")
            print(f"    RIGHT: {top['right']['seq']}  (Tm {top['right']['tm']:.1f})")
            if top.get("internal"):
                print(f"    PROBE: {top['internal']['seq']}  (Tm {top['internal']['tm']:.1f})")
            print(f"    PRODUCT_SIZE: {top['product_size']} bp\n")
        else:
            print(f"  No primer pair found. See {prefix}.primer3.out for PRIMER_*_EXPLAIN lines.\n", file=sys.stderr)

    if args.csv:
        with open(f"{args.output_prefix}.primers.csv", "w", encoding="utf-8-sig", newline="") as fh:
            fh.write(export.to_csv(results))
        with open(f"{args.output_prefix}.order.tsv", "w", encoding="utf-8-sig", newline="") as fh:
            fh.write(export.order_sheet(results))
        print(f"Tables: {args.output_prefix}.primers.csv, {args.output_prefix}.order.tsv")
    return status


if __name__ == "__main__":
    sys.exit(main())
