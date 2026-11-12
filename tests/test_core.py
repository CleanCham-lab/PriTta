import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from pritta import engine, export, params  # noqa: E402
from pritta.sequence import SequenceError, parse_markup, parse_text, read_file, to_markup  # noqa: E402

HERE = os.path.dirname(__file__)
EXAMPLE = os.path.join(HERE, "..", "examples", "example_seq.txt")


def _read(name):
    with open(os.path.join(HERE, name), encoding="utf-8") as fh:
        return fh.read()


# ---------------------------------------------------------------- parsing

def test_markup_target_matches_primer3_sh():
    rec = read_file(EXAMPLE)[0]
    assert rec.id == "example_seq.txt"
    assert rec.targets == [[360, 20]]
    assert "[" not in rec.sequence and len(rec.sequence) == 650


def test_all_region_kinds_and_roundtrip():
    rec = parse_markup("AC{GT<AA>CC[GG]TT}ACGT", "x")
    assert rec.sequence == "ACGTAACCGGTTACGT"
    assert rec.excluded == [[4, 2]]
    assert rec.targets == [[8, 2]]
    assert rec.included == [[2, 10]]
    assert parse_markup(to_markup(rec)).targets == rec.targets


def test_lowercase_numbers_and_junk_are_handled():
    rec = parse_markup("1 acgt acgt\n11 ACGTACGTACGT-x", "x")
    assert rec.sequence == "ACGTACGTACGTACGTACGT"
    assert any("non-DNA" in w for w in rec.warnings)


def test_unbalanced_brackets_raise():
    with pytest.raises(SequenceError):
        parse_markup("ACGT[ACGT")
    with pytest.raises(SequenceError):
        parse_markup("ACGT]ACGT")


def test_multi_fasta_with_duplicate_ids():
    recs = parse_text(">a desc\nACGT[ACGT]\n>a\nGGGG\n>b\nCCCC")
    assert [r.id for r in recs] == ["a", "a_2", "b"]
    assert recs[0].targets == [[4, 4]]


def test_boulder_input_is_parsed():
    recs = parse_text(_read("ex_example.primer3.in"))
    assert recs[0].targets == [[360, 20]]
    assert recs[0].params["PRIMER_PRODUCT_SIZE_RANGE"] == "150-700"


# ---------------------------------------------------------------- parameters

def test_standard_preset_writes_same_input_as_primer3_sh():
    rec = read_file(EXAMPLE)[0]
    assert engine.boulder_input(rec, params.preset_values("standard")) == _read("ex_example.primer3.in")


def test_params_validation():
    v = params.normalize({"PRIMER_MIN_TM": 65, "PRIMER_OPT_TM": 60})
    assert params.validate(v)
    with pytest.raises(ValueError):
        params.normalize({"PRIMER_PRODUCT_SIZE_RANGE": "abc"})
    assert params.parse_size_ranges("100-200, 300-400") == [[100, 200], [300, 400]]


# ---------------------------------------------------------------- engine

def test_output_matches_primer3_sh_exactly():
    rec = read_file(EXAMPLE)[0]
    res = engine.design(rec, params.preset_values("standard"), "primer3-py")
    assert res["ok"], res["error"]
    assert res["boulder_out"] == _read("ex_example.primer3.out")
    top = res["pairs"][0]
    assert top["left"]["seq"] == "TGGACGAGAAAGTGGTGAGC"
    assert top["right"]["seq"] == "CCCATTCAAAGTTTGCGCGG"
    assert top["product_size"] == 551
    assert top["right"]["end"] - top["left"]["start"] + 1 == 551
    assert top["grade"] == "A"
    assert "heterodimer" in top["structures"]


def test_loaded_output_roundtrip():
    rec = parse_text(_read("ex_example.primer3.out"), "x")[0]
    res = engine.result_from_loaded(rec)
    assert res["ok"] and len(res["pairs"]) == 5
    assert res["pairs"][0]["left"]["seq"] == "TGGACGAGAAAGTGGTGAGC"
    assert res["explain"]["left"][0] == {"label": "considered", "count": 3164}


def test_probe_design_and_exports():
    rec = read_file(EXAMPLE)[0]
    vals = params.preset_values("taqman")
    vals["PRIMER_PRODUCT_SIZE_RANGE"] = "70-300"
    vals["PRIMER_MIN_GC"] = 30
    vals["PRIMER_MAX_GC"] = 80
    res = engine.design(rec, vals, "primer3-py")
    assert res["ok"], res["error"]
    sheet = export.order_sheet([res])
    assert sheet.startswith("Name\t")
    csv_text = export.to_csv([res])
    assert csv_text.splitlines()[0].startswith("record,rank,grade")


def test_engine_error_is_reported_not_raised():
    rec = parse_markup("ACGT[ACGT]ACGT", "tiny")
    res = engine.design(rec, params.preset_values("standard"), "primer3-py")
    assert res["ok"] is False or res["pairs"] == []


def test_note_lines_are_not_read_as_bases():
    # labels like these used to be absorbed as IUPAC letters (M, Y, H, G, ...)
    text = "GL02123P\nSanger\nP/M\nMYH7\nhg38\nNM_000257.4\nc.2389G>A\n14-23425316-C-T\nFasta\nINT20~\n" \
           "c.2287-138(g.23425556)~c.2450(g.23424998)\nACGTACGTAC[GGCCAATT]ACGTACGT\n"
    rec = parse_text(text, "myh7")[0]
    assert rec.sequence == "ACGTACGTACGGCCAATTACGTACGT"
    assert rec.targets == [[10, 8]]
    assert any("non-sequence" in w for w in rec.warnings)
    # GenBank-style numbered lines and soft-masked bases are still sequence
    rec = parse_text("1 acgtacgtac gtacgtacgt\n21 ACGTNNACGT", "gb")[0]
    assert rec.sequence == "ACGTACGTACGTACGTACGTACGTNNACGT"
