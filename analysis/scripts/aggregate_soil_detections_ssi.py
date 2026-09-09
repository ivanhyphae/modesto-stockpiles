"""
Aggregation script for the two 2012/2013 Modesto Soil Stockpiles supplemental
documents: the SSI Report (S9525-06-44 Modesto Stockpiles SSI Report Rev.0313)
and its companion HHRA UPDATE (S9525-06-44 HHRA UPDATE Rev.0313).

This is a SEPARATE script from aggregate_soil_detections.py (which already
exists, hardcoded to the FS Report's raw CSV and a different column schema --
range_low_mgkg/range_high_mgkg/source_page_printed/n_samples/source_section).
The SSI/HHRA raw CSVs built here use a different, simpler long-format schema
(investigation_event, location, sample_id, depth_ft, is_background, analyte,
value_mgkg, qualifier, value_type, notes) because the SSI Report reports real
per-boring per-depth detections (unlike the FS Report), so per-sample
provenance (boring ID + depth) matters more here than a page/section cite.
Rather than reshape either raw CSV to fit the other script (risking a clobber
of parallel work, or of the FS Report's own aggregation), this script is kept
independent, per the task's instructions.

Method (same spirit as aggregate_detections.py / aggregate_soil_detections.py):
  1. Compute min/max ONLY over rows with value_type == "detection", grouped by
     (location, analyte), from the SSI Report raw CSV (the only one of the two
     documents that contains real per-boring detections).
  2. List reported summary statistics (MDC, 95_UCL, EPC, MDC_reported,
     95_UCL_reported, detection_min_reported, background_*) from BOTH raw
     CSVs, as-is, with their notes/citation -- never averaged or recomputed.
  3. Flag any of the 6 extreme (>=50,000 mg/kg) deep barium Cadmium Boring
     detections explicitly, since these were the specific QA target called
     out for this rebuild.
  4. Compare the computed SSI Report max per (location, analyte) against
     regulatory limits that are actually stated in the SSI Report's Table 2
     (TTLC, 10xSTLC, CHHSL industrial/residential) -- these are the only
     numeric soil limits this document states for these analytes.
"""
import csv
import os

_HERE = os.path.dirname(os.path.abspath(__file__))
_ROOT = os.path.dirname(_HERE)  # analysis/
RAW_DIR = os.path.join(_ROOT, "detections-rebuild", "raw")
SUMMARY_DIR = os.path.join(_ROOT, "detections-rebuild", "summary")

SSI_RAW = os.path.join(RAW_DIR, "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.raw.csv")
HHRA_RAW = os.path.join(RAW_DIR, "S9525-06-44 HHRA UPDATE Rev.0313.raw.csv")

SSI_OUT = os.path.join(SUMMARY_DIR, "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.summary.csv")
HHRA_OUT = os.path.join(SUMMARY_DIR, "S9525-06-44 HHRA UPDATE Rev.0313.summary.csv")

# Numeric soil limits actually stated IN THE SSI REPORT'S TABLE 2 (PDF pp.35-38)
# for the target analytes. TTLC/STLC are California hazardous-waste
# thresholds; CHHSLs are the human-health screening levels used elsewhere in
# both documents' narrative discussion.
SSI_TABLE2_LIMITS = {
    "Arsenic": [
        {"limit": 500, "limit_type": "TTLC"},
        {"limit": 50, "limit_type": "10x STLC"},
        {"limit": 0.24, "limit_type": "CHHSL (industrial)"},
        {"limit": 0.07, "limit_type": "CHHSL (residential)"},
    ],
    "Barium": [
        {"limit": 10000, "limit_type": "TTLC"},
        {"limit": 1000, "limit_type": "10x STLC"},
        {"limit": 63000, "limit_type": "CHHSL (industrial)"},
        {"limit": 5200, "limit_type": "CHHSL (residential)"},
    ],
    "Lead": [
        {"limit": 1000, "limit_type": "TTLC"},
        {"limit": 250, "limit_type": "10x STLC"},
        {"limit": 320, "limit_type": "CHHSL (industrial)"},
        {"limit": 80, "limit_type": "CHHSL (residential)"},
    ],
    "Strontium": [
        {"limit": 610000, "limit_type": "CHHSL (industrial)"},
        {"limit": 47000, "limit_type": "CHHSL (residential) / USEPA RSL"},
    ],  # No TTLC/STLC stated for strontium in Table 2 (col shows "NA").
}

