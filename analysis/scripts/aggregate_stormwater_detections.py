#!/usr/bin/env python3
"""Aggregate transcribed stormwater/surface-water results into a summary CSV.

Per analysis/detections-rebuild/README.md: every min, max, date-of-max, count
and exceedance ratio here is COMPUTED from the raw transcription -- none is
asserted from a narrative reading of the source. Qualifier semantics:

  <x      non-detect at reporting limit x   -> not a detection
  x J     estimated value between MDL/PQL   -> counted as a detection, flagged
  x J+    estimated, possibly biased high   -> counted as a detection, flagged
  <x UJ   estimated non-detect              -> not a detection
  ---     not analyzed / not available      -> excluded from all counts
  ***     dry conditions (no sample)        -> excluded from all counts
"""

import csv
import re
import sys
from pathlib import Path

# Regulatory limits, transcribed verbatim from each table's own "MCLs" row.
# "secondary" marks taste/odour/welfare-based standards, which are NOT health
# based -- do not report an exceedance of these as a COC exceedance.
LIMITS = {
    "antimony": (6.0, "primary MCL"),
    "arsenic": (10.0, "primary MCL"),
    "barium": (1000.0, "primary MCL"),
    "beryllium": (4.0, "primary MCL"),
    "cadmium": (5.0, "primary MCL"),
    "chromium": (50.0, "primary MCL"),
    "cobalt": (None, "no MCL established"),
    "copper": (1300.0, "primary MCL"),
    "lead": (15.0, "primary MCL"),
    "manganese": (50.0, "secondary MCL"),
    "molybdenum": (None, "no MCL established"),
    "nickel": (100.0, "primary MCL"),
    "selenium": (50.0, "primary MCL"),
    "silver": (100.0, "secondary MCL"),
    "thallium": (2.0, "primary MCL"),
    "vanadium": (None, "no MCL established"),
    "zinc": (5000.0, "secondary MCL"),
    "strontium": (None, "no MCL established"),
    "mercury": (2.0, "primary MCL"),
    "calcium": (None, "no MCL established"),
    "magnesium": (None, "no MCL established"),
    "potassium": (None, "no MCL established"),
    "sodium": (None, "no MCL established"),
    "nitrate_as_n": (10.0, "primary MCL"),
    "sulfate": (250.0, "secondary MCL"),
    "sulfide": (None, "no MCL established"),
    "total_suspended_solids": (None, "no MCL established"),
    "chloride": (250.0, "secondary MCL"),
    "alkalinity_bicarbonate": (None, "no MCL established"),
    "alkalinity_carbonate": (None, "no MCL established"),
    "alkalinity_total": (None, "no MCL established"),
    "total_dissolved_solids": (500.0, "secondary MCL"),
}

UNITS = {
    "calcium": "mg/L", "magnesium": "mg/L", "potassium": "mg/L", "sodium": "mg/L",
    "nitrate_as_n": "mg/L", "sulfate": "mg/L", "sulfide": "mg/L",
    "total_suspended_solids": "mg/L", "chloride": "mg/L",
    "alkalinity_bicarbonate": "mg/L", "alkalinity_carbonate": "mg/L",
    "alkalinity_total": "mg/L", "total_dissolved_solids": "mg/L",
}

NOT_ANALYZED = {"---", "‐‐‐", "***", ""}
NUM_RE = re.compile(r"-?[\d,]*\.?\d+")


def parse_cell(raw):
    """Return (kind, value, qualifier). kind in detect|nondetect|not_analyzed."""
    s = (raw or "").strip()
    if s in NOT_ANALYZED or not s:
        return "not_analyzed", None, ""
    if s.replace("‐", "-").strip("- ") == "":
        return "not_analyzed", None, ""
    m = NUM_RE.search(s.replace(",", ""))
    if not m:
        return "not_analyzed", None, ""
    val = float(m.group(0))
    qual = "".join(q for q in ("UJ", "J+", "J") if q in s)
    # order matters: check UJ before J so estimated non-detects aren't mislabelled
    if "UJ" in s:
        qual = "UJ"
    elif "J+" in s:
        qual = "J+"
    elif "J" in s:
        qual = "J"
    else:
        qual = ""
    kind = "nondetect" if s.lstrip().startswith("<") else "detect"
    return kind, val, qual


def sort_key(d):
    m, day, y = d.split("/")
    return (int(y), int(m), int(day))


def aggregate(raw_paths, source_note, out_path):
    records = []
    analytes = []
    for p in raw_paths:
        rows = list(csv.DictReader(open(p)))
        if not rows:
            continue
        cols = [c for c in rows[0]
                if c not in ("sample_id", "sample_date", "page", "row_annotation")]
        for c in cols:
            if c not in analytes:
                analytes.append(c)
        for r in rows:
            r["_source"] = Path(p).name
            records.append((r, cols))

    by = {}
    for r, cols in records:
        loc = r["sample_id"]
        for a in cols:
            kind, val, qual = parse_cell(r.get(a, ""))
            if r["row_annotation"]:
                kind = "not_analyzed"
            by.setdefault((loc, a), []).append((r["sample_date"], kind, val, qual,
                                                r["_source"], r["page"]))

    out_rows = []
    for (loc, a), obs in sorted(by.items(), key=lambda kv: (kv[0][0], kv[0][1])):
        det = [(d, v, q) for d, k, v, q, _s, _p in obs if k == "detect" and v is not None]
        nd = [(d, v) for d, k, v, _q, _s, _p in obs if k == "nondetect" and v is not None]
        analyzed = [o for o in obs if o[1] in ("detect", "nondetect")]
        if not analyzed:
            continue
        limit, limit_type = LIMITS.get(a, (None, "unknown"))
        unit = UNITS.get(a, "ug/L")

        mx = max(det, key=lambda t: t[1]) if det else None
        mn = min(det, key=lambda t: t[1]) if det else None
        max_nd = max(nd, key=lambda t: t[1]) if nd else None

        ratio = ""
        exceeds = ""
        if mx and limit:
            ratio = round(mx[1] / limit, 3)
            exceeds = "yes" if mx[1] > limit else "no"
        # A non-detect whose reporting limit sits above the MCL cannot be
        # assessed for compliance -- call that out rather than reporting "no".
        rl_above = ""
        if limit and max_nd and max_nd[1] > limit:
            rl_above = "yes"

        out_rows.append({
            "location": loc,
            "analyte": a,
            "unit": unit,
            "n_analyzed": len(analyzed),
            "n_detect": len(det),
            "n_nondetect": len(nd),
            "min_detected": mn[1] if mn else "",
            "min_detected_date": mn[0] if mn else "",
            "max_detected": mx[1] if mx else "",
            "max_detected_date": mx[0] if mx else "",
            "max_detected_qualifier": mx[2] if mx else "",
            "max_reporting_limit_nondetect": max_nd[1] if max_nd else "",
            "max_reporting_limit_date": max_nd[0] if max_nd else "",
            "regulatory_limit": limit if limit else "",
            "limit_type": limit_type,
            "exceedance_ratio_at_max": ratio,
            "exceeds_limit": exceeds,
            "nondetect_rl_above_limit": rl_above,
            "source_document": source_note,
        })

    fields = list(out_rows[0].keys())
    with open(out_path, "w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=fields)
        w.writeheader()
        w.writerows(out_rows)
    print(f"wrote {len(out_rows)} summary rows -> {out_path}")
    return out_rows


if __name__ == "__main__":
    out = sys.argv[1]
    note = sys.argv[2]
    aggregate(sys.argv[3:], note, out)