DETECTION_TYPES = {"detection"}
SUMMARY_TYPES = {
    "MDC", "95_UCL", "EPC", "MDC_reported", "95_UCL_reported",
    "detection_min_reported", "background_95UCL", "background_mean",
}
EXTREME_BARIUM_THRESHOLD = 50000.0


def to_float(s):
    if s is None or s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def load_rows(path):
    with open(path, newline="") as f:
        return list(csv.DictReader(f))


def compute_ssi_detection_summary(rows):
    groups = {}
    for r in rows:
        if r["value_type"] not in DETECTION_TYPES:
            continue
        v = to_float(r["value_mgkg"])
        if v is None:
            continue
        key = (r["location"], r["analyte"])
        groups.setdefault(key, []).append((v, r))

    out = []
    for (location, analyte), entries in sorted(groups.items()):
        vals = [v for v, _ in entries]
        min_v = min(vals)
        max_v = max(vals)
        min_row = next(r for v, r in entries if v == min_v)
        max_row = next(r for v, r in entries if v == max_v)
        n = len(entries)
        limit_rows = SSI_TABLE2_LIMITS.get(analyte, [])
        for lim in (limit_rows or [{"limit": None, "limit_type": ""}]):
            ratio = round(max_v / lim["limit"], 4) if lim["limit"] else ""
            out.append({
                "location": location,
                "analyte": analyte,
                "min_detected_mgkg": min_v,
                "min_sample_id": min_row["sample_id"],
                "min_depth_ft": min_row["depth_ft"],
                "max_detected_mgkg": max_v,
                "max_sample_id": max_row["sample_id"],
                "max_depth_ft": max_row["depth_ft"],
                "n_detections_contributing": n,
                "regulatory_limit_mgkg": lim["limit"] if lim["limit"] else "",
                "limit_type": lim["limit_type"],
                "exceedance_ratio_at_max": ratio,
                "extreme_deep_barium_flag": (
                    "YES - >=50,000 mg/kg deep Cadmium Boring value"
                    if analyte == "Barium" and max_v >= EXTREME_BARIUM_THRESHOLD
                    else ""
                ),
                "source_document": "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.pdf",
            })
    return out


def list_extreme_barium_detections(rows):
    """All individual Cadmium Boring barium detections >= 50,000 mg/kg --
    not just the max -- per the task's requirement to capture every extreme
    deep value, not a single outlier."""
    out = []
    for r in rows:
        if r["analyte"] != "Barium" or r["value_type"] != "detection":
            continue
        if not r["sample_id"].startswith("CB"):
            continue
        v = to_float(r["value_mgkg"])
        if v is not None and v >= EXTREME_BARIUM_THRESHOLD:
            out.append({
                "sample_id": r["sample_id"],
                "location": r["location"],
                "depth_ft": r["depth_ft"],
                "value_mgkg": v,
                "notes": r["notes"],
            })
    out.sort(key=lambda r: -r["value_mgkg"])
    return out


def collect_reported_stats(rows, source_doc):
    out = []
    for r in rows:
        if r["value_type"] not in SUMMARY_TYPES:
            continue
        v = to_float(r["value_mgkg"])
        out.append({
            "investigation_event": r["investigation_event"],
            "location": r["location"],
            "sample_id": r["sample_id"],
            "depth_ft": r["depth_ft"],
            "is_background": r["is_background"],
            "analyte": r["analyte"],
            "value_type": r["value_type"],
            "value_mgkg": v if v is not None else "",
            "source_document": source_doc,
            "notes": r["notes"],
        })
    return out


def main():
    ssi_rows = load_rows(SSI_RAW)
    hhra_rows = load_rows(HHRA_RAW)

    ssi_detection_summary = compute_ssi_detection_summary(ssi_rows)
    extreme_barium = list_extreme_barium_detections(ssi_rows)
    ssi_reported = collect_reported_stats(ssi_rows, "S9525-06-44 Modesto Stockpiles SSI Report Rev.0313.pdf")
    hhra_reported = collect_reported_stats(hhra_rows, "S9525-06-44 HHRA UPDATE Rev.0313.pdf")

    os.makedirs(SUMMARY_DIR, exist_ok=True)

    detection_fields = [
        "location", "analyte", "min_detected_mgkg", "min_sample_id", "min_depth_ft",
        "max_detected_mgkg", "max_sample_id", "max_depth_ft", "n_detections_contributing",
        "regulatory_limit_mgkg", "limit_type", "exceedance_ratio_at_max",
        "extreme_deep_barium_flag", "source_document",
    ]
    extreme_fields = ["sample_id", "location", "depth_ft", "value_mgkg", "notes"]
    reported_fields = [
        "investigation_event", "location", "sample_id", "depth_ft", "is_background",
        "analyte", "value_type", "value_mgkg", "source_document", "notes",
    ]

    with open(SSI_OUT, "w", newline="") as f:
        f.write("# Part 1: min/max computed from RAW DETECTIONS ONLY (value_type == "
                "'detection'), grouped by (location, analyte), from the SSI Report raw CSV.\n")
        w = csv.DictWriter(f, fieldnames=detection_fields)
        w.writeheader()
        w.writerows(ssi_detection_summary)

        f.write("\n# Part 2: ALL individual Cadmium Boring barium detections >= 50,000 mg/kg "
                "(not just the single max) -- multiple deep extreme values exist under "
                "Stockpile 2 (CB1, CB2, CB3) and Stockpile 3 (CB5), not a single outlier.\n")
        w2 = csv.DictWriter(f, fieldnames=extreme_fields)
        w2.writeheader()
        w2.writerows(extreme_barium)

        f.write("\n# Part 3: reported summary statistics found IN THE SSI REPORT itself "
                "(background 95% UCL / mean rows from Table 2 and Table 3), quoted as-is.\n")
        w3 = csv.DictWriter(f, fieldnames=reported_fields)
        w3.writeheader()
        w3.writerows(ssi_reported)

    with open(HHRA_OUT, "w", newline="") as f:
        f.write("# Reported summary statistics from the HHRA UPDATE: (a) 2012 SSI data "
                "MDCs/95%UCL as RESTATED in this document's narrative text (cross-check "
                "these against Part 1 of the SSI Report summary above -- they should "
                "match, since both describe the same underlying 2012 detections), and "
                "(b) the 2006 Shaw-investigation COPC-selection tables (Tables 2-5) "
                "reproduced as Appendix B. Quoted as-is, never recomputed.\n")
        w = csv.DictWriter(f, fieldnames=reported_fields)
        w.writeheader()
        w.writerows(hhra_reported)

    print(f"SSI Report summary -> {SSI_OUT}")
    print(f"  {len(ssi_detection_summary)} detection min/max rows, "
          f"{len(extreme_barium)} extreme (>=50,000 mg/kg) barium detections, "
          f"{len(ssi_reported)} reported-statistic rows")
    print(f"HHRA UPDATE summary -> {HHRA_OUT}")
    print(f"  {len(hhra_reported)} reported-statistic rows")

    print("\n=== SSI Report: raw-detection min/max by location/analyte (first limit row each) ===")
    seen = set()
    for row in ssi_detection_summary:
        key = (row["location"], row["analyte"])
        if key in seen:
            continue
        seen.add(key)
        print(f"  {row['location']:60s} {row['analyte']:10s} "
              f"min={row['min_detected_mgkg']:>10} ({row['min_sample_id']})  "
              f"max={row['max_detected_mgkg']:>10} ({row['max_sample_id']}) mg/kg")

    print("\n=== All extreme (>=50,000 mg/kg) Cadmium Boring barium detections ===")
    for row in extreme_barium:
        print(f"  {row['sample_id']:12s} {row['location']:15s} depth={row['depth_ft']:>5} ft  "
              f"barium={row['value_mgkg']:>10} mg/kg")


if __name__ == "__main__":
    main()
